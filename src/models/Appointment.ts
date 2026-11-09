import { Schema, Types, model, models, type InferSchemaType, type Model } from "mongoose";
import { cleanJSON } from "@/models/toJSON";

const AppointmentSchema = new Schema(
  {
    doctorId: { type: Types.ObjectId, ref: "Doctor", required: true },
    patientId: { type: Types.ObjectId, ref: "Patient", required: true, index: true },
    startsAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
AppointmentSchema.index({ doctorId: 1, startsAt: 1 });
cleanJSON(AppointmentSchema, ["doctorId"]);

export type Appointment = InferSchemaType<typeof AppointmentSchema>;

export const AppointmentModel: Model<Appointment> =
  (models.Appointment as Model<Appointment>) ||
  model<Appointment>("Appointment", AppointmentSchema);
