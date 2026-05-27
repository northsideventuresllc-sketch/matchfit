import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/script", () => ({
  default: ({
    src,
    id,
    children,
  }: {
    src?: string;
    id?: string;
    children?: ReactNode;
  }) => (
    <script data-src={src} data-script-id={id}>
      {children}
    </script>
  ),
}));

import { GoogleAdsGtag } from "@/components/google-ads-gtag";
import { GOOGLE_ADS_ID } from "@/lib/google-ads";

describe("GoogleAdsGtag", () => {
  it("renders gtag bootstrap scripts with the configured ads id", () => {
    const html = renderToStaticMarkup(<GoogleAdsGtag />);

    expect(html).toContain(`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`);
    expect(html).toContain('data-script-id="google-ads-gtag"');
    expect(html).toContain(`gtag(&#x27;config&#x27;, &#x27;${GOOGLE_ADS_ID}&#x27;);`);
  });
});
