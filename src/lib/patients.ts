import type { z } from "zod";
import { HttpError, isDuplicateKey } from "@/lib/http";
import { nameKey, phoneKey, type newPatientSchema } from "@/lib/validation";
import { PatientModel } from "@/models/Patient";

type NewPatient = z.infer<typeof newPatientSchema>;

// Reuses the doctor's patient with the same name + phone, else creates one (race-safe upsert).
// Two concurrent upserts for the same patient can both try to insert; the loser gets
// E11000, and retrying once finds the winner's document.
export async function findOrCreatePatient(doctorId: string, input: NewPatient) {
  try {
    return await upsertPatient(doctorId, input);
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    return upsertPatient(doctorId, input);
  }
}

async function upsertPatient(doctorId: string, input: NewPatient) {
  const keys = { doctorId, nameKey: nameKey(input.name), phoneKey: phoneKey(input.phone) };
  const result = await PatientModel.findOneAndUpdate(
    keys,
    { $setOnInsert: { ...keys, name: input.name, age: input.age, phone: input.phone, email: input.email } },
    { upsert: true, returnDocument: "after", includeResultMetadata: true },
  );
  if (!result.value) throw new Error("Upsert returned no patient");
  return { patient: result.value, created: !result.lastErrorObject?.updatedExisting };
}

export async function ownedPatient(doctorId: string, patientId: string) {
  const patient = await PatientModel.findOne({ _id: patientId, doctorId });
  if (!patient) throw new HttpError(404, "Patient not found");
  return patient;
}
