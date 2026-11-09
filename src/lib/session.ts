import { requireSession, revokedBy } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import { connectDB } from "@/lib/mongodb";
import { DoctorModel } from "@/models/Doctor";

const SIGNED_OUT = "Your session has ended. Please log in again.";

// Authenticated doctor id, with the DB connected. The account must still exist
// and the token must be newer than the last password change.
export async function authed(request: Request): Promise<string> {
  const { doctorId, issuedAt } = await requireSession(request);
  await connectDB();
  const doctor = await DoctorModel.findById(doctorId).select("passwordChangedAt").lean();
  if (!doctor) throw new HttpError(401, "Account no longer exists");
  if (revokedBy(doctor.passwordChangedAt, issuedAt)) throw new HttpError(401, SIGNED_OUT);
  return doctorId;
}

export async function authedDoctor(request: Request) {
  const { doctorId, issuedAt } = await requireSession(request);
  await connectDB();
  const doctor = await DoctorModel.findById(doctorId);
  if (!doctor) throw new HttpError(401, "Account no longer exists");
  if (revokedBy(doctor.passwordChangedAt, issuedAt)) throw new HttpError(401, SIGNED_OUT);
  return doctor;
}
