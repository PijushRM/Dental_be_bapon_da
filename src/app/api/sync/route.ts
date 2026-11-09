import { handle } from "@/lib/http";
import { authedDoctor } from "@/lib/session";
import { AppointmentModel } from "@/models/Appointment";
import { profileOf } from "@/models/Doctor";
import { PatientModel } from "@/models/Patient";
import { RecordEntryModel } from "@/models/RecordEntry";

// Everything the app's stores hold, in one call (for app start / pull-to-refresh).
export const GET = handle(async (request: Request) => {
  const doctor = await authedDoctor(request);
  const doctorId = doctor._id;
  const [patients, appointments, entries] = await Promise.all([
    PatientModel.find({ doctorId }).sort({ createdAt: 1 }),
    AppointmentModel.find({ doctorId }).sort({ startsAt: 1 }),
    RecordEntryModel.find({ doctorId }).sort({ at: 1 }),
  ]);
  return Response.json({ doctor: profileOf(doctor), patients, appointments, entries });
});
