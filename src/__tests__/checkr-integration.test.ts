import { afterEach, describe, expect, it } from "vitest";
import {
  isBackgroundCheckPlanBActive,
  isCheckrApiFullyConfigured,
} from "@/lib/checkr-integration";

describe("checkr-integration", () => {
  const prevKey = process.env.CHECKR_API_KEY;
  const prevPkg = process.env.CHECKR_PACKAGE_SLUG;
  const prevPlanB = process.env.MATCH_FIT_CHECKR_PLAN_B;

  afterEach(() => {
    if (prevKey === undefined) delete process.env.CHECKR_API_KEY;
    else process.env.CHECKR_API_KEY = prevKey;
    if (prevPkg === undefined) delete process.env.CHECKR_PACKAGE_SLUG;
    else process.env.CHECKR_PACKAGE_SLUG = prevPkg;
    if (prevPlanB === undefined) delete process.env.MATCH_FIT_CHECKR_PLAN_B;
    else process.env.MATCH_FIT_CHECKR_PLAN_B = prevPlanB;
  });

  it("requires API key and package slug for full API mode", () => {
    delete process.env.CHECKR_API_KEY;
    delete process.env.CHECKR_PACKAGE_SLUG;
    delete process.env.MATCH_FIT_CHECKR_PLAN_B;
    expect(isCheckrApiFullyConfigured()).toBe(false);
    expect(isBackgroundCheckPlanBActive()).toBe(true);
  });

  it("disables Plan B when API is fully configured", () => {
    process.env.CHECKR_API_KEY = "test-key";
    process.env.CHECKR_PACKAGE_SLUG = "test_package";
    delete process.env.MATCH_FIT_CHECKR_PLAN_B;
    expect(isCheckrApiFullyConfigured()).toBe(true);
    expect(isBackgroundCheckPlanBActive()).toBe(false);
  });

  it("forces Plan B when env flag set", () => {
    process.env.CHECKR_API_KEY = "test-key";
    process.env.CHECKR_PACKAGE_SLUG = "test_package";
    process.env.MATCH_FIT_CHECKR_PLAN_B = "1";
    expect(isBackgroundCheckPlanBActive()).toBe(true);
  });
});
