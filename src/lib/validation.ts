import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { HttpError } from "@/lib/http";

// Rules copied from the app (src/features/patients/patientDraft.ts,
// src/features/doctor/profileForm.ts, src/features/auth/credentials.ts).
export const MIN_PASSWORD_LENGTH = 6;
export const MAX_AGE = 120;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const tidy = (text: string) => text.trim().replace(/\s+/g, " ");
export const phoneDigits = (phone: string) => phone.replace(/\D/g, "");
// Last 10 digits, so "+91 98300 12345" equals "9830012345".
export const phoneKey = (phone: string) => phoneDigits(phone).slice(-10);
export const nameKey = (name: string) => tidy(name).toLowerCase();
export const normalizeIdentifier = (identifier: string) => identifier.trim().toLowerCase();

export const isValidPhone = (phone: string) => {
  const digits = phoneDigits(phone).length;
  return /^[+\d\s()-]+$/.test(phone) && digits >= 10 && digits <= 13;
};

const phone = z.string().trim().refine(isValidPhone, "Enter a valid phone number.");
const optionalEmail = z
  .string()
  .trim()
  .refine((v) => v === "" || EMAIL.test(v), "Enter a valid email or leave it blank.");
const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidPhone(v), "Enter a valid phone number or leave it blank.");
const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
const isoDate = z.iso.datetime({ offset: true }).transform((v) => new Date(v));

export const credentialsSchema = z.object({
  identifier: z
    .string()
    .transform(normalizeIdentifier)
    .refine((v) => v.length > 0, "Enter your email or registration ID."),
  password,
});

export const changePasswordSchema = z
  .object({ current: z.string(), next: password, confirm: z.string() })
  .refine((v) => v.next === v.confirm, {
    path: ["confirm"],
    message: "The new passwords don’t match.",
  });

export const newPatientSchema = z.object({
  name: z
    .string()
    .transform(tidy)
    .refine((v) => v.length >= 2, "Enter the patient’s full name."),
  age: z.coerce.number().int().min(0).max(MAX_AGE, `Age 0–${MAX_AGE}`),
  phone,
  email: optionalEmail.default(""),
});

export const newAppointmentSchema = z
  .object({
    patientId: z.string().optional(),
    patient: newPatientSchema.optional(),
    startsAt: isoDate,
  })
  .refine((v) => Boolean(v.patientId) !== Boolean(v.patient), {
    message: "Send either patientId or patient, not both.",
    path: ["patient"],
  });

const minutesOfDay = z.number().int().min(0).max(24 * 60);

export const profilePatchSchema = z
  .object({
    name: z
      .string()
      .transform(tidy)
      .refine((v) => v.length >= 2, "Enter your name."),
    qualifications: z.string().transform(tidy),
    speciality: z.string().transform(tidy),
    email: optionalEmail,
    phone: optionalPhone,
    clinicName: z.string().transform(tidy),
    opens: minutesOfDay,
    closes: minutesOfDay,
    workingDays: z
      .array(z.boolean())
      .length(7)
      .refine((d) => d.some(Boolean), "Pick at least one working day."),
    alerts: z.boolean(),
  })
  .partial()
  .strict();

export const DOC_TYPES = ["prescription", "report", "xray", "other"] as const;
export const ACCEPTED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png"];
// Largest upload, from MAX_UPLOAD_MB in .env (the app has the same setting);
// missing, zero or not a number falls back to 1 MB.
const DEFAULT_MAX_UPLOAD_MB = 1;
export function parseMaxUploadBytes(value: string | undefined): number {
  const mb = Number(value?.trim() || NaN);
  return Math.round((Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_MAX_UPLOAD_MB) * 1024 * 1024);
}
export const MAX_FILE_BYTES = parseMaxUploadBytes(process.env.MAX_UPLOAD_MB);

export const rangeQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  patientId: z.string().optional(),
});

export function objectId(id: string | null | undefined, what = "id"): string {
  if (!id || !isValidObjectId(id)) throw new HttpError(400, `Invalid ${what}`);
  return id;
}

export function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
