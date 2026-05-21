import { describe, expect, it } from "vitest";
import {
  getChatContactLeakageBlockReason,
  scanChatTextForLeakageSignals,
} from "@/lib/chat-leakage-detection";

describe("chat-leakage-detection", () => {
  it("flags US phone numbers", () => {
    expect(scanChatTextForLeakageSignals("Call me at (404) 555-1212").flagged).toBe(true);
    expect(getChatContactLeakageBlockReason("(404) 555-1212")).not.toBeNull();
  });

  it("flags common email TLDs beyond .com", () => {
    expect(scanChatTextForLeakageSignals("Reach me at coach@studio.edu").flagged).toBe(true);
    expect(scanChatTextForLeakageSignals("coach@match.fit").flagged).toBe(true);
  });

  it("flags payment app keywords", () => {
    expect(scanChatTextForLeakageSignals("Pay me on venmo").flagged).toBe(true);
  });

  it("allows normal coaching copy", () => {
    expect(scanChatTextForLeakageSignals("See you Tuesday for legs day.").flagged).toBe(false);
    expect(getChatContactLeakageBlockReason("Great session today!")).toBeNull();
  });
});
