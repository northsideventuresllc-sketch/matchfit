import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { turnstileFieldSpy, useRouterMock, useSearchParamsMock, useTurnstileGateMock } = vi.hoisted(() => ({
  turnstileFieldSpy: vi.fn<(props: unknown) => void>(),
  useRouterMock: vi.fn<(typeof import("next/navigation"))["useRouter"]>(),
  useSearchParamsMock: vi.fn<(typeof import("next/navigation"))["useSearchParams"]>(),
  useTurnstileGateMock: vi.fn<(typeof import("@/hooks/use-turnstile-gate"))["useTurnstileGate"]>(),
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt?: string }) => <div aria-label={alt ?? ""} data-next-image role="img" />,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: unknown;
    children: ReactNode;
  } & Record<string, unknown>) => (
    <a href={typeof href === "string" ? href : String(href)} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
  useSearchParams: useSearchParamsMock,
}));

vi.mock("@/hooks/use-turnstile-gate", () => ({
  useTurnstileGate: useTurnstileGateMock,
}));

vi.mock("@/hooks/use-beta-launch-status", () => ({
  useBetaLaunchStatus: () => ({ status: null, loading: false }),
}));

vi.mock("@/components/turnstile-field", () => ({
  TurnstileField: (props: unknown) => {
    turnstileFieldSpy(props);
    return <div data-component="turnstile-field" />;
  },
}));

import AdminLoginPortal from "@/app/admin/login/admin-login-portal";
import LoginPortal from "@/app/client/login-portal";
import TrainerLoginPortal from "@/app/trainer/login/trainer-login-portal";
import TrainerSignUpClient from "@/app/trainer/signup/trainer-sign-up-client";

function createTurnstileGateState() {
  return {
    enabled: true,
    ref: { current: null },
    siteKey: "site-key",
    onTurnstileReady: vi.fn(),
    onTurnstileError: vi.fn(),
    onTurnstileExpire: vi.fn(),
    widgetError: false,
    ready: true,
    validateBeforeSubmit: vi.fn(() => null),
    turnstileField: vi.fn(() => ({ turnstileToken: "captcha-token" })),
    reset: vi.fn(),
    getCaptchaToken: vi.fn(() => "captcha-token"),
  };
}

describe("TurnstileField explicit props wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRouterMock.mockReturnValue({
      push: vi.fn(),
      replace: vi.fn(),
    } as unknown as ReturnType<(typeof import("next/navigation"))["useRouter"]>);
    useSearchParamsMock.mockReturnValue({
      get: vi.fn(() => null),
    } as unknown as ReturnType<(typeof import("next/navigation"))["useSearchParams"]>);
    useTurnstileGateMock.mockReturnValue(createTurnstileGateState());
  });

  it("passes explicit Turnstile props from the admin login portal", () => {
    const turnstile = createTurnstileGateState();
    useTurnstileGateMock.mockReturnValueOnce(turnstile);

    renderToStaticMarkup(<AdminLoginPortal />);

    expect(turnstileFieldSpy).toHaveBeenCalledTimes(1);
    expect(turnstileFieldSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: turnstile.enabled,
        widgetRef: turnstile.ref,
        siteKey: turnstile.siteKey,
        onReady: turnstile.onTurnstileReady,
        onError: turnstile.onTurnstileError,
        onExpire: turnstile.onTurnstileExpire,
        widgetError: turnstile.widgetError,
        ready: turnstile.ready,
      }),
    );
  });

  it("passes explicit Turnstile props and className from the client login portal", () => {
    const turnstile = createTurnstileGateState();
    useTurnstileGateMock.mockReturnValueOnce(turnstile);

    renderToStaticMarkup(<LoginPortal defaultNext={null} />);

    expect(turnstileFieldSpy).toHaveBeenCalledTimes(1);
    expect(turnstileFieldSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: turnstile.enabled,
        widgetRef: turnstile.ref,
        siteKey: turnstile.siteKey,
        onReady: turnstile.onTurnstileReady,
        onError: turnstile.onTurnstileError,
        onExpire: turnstile.onTurnstileExpire,
        widgetError: turnstile.widgetError,
        ready: turnstile.ready,
        className: "flex justify-center pt-1",
      }),
    );
  });

  it("passes explicit Turnstile props and className from the trainer login portal", () => {
    const turnstile = createTurnstileGateState();
    useTurnstileGateMock.mockReturnValueOnce(turnstile);

    renderToStaticMarkup(<TrainerLoginPortal redirectAfterLogin="/trainer/dashboard" />);

    expect(turnstileFieldSpy).toHaveBeenCalledTimes(1);
    expect(turnstileFieldSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: turnstile.enabled,
        widgetRef: turnstile.ref,
        siteKey: turnstile.siteKey,
        onReady: turnstile.onTurnstileReady,
        onError: turnstile.onTurnstileError,
        onExpire: turnstile.onTurnstileExpire,
        widgetError: turnstile.widgetError,
        ready: turnstile.ready,
        className: "flex justify-center pt-1",
      }),
    );
  });

  it("passes explicit Turnstile props and className from trainer sign-up", () => {
    const turnstile = createTurnstileGateState();
    useTurnstileGateMock.mockReturnValueOnce(turnstile);

    renderToStaticMarkup(<TrainerSignUpClient />);

    expect(turnstileFieldSpy).toHaveBeenCalledTimes(1);
    expect(turnstileFieldSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: turnstile.enabled,
        widgetRef: turnstile.ref,
        siteKey: turnstile.siteKey,
        onReady: turnstile.onTurnstileReady,
        onError: turnstile.onTurnstileError,
        onExpire: turnstile.onTurnstileExpire,
        widgetError: turnstile.widgetError,
        ready: turnstile.ready,
        className: "flex justify-center pt-1",
      }),
    );
  });
});
