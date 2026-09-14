"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AuthLayout } from "@/components/auth/auth-layout";

const authCopy: Record<string, { title: string; description: string }> = {
  "/sign-in": {
    title: "Welcome back",
    description: "Sign in to continue your study session."
  },
  "/sign-up": {
    title: "Create your account",
    description: "Start studying in minutes. No credit card required."
  },
  "/forgot-password": {
    title: "Recover your account",
    description: "Enter the email for your account to generate a password reset token."
  },
  "/reset-password": {
    title: "Set a new password",
    description: "Use the token from your password reset request."
  },
  "/email-verification": {
    title: "Verify your email",
    description: "Enter the 6-digit code we sent to your inbox to continue."
  }
};

const fallbackCopy = {
  title: "Account access",
  description: "Manage your Knorvex account."
};

export default function AuthRouteLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const copy = authCopy[pathname] ?? fallbackCopy;

  return <AuthLayout title={copy.title} description={copy.description}>{children}</AuthLayout>;
}
