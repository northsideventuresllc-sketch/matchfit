import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TurnstileField } from "@/components/turnstile-field";

type FieldProps = Parameters<typeof TurnstileField>[0];
type GateProps = FieldProps["gate"];

function makeGate(overrides: Partial<GateProps> = {}): GateProps {
  return {
    enabled: true,
    siteKey: "site-key",
    widgetRef: { current: null },
    ready: false,
    widgetError: false,
    onTurnstileReady: () => {},
    onTurnstileError: () => {},
    onTurnstileExpire: () => {},
    ...overrides,
  };
}

describe("TurnstileField", () => {
  it("renders nothing when Turnstile is disabled", () => {
    const html = renderToStaticMarkup(<TurnstileField gate={makeGate({ enabled: false })} />);
    expect(html).toBe("");
  });

  it("renders the default class and helper prompt while awaiting completion", () => {
    const html = renderToStaticMarkup(
      <TurnstileField gate={makeGate({ ready: false, widgetError: false })} />,
    );
    expect(html).toContain('class="flex flex-col items-center gap-2 py-1"');
    expect(html).toContain("Complete the security check below, then sign in.");
  });

  it("prefers the custom class name when provided", () => {
    const html = renderToStaticMarkup(
      <TurnstileField gate={makeGate({ ready: false, widgetError: false })} className="my-custom-class" />,
    );
    expect(html).toContain('class="my-custom-class"');
  });

  it("shows the widget error message when challenge loading fails", () => {
    const html = renderToStaticMarkup(<TurnstileField gate={makeGate({ widgetError: true })} />);
    expect(html).toContain(
      "Security check could not load. Refresh the page or allow challenges.cloudflare.com.",
    );
    expect(html).not.toContain("Complete the security check below, then sign in.");
  });

  it("hides status copy after widget is ready and no error exists", () => {
    const html = renderToStaticMarkup(<TurnstileField gate={makeGate({ ready: true, widgetError: false })} />);
    expect(html).not.toContain("Complete the security check below, then sign in.");
    expect(html).not.toContain(
      "Security check could not load. Refresh the page or allow challenges.cloudflare.com.",
    );
  });
});
