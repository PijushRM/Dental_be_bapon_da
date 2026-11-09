import type { z } from "zod";
import { HttpError } from "@/lib/http";
import { nameKey, phoneKey, type newPatientSchema } from "@/lib/validation";
import { PatientModel } from "@/models/Patient";

type NewPatient = z.infer<typeof newPatientSchema>;

// Reuses the doctor's patient with the same name + phone, else creates one (race-safe upsert).
export async function findOrCreatePatient(doctorId: string, input: NewPatient) {
  const keys = { doctorId, nameKey: nameKey(input.name), phoneKey: phoneKey(input.phone) };
  const result = await PatientModel.findOneAndUpdate(
    keys,
    { $setOnInsert: { ...keys, name: input.name, age: input.age, phone: input.phone, email: input.email } },
    { upsert: true, new: true, includeResultMetadata: true },
  );
  if (!result.value) throw new Error("Upsert returned no patient");
  return { patient: result.value, created: !result.lastErrorObject?.updatedExisting };
}

export async function ownedPatient(doctorId: string, patientId: string) {
  const patient = await PatientModel.findOne({ _id: patientId, doctorId });
  if (!patient) throw new HttpError(404, "Patient not found");
  return patient;
}
