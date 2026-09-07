import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type EmulatorProbeResult = {
  ok: boolean;
  /** Plain-English reason — always set, even when ok, so a log line is never empty. */
  reason: string;
};

/**
 * BPA-B1-SOCIAL-POSTING-0906 / Decision #1770: the Android emulator on the Mac mini is back and
 * logged in, so Instagram posting (and the TikTok carousel photo-mode) routes through it again —
 * but ONLY when it is actually reachable right now. This probe is the "only truth" the marketing
 * workflow skill calls for: it never trusts a stale note saying the emulator is up or dead, it
 * checks `adb devices` live, every run.
 *
 * `adb` only exists where an Android SDK platform-tools install is on PATH — normally the Mac
 * mini itself (or a CDP/adb bridge pointed at it via ANDROID_ADB_SERVER_HOST /
 * MATCHFIT_EMULATOR_ADB_HOST). Vercel's serverless runtime has neither adb nor the emulator, so
 * a probe running there will correctly, safely come back not-ok — the same fail-safe shape as
 * AXON's FIRE/HOLD gate (default to HOLD, never guess a device is there). `runAdb` is injectable
 * so tests can stub the child_process call without a real adb binary.
 */
export async function probeEmulator(
  runAdb: (args: string[]) => Promise<{ stdout: string }> = (args) => execFileAsync("adb", args),
): Promise<EmulatorProbeResult> {
  const adbHost = process.env.MATCHFIT_EMULATOR_ADB_HOST?.trim();

  try {
    if (adbHost) {
      // Best-effort — a host already connected is not an error, and a failed connect attempt
      // still falls through to `adb devices` below so a stale-but-still-good connection isn't
      // thrown away over a redundant `connect` call failing.
      await runAdb(["connect", adbHost]).catch(() => undefined);
    }

    const { stdout } = await runAdb(["devices"]);
    const deviceLines = stdout
      .split("\n")
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean);

    const online = deviceLines.filter((line) => /\bdevice$/.test(line));
    if (online.length > 0) {
      return { ok: true, reason: `Emulator reachable (${online.length} device${online.length === 1 ? "" : "s"}).` };
    }

    if (deviceLines.length > 0) {
      return {
        ok: false,
        reason: `Emulator not reachable — adb sees a device but it is not ready (${deviceLines.join("; ")}).`,
      };
    }

    return { ok: false, reason: "Emulator not reachable — adb reports no devices." };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: `Emulator not reachable — adb could not be run (${message}).` };
  }
}
