import { handle, readJson } from "@/lib/http";
import { findOrCreatePatient, ownedPatient } from "@/lib/patients";
import { authed } from "@/lib/session";
import { newAppointmentSchema, objectId, rangeQuerySchema } from "@/lib/validation";
import { AppointmentModel } from "@/models/Appointment";

// Two bookings closer than this overlap (the app shows a warning, not a block).
const CLASH_WINDOW_MS = 30 * 60 * 1000;

// ?from=&to= (ISO, inclusive/exclusive) and/or ?patientId=. Includes the patient.
export const GET = handle(async (request: Request) => {
  const doctorId = await authed(request);
  const query = rangeQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const filter: Record<string, unknown> = { doctorId };
  if (query.from || query.to) {
    filter.startsAt = {
      ...(query.from && { $gte: query.from }),
      ...(query.to && { $lt: query.to }),
    };
  }
  if (query.patientId) filter.patientId = objectId(query.patientId, "patientId");
  const appointments = await AppointmentModel.find(filter)
    .sort({ startsAt: 1 })
    .limit(1000)
    .populate("patientId", "name age phone email createdAt");
  return Response.json({ data: appointments.map(withPatient) });
});

// Body: { startsAt, patientId } or { startsAt, patient: { name, age, phone, email } }.
// A new patient is matched by name + phone, else created. Overlaps are allowed but reported.
export const POST = handle(async (request: Request) => {
  const doctorId = await authed(request);
  const input = newAppointmentSchema.parse(await readJson(request));
  const { patient, created } = input.patientId
    ? { patient: await ownedPatient(doctorId, objectId(input.patientId, "patientId")), created: false }
    : await findOrCreatePatient(doctorId, input.patient!);

  const at = input.startsAt.getTime();
  const [appointment, overlaps] = await Promise.all([
    AppointmentModel.create({ doctorId, patientId: patient._id, startsAt: input.startsAt }),
    AppointmentModel.find({
      doctorId,
      startsAt: { $gt: new Date(at - CLASH_WINDOW_MS), $lt: new Date(at + CLASH_WINDOW_MS) },
    }).select("startsAt"),
  ]);

  return Response.json(
    {
      data: { appointment, patient, patientCreated: created },
      warnings: {
        overlaps: overlaps.filter((o) => !o._id.equals(appointment._id)).map((o) => o.startsAt),
        inPast: at <= Date.now(),
      },
    },
    { status: 201 },
  );
});

type Populated = { toJSON(): Record<string, unknown> };
function withPatient(a: Populated) {
  const { patientId, ...rest } = a.toJSON() as { patientId: Record<string, unknown> | null };
  return { ...rest, patientId: patientId?.id ?? null, patient: patientId };
}
