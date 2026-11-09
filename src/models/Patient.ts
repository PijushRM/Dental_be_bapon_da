import { Schema, Types, model, models, type InferSchemaType, type Model } from "mongoose";
import { cleanJSON } from "@/models/toJSON";

const PatientSchema = new Schema(
  {
    doctorId: { type: Types.ObjectId, ref: "Doctor", required: true },
    name: { type: String, required: true },
    age: { type: Number, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: "" },
    // Match keys: the same name AND the same last-10-digit phone is the same patient
    // (families share phones, so phone alone would merge parent and child).
    nameKey: { type: String, required: true },
    phoneKey: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
PatientSchema.index({ doctorId: 1, nameKey: 1, phoneKey: 1 }, { unique: true });
// Sync and the patient list read a doctor's patients by creation date.
PatientSchema.index({ doctorId: 1, createdAt: -1 });
export const PATIENT_HIDDEN = ["doctorId", "nameKey", "phoneKey"] as const;
cleanJSON(PatientSchema, PATIENT_HIDDEN);

export type Patient = InferSchemaType<typeof PatientSchema>;

export const PatientModel: Model<Patient> =
  (models.Patient as Model<Patient>) || model<Patient>("Patient", PatientSchema);
