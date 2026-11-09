import { Schema, model, models, type HydratedDocument, type InferSchemaType, type Model } from "mongoose";
import { cleanJSON } from "@/models/toJSON";

// One doctor account plus its profile (the app's auth + doctor stores).
const DoctorSchema = new Schema(
  {
    identifier: { type: String, required: true, unique: true }, // email or registration ID, lowercased
    passwordHash: { type: String, required: true },
    // Login tokens issued before this are rejected, so changing the password
    // signs out every other phone.
    passwordChangedAt: { type: Date, default: null },
    name: { type: String, default: "" },
    qualifications: { type: String, default: "" },
    speciality: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    clinicName: { type: String, default: "" },
    opens: { type: Number, default: 9 * 60 }, // minutes from midnight
    closes: { type: Number, default: 18 * 60 },
    workingDays: { type: [Boolean], default: [false, true, true, true, true, true, true] }, // Sunday first
    photoFileId: { type: String, default: "" },
    alerts: { type: Boolean, default: false },
  },
  { timestamps: true },
);
cleanJSON(DoctorSchema, ["passwordHash", "passwordChangedAt"]);

export type Doctor = InferSchemaType<typeof DoctorSchema>;
export type DoctorDoc = HydratedDocument<Doctor>;

export const DoctorModel: Model<Doctor> =
  (models.Doctor as Model<Doctor>) || model<Doctor>("Doctor", DoctorSchema);

// The shape the app's Profile screens read (DoctorProfile + alerts).
export function profileOf(doctor: DoctorDoc) {
  return {
    id: doctor.id as string,
    identifier: doctor.identifier,
    name: doctor.name,
    qualifications: doctor.qualifications,
    speciality: doctor.speciality,
    email: doctor.email,
    phone: doctor.phone,
    clinicName: doctor.clinicName,
    opens: doctor.opens,
    closes: doctor.closes,
    workingDays: doctor.workingDays,
    photoUrl: doctor.photoFileId ? `/api/files/${doctor.photoFileId}` : "",
    alerts: doctor.alerts,
  };
}
