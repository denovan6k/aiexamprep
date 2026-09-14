import { z } from "zod";

export const emailSchema = z.string().trim().email("Enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be 128 characters or fewer.");

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit verification code.");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required.")
});

export const signUpSchema = z.object({
  fullName: z.string().trim().max(120, "Full name must be 120 characters or fewer.").optional(),
  email: emailSchema,
  password: passwordSchema
});

export const forgotPasswordSchema = z.object({
  email: emailSchema
});

export const emailVerificationSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema
});

export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    code: otpCodeSchema,
    newPassword: passwordSchema,
    confirmPassword: passwordSchema
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"]
  });

export const createAgentSchema = z.object({
  name: z.string().trim().max(120, "Name must be 120 characters or fewer.").optional(),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters.")
    .max(4000, "Description must be 4,000 characters or fewer.")
});

export const updateAgentSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(255),
  description: z.string().trim().max(4000).optional(),
  subject_area: z.string().trim().max(255).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  marking_strictness: z.enum(["lenient", "standard", "strict"]).optional(),
  feedback_tone: z.enum(["encouraging", "neutral", "direct"]).optional(),
  intro_message: z.string().trim().max(4000).optional(),
  capabilities_summary: z.string().trim().max(512).optional(),
  favorite_topics: z.string().optional(),
  common_traps: z.string().optional()
});

export const createCourseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Course title is required.")
    .max(160, "Course title must be 160 characters or fewer."),
  description: z.string().trim().max(1000, "Description must be 1,000 characters or fewer.").optional()
});

export const onboardingProfileSchema = z.object({
  study_goal: z
    .string()
    .trim()
    .min(3, "Enter a study goal at least 3 characters.")
    .max(255, "Study goal must be 255 characters or fewer."),
  daily_minutes: z.coerce
    .number()
    .int("Daily minutes must be a whole number.")
    .min(5, "Minimum 5 minutes per day.")
    .max(480, "Maximum 480 minutes per day.")
});

export const onboardingCourseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Course name is required.")
    .max(160, "Course name must be 160 characters or fewer."),
  exam_date: z.string().min(1, "Exam date is required."),
  confidence_level: z.enum(["low", "medium", "high"], {
    required_error: "Select your current confidence."
  })
});

export const apiKeySchema = z.object({
  provider: z.enum(["openai", "anthropic"]),
  label: z.string().trim().max(80, "Label must be 80 characters or fewer.").optional(),
  apiKey: z.string().trim().min(12, "Enter a valid API key.")
});

