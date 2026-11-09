import { HttpError, handle } from "@/lib/http";
import { authed } from "@/lib/session";
import { objectId } from "@/lib/validation";
import { AppointmentModel } from "@/models/Appointment";
import { PatientModel } from "@/models/Patient";

// Appointment Saved screen: the booking and its patient.
export const GET = handle(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const doctorId = await authed(request);
    const id = objectId((await params).id, "appointment id");
    const appointment = await AppointmentModel.findOne({ _id: id, doctorId });
    if (!appointment) throw new HttpError(404, "Appointment not found");
    const patient = await PatientModel.findOne({ _id: appointment.patientId, doctorId });
    return Response.json({ data: { appointment, patient } });
  },
);
