import { auth } from "@/lib/auth";
import { isSupportRole } from "@/lib/roles";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AUTH_PAGES = ["/login", "/forgot-password", "/verify-otp", "/reset-password", "/activate"];

const loginUrl = (req: NextRequest, error: string) => {
  const url = new URL("/login", req.url);
  url.searchParams.set("error", error);
  if (req.nextUrl.pathname !== "/") url.searchParams.set("callbackUrl", req.nextUrl.pathname);
  return url;
};

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const hasSupportRole = isSupportRole(req.auth?.user?.role);
  const isAuthPage = AUTH_PAGES.includes(pathname);

  // Auth pages stay reachable unless a valid Support session already exists (prevents redirect loops).
  if (isAuthPage) return isLoggedIn && hasSupportRole ? NextResponse.redirect(new URL("/dashboard", req.url)) : NextResponse.next();
  if (!isLoggedIn) return NextResponse.redirect(loginUrl(req, "session_required"));
  if (!hasSupportRole) return NextResponse.redirect(loginUrl(req, "role_not_allowed"));
  return NextResponse.next();
});

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"] };
