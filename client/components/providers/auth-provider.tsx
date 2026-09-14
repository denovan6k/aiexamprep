"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { ApiError, apiRequest, type ApiUser, type AuthResponse } from "@/lib/api";
import {
  confirmEmailVerification,
  registerAccount,
  requestEmailVerificationOtp,
  type RegisterResponse
} from "@/lib/auth";
import { AUTHENTICATED_SESSION } from "@/lib/auth/constants";

type AuthContextValue = {
  user: ApiUser | null;
  token: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<RegisterResponse>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendVerificationOtp: (email: string) => Promise<{ message: string }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const currentUser = await apiRequest<ApiUser>("/auth/me");
        if (!cancelled) {
          setToken(AUTHENTICATED_SESSION);
          setUser(currentUser);
        }
      } catch (error) {
        if (!cancelled) {
          if (!(error instanceof ApiError) || (error.status !== 401 && error.status !== 403)) {
            console.error("Unable to restore the session.", error);
          }
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function applyAuth(response: AuthResponse) {
    setToken(AUTHENTICATED_SESSION);
    setUser(response.user);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      async signIn(email, password) {
        const response = await apiRequest<AuthResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });
        await applyAuth(response);
      },
      async signUp(fullName, email, password) {
        const response = await registerAccount({
          fullName,
          email,
          password
        });
        await applyAuth(response);
        return response;
      },
      async verifyEmail(email, code) {
        setUser(await confirmEmailVerification(email, code));
      },
      async resendVerificationOtp(email) {
        const response = await requestEmailVerificationOtp(email);
        return { message: response.message };
      },
      async signOut() {
        await apiRequest("/auth/logout", { method: "POST" }).catch(() => undefined);
        setToken(null);
        setUser(null);
      },
      async refreshSession() {
        if (!token) {
          setUser(null);
          return;
        }
        setUser(await apiRequest<ApiUser>("/auth/me"));
      }
    }),
    [isLoading, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
