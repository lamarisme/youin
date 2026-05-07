import { z } from "zod";

export const emailSchema = z
  .string()
  .email("Please enter a valid email address")
  .min(1, "Email is required");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be less than 128 characters");

export const nameSchema = z
  .string()
  .min(2, "Name must be at least 2 characters")
  .max(80, "Name must be less than 80 characters");

export const workspaceNameSchema = z
  .string()
  .min(2, "Workspace name must be at least 2 characters")
  .max(80, "Workspace name must be less than 80 characters");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const signUpSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  agreedToTerms: z.literal(true, {
    message: "You must agree to the terms",
  }),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

export const newMarkSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(180, "Title must be less than 180 characters"),
  page: z
    .string()
    .min(1, "Page path is required")
    .max(300, "Page path must be less than 300 characters"),
  description: z
    .string()
    .max(3000, "Description must be less than 3000 characters")
    .default(""),
  labelIds: z.array(z.string()).default([]),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  assigneeId: z.string().nullable().default(null),
});

export const commentSchema = z.object({
  body: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(5000, "Comment must be less than 5000 characters"),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type NewMarkInput = z.infer<typeof newMarkSchema>;
export type CommentInput = z.infer<typeof commentSchema>;
