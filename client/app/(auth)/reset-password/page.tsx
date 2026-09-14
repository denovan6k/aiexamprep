"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { OtpInput } from "@/components/auth/otp-input";
import { AuthCard } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { getClientErrorMessage } from "@/lib/api";
import { requestPasswordResetOtp, resetPasswordWithOtp } from "@/lib/auth";
import { showError, showSuccess } from "@/lib/toast";
import { resetPasswordSchema } from "@/lib/validation";

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get("email")?.trim() ?? "";
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting, isValid }
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onChange",
    defaultValues: {
      email: emailFromQuery,
      code: "",
      newPassword: "",
      confirmPassword: ""
    }
  });

  async function onSubmit(values: ResetPasswordFormValues) {
    setError(null);
    try {
      await resetPasswordWithOtp(values.email, values.code, values.newPassword);
      showSuccess("Password reset. You can sign in with your new password.");
      router.push("/sign-in");
    } catch (err) {
      const message = getClientErrorMessage(err, "Password reset failed.");
      setError(message);
      showError(message);
    }
  }

  async function resendCode() {
    setError(null);
    try {
      const response = await requestPasswordResetOtp(getValues("email"));
      showSuccess(response.message);
    } catch (err) {
      const message = getClientErrorMessage(err, "Could not resend reset code.");
      setError(message);
      showError(message);
    }
  }

  return (
    <>
      <AuthCard>
        <CardHeader>
          <CardTitle className="text-lg">Choose a new password</CardTitle>
          <CardDescription>
            {emailFromQuery ? (
              <>
                Enter the 6-digit code we sent to{" "}
                <span className="font-medium text-foreground">{emailFromQuery}</span>, then choose a new
                password.
              </>
            ) : (
              "Enter the 6-digit code from your email and choose a new password."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            {emailFromQuery ? (
              <input type="hidden" {...register("email")} />
            ) : (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  {...register("email")}
                  aria-invalid={Boolean(errors.email)}
                />
                {errors.email ? <p className="text-sm font-medium text-danger">{errors.email.message}</p> : null}
              </div>
            )}
            <div className="space-y-2">
              <Controller
                control={control}
                name="code"
                render={({ field }) => (
                  <OtpInput
                    id="code"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    aria-invalid={Boolean(errors.code)}
                  />
                )}
              />
              {errors.code ? <p className="text-sm font-medium text-danger">{errors.code.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <PasswordInput
                id="new-password"
                placeholder="New password"
                autoComplete="new-password"
                {...register("newPassword")}
                aria-invalid={Boolean(errors.newPassword)}
              />
              {errors.newPassword ? (
                <p className="text-sm font-medium text-danger">{errors.newPassword.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <PasswordInput
                id="confirm-password"
                placeholder="Confirm password"
                autoComplete="new-password"
                {...register("confirmPassword")}
                aria-invalid={Boolean(errors.confirmPassword)}
              />
              {errors.confirmPassword ? (
                <p className="text-sm font-medium text-danger">{errors.confirmPassword.message}</p>
              ) : null}
            </div>
            {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap gap-3">
                <Link href="/sign-in" className="text-sm font-medium text-foreground hover:underline">
                  Back to sign in
                </Link>
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => void resendCode()}
                >
                  Resend code
                </button>
              </div>
              <Button type="submit" disabled={isSubmitting || !isValid}>
                {isSubmitting ? "Saving..." : "Reset password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </AuthCard>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
