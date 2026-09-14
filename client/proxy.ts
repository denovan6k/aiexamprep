import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

const PRIVATE_PREFIXES = [
  "/admin",
  "/agents",
  "/chat",
  "/courses",
  "/cv",
  "/dashboard",
  "/flashcards",
  "/moderation",
  "/onboarding",
  "/progress",
  "/quizzes",
  "/search",
  "/settings"
];

// Only entry auth pages — password reset and email verification stay reachable while signed in.
const GUEST_ONLY_PATHS = new Set(["/sign-in", "/sign-up"]);

function getAuthenticatedRedirectPath(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/chat";
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);
  const isPrivate = PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isPrivate && !hasSession) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(signInUrl);
  }

  if (hasSession && GUEST_ONLY_PATHS.has(pathname)) {
    return NextResponse.redirect(new URL(getAuthenticatedRedirectPath(request), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|logo.svg).*)"]
};
