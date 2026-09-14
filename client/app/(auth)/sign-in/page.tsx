"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AuthCard } from "@/components/page-kit";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { getClientErrorMessage } from "@/lib/api";
import { siteConfig } from "@/lib/site";
import { showError, showSuccess } from "@/lib/toast";
import { asRoute } from "@/lib/utils";
import { signInSchema } from "@/lib/validation";

type SignInFormValues = z.infer<typeof signInSchema>;

function getSafeNextPath(next: string | null) {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/chat";
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" }
  });

  async function onSubmit(values: SignInFormValues) {
    setError(null);
    try {
      await signIn(values.email, values.password);
      showSuccess("Signed in.");
      router.push(asRoute(getSafeNextPath(searchParams.get("next"))));
    } catch (err) {
      const message = getClientErrorMessage(err, "Sign in failed.");
      setError(message);
      showError(message);
    }
  }

  return (
    <>
      <AuthCard>
        <CardHeader className="pb-4">
          <CardTitle className="sr-only">Sign in</CardTitle>
          <CardDescription>Use the email and password connected to your {siteConfig.name} account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" autoComplete="email" {...register("email")} aria-invalid={Boolean(errors.email)} />
              {errors.email ? <p className="text-sm font-medium text-danger">{errors.email.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput id="password" placeholder="Your password" autoComplete="current-password" {...register("password")} aria-invalid={Boolean(errors.password)} />
              {errors.password ? <p className="text-sm font-medium text-danger">{errors.password.message}</p> : null}
            </div>
            {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
            <div className="text-center">
              <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground">
                Forgot password?
              </Link>
            </div>
          </form>
        </CardContent>
      </AuthCard>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to {siteConfig.name}?{" "}
        <Link href="/sign-up" className="font-medium text-foreground hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
