import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "./lib/session-cookie";

const PUBLIC_PATHS = ["/login", "/signup"];

/**
 * Gate the whole dashboard behind a session cookie. This only checks presence (not validity -
 * an expired/invalid token is caught server-side per-request in api-client.ts, which redirects
 * to /login too), so it stays cheap enough to run on every request.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const hasSession = req.cookies.has(SESSION_COOKIE);

  if (!hasSession && !isPublicPath) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (hasSession && isPublicPath) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
