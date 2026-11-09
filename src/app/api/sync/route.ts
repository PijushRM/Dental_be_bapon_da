import { handle } from "@/lib/http";
import { authedDoctor } from "@/lib/session";
import { APPOINTMENT_HIDDEN, AppointmentModel } from "@/models/Appointment";
import { profileOf } from "@/models/Doctor";
import { PATIENT_HIDDEN, PatientModel } from "@/models/Patient";
import { RecordEntryModel, entryToClient } from "@/models/RecordEntry";
import { toClient } from "@/models/toJSON";

// Everything the app's stores hold, in one call (for app start / pull-to-refresh).
// Plain objects (`lean`) skip building full Mongoose documents: this is the app's busiest call.
export const GET = handle(async (request: Request) => {
  const doctor = await authedDoctor(request);
  const doctorId = doctor._id;
  const [patients, appointments, entries] = await Promise.all([
    PatientModel.find({ doctorId }).sort({ createdAt: 1 }).lean(),
    AppointmentModel.find({ doctorId }).sort({ startsAt: 1 }).lean(),
    RecordEntryModel.find({ doctorId }).sort({ at: 1 }).lean(),
  ]);
  return Response.json({
    doctor: profileOf(doctor),
    patients: patients.map((p) => toClient(p, PATIENT_HIDDEN)),
    appointments: appointments.map((a) => toClient(a, APPOINTMENT_HIDDEN)),
    entries: entries.map((e) => entryToClient(e)),
  });
});
