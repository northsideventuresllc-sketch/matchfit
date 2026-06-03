import { describe, expect, it } from "vitest";
import { META_PIXEL_ID, metaStandardEventForConversion } from "./meta-pixel";

describe("metaStandardEventForConversion", () => {
  it("maps client signup to Subscribe", () => {
    expect(metaStandardEventForConversion("client_signup")).toBe("Subscribe");
  });

  it("maps trainer signup to CompleteRegistration", () => {
    expect(metaStandardEventForConversion("trainer_signup")).toBe("CompleteRegistration");
  });
});

describe("META_PIXEL_ID", () => {
  it("is configured for Match Fit", () => {
    expect(META_PIXEL_ID).toBe("1033341912986790");
  });
});
