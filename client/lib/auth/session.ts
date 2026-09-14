import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { ApiUser } from "@/lib/api";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

function apiBaseUrl() {
  return (
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
}

export const verifySession = cache(async (): Promise<ApiUser> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    redirect("/sign-in");
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
  } catch {
    // If the auth backend is temporarily unreachable, treat the session as invalid
    // instead of crashing the private layout with a 500.
    (await cookies()).delete(SESSION_COOKIE_NAME);
    redirect("/sign-in");
  }

  if (response.status === 401 || response.status === 403) {
    // Drop stale cookies so proxy.ts does not bounce sign-in back to /chat.
    (await cookies()).delete(SESSION_COOKIE_NAME);
    redirect("/sign-in");
  }
  if (!response.ok) {
    throw new Error(`Unable to verify the current session (${response.status}).`);
  }

  const user = (await response.json()) as ApiUser;
  if (!user.is_email_verified) {
    redirect(`/email-verification?email=${encodeURIComponent(user.email)}`);
  }

  return user;
});
