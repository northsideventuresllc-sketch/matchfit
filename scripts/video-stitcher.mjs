import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Resolves the path to the ffmpeg executable.
 * Priority:
 * 1. FFMPEG_PATH environment variable
 * 2. ffmpeg-static package (if installed)
 * 3. System PATH ffmpeg
 */
export function getFfmpegPath() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffmpegStatic = require("ffmpeg-static");
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
      return ffmpegStatic;
    }
  } catch {
    // ffmpeg-static not present, fallback
  }

  return "ffmpeg";
}

/**
 * Constructs the ffmpeg arguments to concatenate multiple video clips with
 * aspect-ratio and resolution normalization to 1080x1920 vertical format.
 */
export function buildFfmpegConcatArgs(inputPaths, outputPath, options = {}) {
  const width = options.width || 1080;
  const height = options.height || 1920;
  const fps = options.fps || 30;

  if (!inputPaths || inputPaths.length === 0) {
    throw new Error("VIDEO_STITCH_NO_INPUTS: At least one input video path is required for stitching.");
  }

  const args = ["-y"];

  // Add inputs
  for (const input of inputPaths) {
    args.push("-i", input);
  }

  if (inputPaths.length === 1) {
    // Single clip normalization
    args.push(
      "-vf",
      `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps}`,
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "22",
      "-pix_fmt",
      "yuv420p",
      "-an",
      outputPath
    );
    return args;
  }

  // Multi-clip filter complex: normalize each stream then concatenate
  const filterInputs = [];
  const filterSteps = [];

  for (let i = 0; i < inputPaths.length; i++) {
    const label = `v${i}`;
    filterSteps.push(
      `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps}[${label}]`
    );
    filterInputs.push(`[${label}]`);
  }

  filterSteps.push(`${filterInputs.join("")}concat=n=${inputPaths.length}:v=1:a=0[outv]`);

  args.push(
    "-filter_complex",
    filterSteps.join("; "),
    "-map",
    "[outv]",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "22",
    "-pix_fmt",
    "yuv420p",
    "-an",
    outputPath
  );

  return args;
}

/**
 * Programmatically stitches multiple video clips into a single video file.
 *
 * @param {string[]} inputPaths - Array of absolute paths to video files to stitch in order.
 * @param {string} outputPath - Target path for the output stitched MP4 file.
 * @param {object} [options] - Configuration options.
 * @param {number} [options.width=1080] - Target width in pixels.
 * @param {number} [options.height=1920] - Target height in pixels.
 * @param {number} [options.fps=30] - Frame rate.
 * @param {string} [options.ffmpegPath] - Custom path to ffmpeg binary.
 * @returns {Promise<string>} - Resolves to the outputPath on success.
 */
export async function stitchVideoShots(inputPaths, outputPath, options = {}) {
  if (!inputPaths || inputPaths.length === 0) {
    throw new Error("VIDEO_STITCH_NO_INPUTS: At least one input video is required to stitch.");
  }

  // Validate that all input files exist
  for (const input of inputPaths) {
    if (!fs.existsSync(input)) {
      throw new Error(`VIDEO_STITCH_INPUT_NOT_FOUND: Input clip file does not exist: ${input}`);
    }
  }

  // Ensure output directory exists
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const ffmpegBin = options.ffmpegPath || getFfmpegPath();
  const args = buildFfmpegConcatArgs(inputPaths, outputPath, options);

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin, args);
    let stderr = "";

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => {
      reject(new Error(`FFMPEG_SPAWN_ERROR: Failed to launch ffmpeg process (${ffmpegBin}): ${err.message}`));
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `FFMPEG_CONCAT_FAILED: ffmpeg exited with code ${code}. Stderr: ${stderr.slice(-1000)}`
          )
        );
        return;
      }

      if (!fs.existsSync(outputPath)) {
        reject(new Error("VIDEO_STITCH_OUTPUT_MISSING: ffmpeg succeeded but output file was not created."));
        return;
      }

      resolve(outputPath);
    });
  });
}
