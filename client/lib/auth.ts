import { apiRequest, type ApiUser, type AuthResponse } from "@/lib/api";

export type RegisterResponse = AuthResponse;

export type OtpChallengeResponse = {
  status: string;
  email: string;
  message: string;
  expires_in: number;
};

export type MessageResponse = {
  status: string;
  message: string;
};

export async function registerAccount(payload: {
  email: string;
  password: string;
  fullName?: string;
}) {
  return apiRequest<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
      full_name: payload.fullName || undefined
    })
  });
}

export async function loginAccount(email: string, password: string) {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export async function requestEmailVerificationOtp(email: string) {
  return apiRequest<OtpChallengeResponse>("/auth/email-verification/request", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

export async function confirmEmailVerification(email: string, code: string) {
  return apiRequest<ApiUser>("/auth/email-verification/confirm", {
    method: "POST",
    body: JSON.stringify({ email, code })
  });
}

export async function requestPasswordResetOtp(email: string) {
  return apiRequest<OtpChallengeResponse>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

export async function resetPasswordWithOtp(email: string, code: string, newPassword: string) {
  return apiRequest<MessageResponse>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, code, new_password: newPassword })
  });
}

export async function logoutAccount(token: string) {
  return apiRequest<MessageResponse>("/auth/logout", { method: "POST", token });
}

export async function fetchCurrentUser(token: string) {
  return apiRequest<import("@/lib/api").ApiUser>("/auth/me", { token, cache: "no-store" });
}
