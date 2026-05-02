import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-mf-pathname", request.nextUrl.pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  // `/client/dashboard/:path*` alone may not match the index route on some Next versions; include the exact path so `x-mf-pathname` is always set for billing checks in the dashboard layout.
  matcher: ["/client/dashboard", "/client/dashboard/:path*"],
};
