import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/script", () => ({
  default: ({
    id,
    children,
  }: {
    id?: string;
    children?: ReactNode;
  }) => <script data-script-id={id}>{children}</script>,
}));

vi.mock("@/components/meta-pixel-route-tracker", () => ({
  MetaPixelRouteTracker: () => null,
}));

import { MetaPixel } from "@/components/meta-pixel";
import { META_PIXEL_ID } from "@/lib/meta-pixel";

describe("MetaPixel", () => {
  it("renders pixel bootstrap with the configured pixel id", () => {
    const html = renderToStaticMarkup(<MetaPixel />);

    expect(html).toContain('data-script-id="meta-pixel"');
    expect(html).toContain(`fbq('init', '${META_PIXEL_ID}');`);
    expect(html).not.toContain("fbq('track', 'PageView');");
    expect(html).toContain(`facebook.com/tr?id=${META_PIXEL_ID}`);
  });
});
