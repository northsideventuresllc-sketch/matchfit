import { describe, expect, it, vi } from "vitest";

import { probeEmulator } from "@/lib/content-calendar/posting-probe";

describe("probeEmulator", () => {
  it("is ok when adb devices reports at least one online device", async () => {
    const runAdb = vi.fn().mockResolvedValue({ stdout: "List of devices attached\nemulator-5554\tdevice\n" });

    const result = await probeEmulator(runAdb);

    expect(result.ok).toBe(true);
    expect(result.reason).toMatch(/reachable/i);
  });

  it("is not ok when adb devices reports zero devices", async () => {
    const runAdb = vi.fn().mockResolvedValue({ stdout: "List of devices attached\n" });

    const result = await probeEmulator(runAdb);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not reachable/i);
  });

  it("is not ok when a device is listed but not in 'device' state (e.g. offline/unauthorized)", async () => {
    const runAdb = vi.fn().mockResolvedValue({ stdout: "List of devices attached\nemulator-5554\tunauthorized\n" });

    const result = await probeEmulator(runAdb);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not reachable/i);
  });

  it("fails safe (not ok) when adb itself cannot run (binary missing, ENOENT)", async () => {
    const runAdb = vi.fn().mockRejectedValue(new Error("spawn adb ENOENT"));

    const result = await probeEmulator(runAdb);

    expect(result.ok).toBe(false);
    expect(result.reason).toContain("ENOENT");
  });

  it("attempts adb connect first when MATCHFIT_EMULATOR_ADB_HOST is set, then still checks devices", async () => {
    const prior = process.env.MATCHFIT_EMULATOR_ADB_HOST;
    process.env.MATCHFIT_EMULATOR_ADB_HOST = "10.0.0.5:5555";
    const runAdb = vi
      .fn()
      .mockResolvedValueOnce({ stdout: "connected to 10.0.0.5:5555" })
      .mockResolvedValueOnce({ stdout: "List of devices attached\n10.0.0.5:5555\tdevice\n" });

    const result = await probeEmulator(runAdb);

    expect(runAdb).toHaveBeenNthCalledWith(1, ["connect", "10.0.0.5:5555"]);
    expect(runAdb).toHaveBeenNthCalledWith(2, ["devices"]);
    expect(result.ok).toBe(true);

    if (prior === undefined) delete process.env.MATCHFIT_EMULATOR_ADB_HOST;
    else process.env.MATCHFIT_EMULATOR_ADB_HOST = prior;
  });
});
