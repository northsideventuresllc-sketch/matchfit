import { describe, expect, it } from "vitest";
import {
  fithubPublicFeedVisibilityWhere,
  isFitHubPostPubliclyInteractable,
} from "@/lib/fithub-public-feed";

describe("fithub-public-feed", () => {
  it("excludes demo seed posts and hidden trainers from feed visibility", () => {
    const where = fithubPublicFeedVisibilityWhere();
    expect(where.internalQaSandboxPost).toBe(false);
    expect(where.demoSeedKey).toBeNull();
    expect(where.trainer).toBeDefined();
  });

  it("rejects sandbox, demo, and hidden-trainer posts for interactions", () => {
    expect(
      isFitHubPostPubliclyInteractable({
        visibility: "PUBLIC",
        scheduledPublishAt: null,
        internalQaSandboxPost: true,
      }),
    ).toBe(false);
    expect(
      isFitHubPostPubliclyInteractable({
        visibility: "PUBLIC",
        scheduledPublishAt: null,
        demoSeedKey: "mf-demo-welcome",
      }),
    ).toBe(false);
    expect(
      isFitHubPostPubliclyInteractable({
        visibility: "PUBLIC",
        scheduledPublishAt: null,
        trainer: {
          email: "jb@northsideventures.com",
          username: "coach_jb",
        },
      }),
    ).toBe(false);
    expect(
      isFitHubPostPubliclyInteractable({
        visibility: "PUBLIC",
        scheduledPublishAt: null,
        trainer: {
          email: "real@example.com",
          username: "real_coach",
        },
      }),
    ).toBe(true);
  });
});
