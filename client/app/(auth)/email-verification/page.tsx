"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { OtpInput } from "@/components/auth/otp-input";
import { AuthCard } from "@/components/page-kit";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getClientErrorMessage } from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";
import { emailVerificationSchema } from "@/lib/validation";
import { asRoute } from "@/lib/utils";

type EmailVerificationFormValues = z.infer<typeof emailVerificationSchema>;

function EmailVerificationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyEmail, resendVerificationOtp, refreshSession } = useAuth();
  const emailFromQuery = searchParams.get("email")?.trim() ?? "";
  const [error, setError] = useState<string | null>(null);
  const autoSent = useRef(false);
  const {
    register,
    control,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting, isValid }
  } = useForm<EmailVerificationFormValues>({
    resolver: zodResolver(emailVerificationSchema),
    mode: "onChange",
    defaultValues: {
      email: emailFromQuery,
      code: ""
    }
  });

  useEffect(() => {
    if (!emailFromQuery || autoSent.current) return;
    autoSent.current = true;
    void resendVerificationOtp(emailFromQuery)
      .then((response) => showSuccess(response.message))
      .catch((err) => {
        const message = getClientErrorMessage(err, "Could not send verification code.");
        setError(message);
        showError(message);
      });
  }, [emailFromQuery, resendVerificationOtp]);

  async function onSubmit(values: EmailVerificationFormValues) {
    setError(null);
    try {
      await verifyEmail(values.email, values.code);
      await refreshSession();
      showSuccess("Email verified.");
      router.push(asRoute("/chat"));
    } catch (err) {
      const message = getClientErrorMessage(err, "Email verification failed.");
      setError(message);
      showError(message);
    }
  }

  async function resendCode() {
    setError(null);
    try {
      const response = await resendVerificationOtp(getValues("email"));
      showSuccess(response.message);
    } catch (err) {
      const message = getClientErrorMessage(err, "Could not resend verification code.");
      setError(message);
      showError(message);
    }
  }

  return (
    <>
      <AuthCard>
        <CardHeader>
          <CardTitle className="text-lg">Verify your email</CardTitle>
          <CardDescription>
            {emailFromQuery ? (
              <>
                Enter the 6-digit code we sent to{" "}
                <span className="font-medium text-foreground">{emailFromQuery}</span>.
              </>
            ) : (
              "Enter the 6-digit code from your email."
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
                {errors.email ? (
                  <p className="text-sm font-medium text-danger">{errors.email.message}</p>
                ) : null}
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
            {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={() => void resendCode()}
              >
                Resend code
              </button>
              <Button type="submit" disabled={isSubmitting || !isValid}>
                {isSubmitting ? "Verifying..." : "Verify email"}
              </Button>
            </div>
          </form>
        </CardContent>
      </AuthCard>
    </>
  );
}

export default function EmailVerificationPage() {
  return (
    <Suspense fallback={null}>
      <EmailVerificationForm />
    </Suspense>
  );
}
