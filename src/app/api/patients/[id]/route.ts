import { handle } from "@/lib/http";
import { ownedPatient } from "@/lib/patients";
import { authed } from "@/lib/session";
import { objectId } from "@/lib/validation";
import { AppointmentModel } from "@/models/Appointment";
import { RecordEntryModel } from "@/models/RecordEntry";

// Patient Profile: the patient, their appointments and their record entries.
export const GET = handle(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const doctorId = await authed(request);
    const id = objectId((await params).id, "patient id");
    const patient = await ownedPatient(doctorId, id);
    const [appointments, entries] = await Promise.all([
      AppointmentModel.find({ doctorId, patientId: id }).sort({ startsAt: -1 }),
      RecordEntryModel.find({ doctorId, patientId: id }).sort({ at: -1 }),
    ]);
    return Response.json({ data: { patient, appointments, entries } });
  },
);
