import { handle, readJson } from "@/lib/http";
import { findOrCreatePatient } from "@/lib/patients";
import { authed } from "@/lib/session";
import { escapeRegex, newPatientSchema, phoneDigits } from "@/lib/validation";
import { PatientModel } from "@/models/Patient";

// ?q= matches name, or phone digits (3+). Newest first.
export const GET = handle(async (request: Request) => {
  const doctorId = await authed(request);
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const filter: Record<string, unknown> = { doctorId };
  if (q) {
    const digits = phoneDigits(q);
    filter.$or = [
      { name: { $regex: escapeRegex(q), $options: "i" } },
      ...(digits.length >= 3 ? [{ phoneKey: { $regex: escapeRegex(digits) } }] : []),
    ];
  }
  const patients = await PatientModel.find(filter).sort({ createdAt: -1 }).limit(500);
  return Response.json({ data: patients });
});

// Find-or-create by name + phone; 201 when new, 200 when an existing patient matched.
export const POST = handle(async (request: Request) => {
  const doctorId = await authed(request);
  const input = newPatientSchema.parse(await readJson(request));
  const { patient, created } = await findOrCreatePatient(doctorId, input);
  return Response.json({ data: patient, created }, { status: created ? 201 : 200 });
});
