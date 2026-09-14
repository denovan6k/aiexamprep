"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { showError, showSuccess } from "@/lib/toast";
import { asRoute } from "@/lib/utils";
import { signUpSchema } from "@/lib/validation";

type SignUpFormValues = z.infer<typeof signUpSchema>;

export default function SignUpPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", password: "" }
  });

  async function onSubmit(values: SignUpFormValues) {
    setError(null);
    try {
      await signUp(values.fullName ?? "", values.email, values.password);
      showSuccess("Account created. Check your email for a verification code.");
      router.push(asRoute(`/email-verification?email=${encodeURIComponent(values.email)}`));
    } catch (err) {
      const message = getClientErrorMessage(err, "Account creation failed.");
      setError(message);
      showError(message);
    }
  }

  return (
    <>
      <AuthCard>
        <CardHeader className="pb-4">
          <CardTitle className="sr-only">Sign up</CardTitle>
          <CardDescription>Free plan includes core study workflows.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="space-y-2">
              <Label htmlFor="full-name">Full name</Label>
              <Input id="full-name" placeholder="Your name" autoComplete="name" {...register("fullName")} aria-invalid={Boolean(errors.fullName)} />
              {errors.fullName ? <p className="text-sm font-medium text-danger">{errors.fullName.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" autoComplete="email" {...register("email")} aria-invalid={Boolean(errors.email)} />
              {errors.email ? <p className="text-sm font-medium text-danger">{errors.email.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput id="password" placeholder="Create a password" autoComplete="new-password" {...register("password")} aria-invalid={Boolean(errors.password)} />
              {errors.password ? <p className="text-sm font-medium text-danger">{errors.password.message}</p> : null}
            </div>
            {/* School picker disabled until institution list is wired up in sign-up flow.
            <div className="space-y-2">
              <Label htmlFor="school">School (optional)</Label>
              <Select ... />
            </div>
            */}
            {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create account"}
            </Button>
          </form>
        </CardContent>
      </AuthCard>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
