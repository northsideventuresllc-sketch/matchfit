import { describe, expect, it } from "vitest";
import { TRAINER_ZOOM_SUPABASE_OAUTH_SCOPES } from "@/lib/trainer-video-oauth-tokens";

describe("Zoom trainer video OAuth scopes", () => {
  it("includes meeting read/write and user profile for Supabase + direct flows", () => {
    expect(TRAINER_ZOOM_SUPABASE_OAUTH_SCOPES).toContain("meeting:read");
    expect(TRAINER_ZOOM_SUPABASE_OAUTH_SCOPES).toContain("meeting:write");
    expect(TRAINER_ZOOM_SUPABASE_OAUTH_SCOPES).toContain("user:read:user");
    expect(TRAINER_ZOOM_SUPABASE_OAUTH_SCOPES).not.toContain(",");
  });
});
