import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import {
  buildFfmpegConcatArgs,
  getFfmpegPath,
  stitchVideoShots,
} from "./video-stitcher.mjs";

describe("buildFfmpegConcatArgs", () => {
  it("builds single clip normalization arguments", () => {
    const args = buildFfmpegConcatArgs(["/tmp/clip1.mp4"], "/tmp/out.mp4", {
      width: 1080,
      height: 1920,
      fps: 30,
    });

    expect(args).toContain("-i");
    expect(args).toContain("/tmp/clip1.mp4");
    expect(args).toContain("/tmp/out.mp4");
    expect(args.join(" ")).toContain("scale=1080:1920");
  });

  it("builds multi-clip filter complex with correct concat count", () => {
    const inputs = ["/tmp/shot1.mp4", "/tmp/shot2.mp4", "/tmp/shot3.mp4"];
    const args = buildFfmpegConcatArgs(inputs, "/tmp/out.mp4");

    expect(args.filter((a) => a === "-i")).toHaveLength(3);
    expect(args).toContain("-filter_complex");

    const filterIdx = args.indexOf("-filter_complex");
    const filter = args[filterIdx + 1];

    expect(filter).toContain("[0:v]scale=1080:1920");
    expect(filter).toContain("[1:v]scale=1080:1920");
    expect(filter).toContain("[2:v]scale=1080:1920");
    expect(filter).toContain("[v0][v1][v2]concat=n=3:v=1:a=0[outv]");
  });

  it("throws when inputPaths is empty or undefined", () => {
    expect(() => buildFfmpegConcatArgs([], "/tmp/out.mp4")).toThrow(/VIDEO_STITCH_NO_INPUTS/);
    expect(() => buildFfmpegConcatArgs(null, "/tmp/out.mp4")).toThrow(/VIDEO_STITCH_NO_INPUTS/);
  });
});

describe("getFfmpegPath", () => {
  it("returns a non-empty string path to ffmpeg executable", () => {
    const bin = getFfmpegPath();
    expect(typeof bin).toBe("string");
    expect(bin.length).toBeGreaterThan(0);
  });
});

describe("stitchVideoShots functional execution", () => {
  it("stitches two synthetic test video clips into one valid mp4", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "matchfit-stitch-test-"));
    const ffmpegBin = getFfmpegPath();

    const clip1 = path.join(tmpDir, "shot1.mp4");
    const clip2 = path.join(tmpDir, "shot2.mp4");
    const output = path.join(tmpDir, "stitched.mp4");

    // Generate 1-second color test clips using ffmpeg lavfi
    execFileSync(ffmpegBin, [
      "-y",
      "-f", "lavfi",
      "-i", "color=c=red:s=720x1280:d=1",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      clip1,
    ]);

    execFileSync(ffmpegBin, [
      "-y",
      "-f", "lavfi",
      "-i", "color=c=blue:s=720x1280:d=1",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      clip2,
    ]);

    expect(fs.existsSync(clip1)).toBe(true);
    expect(fs.existsSync(clip2)).toBe(true);

    const result = await stitchVideoShots([clip1, clip2], output, {
      width: 1080,
      height: 1920,
      fps: 30,
    });

    expect(result).toBe(output);
    expect(fs.existsSync(output)).toBe(true);
    const stats = fs.statSync(output);
    expect(stats.size).toBeGreaterThan(1000);

    // Clean up test files
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws when an input file does not exist", async () => {
    const missingClip = "/tmp/non-existent-shot-999.mp4";
    await expect(stitchVideoShots([missingClip], "/tmp/out.mp4")).rejects.toThrow(
      /VIDEO_STITCH_INPUT_NOT_FOUND/
    );
  });
});
