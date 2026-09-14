"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AuthCard } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getClientErrorMessage } from "@/lib/api";
import { requestPasswordResetOtp } from "@/lib/auth";
import { showError, showSuccess } from "@/lib/toast";
import { forgotPasswordSchema } from "@/lib/validation";

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" }
  });

  async function onSubmit(values: ForgotPasswordFormValues) {
    setError(null);
    try {
      const response = await requestPasswordResetOtp(values.email);
      showSuccess(response.message);
      router.push(`/reset-password?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      const message = getClientErrorMessage(err, "Password reset failed.");
      setError(message);
      showError(message);
    }
  }

  return (
    <>
      <AuthCard>
        <CardHeader>
          <CardTitle className="text-lg">Reset password</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a 6-digit code to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" autoComplete="email" {...register("email")} aria-invalid={Boolean(errors.email)} />
              {errors.email ? <p className="text-sm font-medium text-danger">{errors.email.message}</p> : null}
            </div>
            {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Link href="/sign-in" className="text-sm font-medium text-foreground hover:underline">Back to sign in</Link>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Sending..." : "Send reset code"}</Button>
            </div>
          </form>
        </CardContent>
      </AuthCard>
    </>
  );
}
