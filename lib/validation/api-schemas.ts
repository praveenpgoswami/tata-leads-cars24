/**
 * zod schemas for the app's own API requests and responses and its forms.
 *
 * Exports: `modeSchema`, `Mode`, `SEND_BATCH_SIZE`, `sendRequestSchema`, `SendRequest`,
 * `sendRowResultSchema`, `SendRowResult`, `sendResponseSchema`, `SendResponse`,
 * `loginSchema`, `changePasswordSchema`, `ChangePasswordInput`, `PASSWORD_MIN_LENGTH`.
 *
 * Notes: Shared by client and server; the server always re-validates.
 */
import { z } from "zod";
import { leadCellsInputSchema } from "./lead-row";

export const modeSchema = z.enum(["dev", "live"]);
export type Mode = z.infer<typeof modeSchema>;

/** Rows per `/api/leads/send` request. Keeps each request well inside the function timeout. */
export const SEND_BATCH_SIZE = 10;

export const sendRequestSchema = z.object({
  mode: modeSchema,
  rows: z
    .array(
      z.object({
        rowNumber: z.number().int().positive(),
        cells: leadCellsInputSchema,
      }),
    )
    .min(1)
    .max(SEND_BATCH_SIZE)
    .refine((rows) => new Set(rows.map((row) => row.rowNumber)).size === rows.length, "Duplicate row numbers"),
});
export type SendRequest = z.infer<typeof sendRequestSchema>;

export const sendRowResultSchema = z.object({
  rowNumber: z.number().int(),
  status: z.enum(["sent", "failed"]),
  message: z.string(),
  httpStatus: z.number().int().nullable(),
  dryRun: z.boolean(),
});
export type SendRowResult = z.infer<typeof sendRowResultSchema>;

export const sendResponseSchema = z.object({ results: z.array(sendRowResultSchema) });
export type SendResponse = z.infer<typeof sendResponseSchema>;

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username").max(100),
  password: z.string().min(1, "Enter your password").max(200),
});

export const PASSWORD_MIN_LENGTH = 8;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(200),
    newPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `New password must be at least ${PASSWORD_MIN_LENGTH} characters`)
      .max(200, "New password must be at most 200 characters"),
    confirmPassword: z.string().max(200),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword !== value.confirmPassword) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" });
    }
    if (value.currentPassword && value.newPassword === value.currentPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "New password must be different from the current password",
      });
    }
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
