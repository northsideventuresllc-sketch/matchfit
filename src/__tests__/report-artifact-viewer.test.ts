import { describe, expect, it } from "vitest";
import { parseReportBlocks } from "@/app/admin/content-calendar/v2/components/report-artifact-viewer";

describe("parseReportBlocks", () => {
  it("groups a heading followed by bullets into separate blocks", () => {
    const blocks = parseReportBlocks(
      ["## 🔥 What's Working", "- Post **Tuesday** carousels", "- **Video** views up this week"].join("\n"),
    );
    expect(blocks).toEqual([
      { type: "heading", level: 2, text: "🔥 What's Working" },
      { type: "bullets", items: ["Post **Tuesday** carousels", "**Video** views up this week"] },
    ]);
  });

  it("supports ### as level 3 and • as a bullet marker", () => {
    const blocks = parseReportBlocks(["### Next Steps", "• Do the thing"].join("\n"));
    expect(blocks).toEqual([
      { type: "heading", level: 3, text: "Next Steps" },
      { type: "bullets", items: ["Do the thing"] },
    ]);
  });

  it("breaks a bullet run into two blocks when separated by a blank line", () => {
    const blocks = parseReportBlocks(["- first", "- second", "", "- third"].join("\n"));
    expect(blocks).toEqual([
      { type: "bullets", items: ["first", "second"] },
      { type: "bullets", items: ["third"] },
    ]);
  });

  it("keeps a stray non-bullet line as its own paragraph block", () => {
    const blocks = parseReportBlocks(["## Heading", "Just a plain sentence with no bullet marker."].join("\n"));
    expect(blocks).toEqual([
      { type: "heading", level: 2, text: "Heading" },
      { type: "paragraph", text: "Just a plain sentence with no bullet marker." },
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseReportBlocks("")).toEqual([]);
    expect(parseReportBlocks("\n\n  \n")).toEqual([]);
  });

  it("trims whitespace around headings and bullets", () => {
    const blocks = parseReportBlocks(["  ##   Spaced Heading  ", "  -   spaced bullet  "].join("\n"));
    expect(blocks).toEqual([
      { type: "heading", level: 2, text: "Spaced Heading" },
      { type: "bullets", items: ["spaced bullet"] },
    ]);
  });
});
