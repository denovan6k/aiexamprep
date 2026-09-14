"use client";

import { useAuth } from "@/components/providers/auth-provider";

/** Returns the current session token (null when signed out). */
export function useAuthToken() {
  const { token } = useAuth();
  return token;
}

/** Shared `enabled` guard for authenticated queries. */
export function isAuthenticated(token: string | null | undefined): token is string {
  return Boolean(token);
}
