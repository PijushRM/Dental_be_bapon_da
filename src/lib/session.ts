import { requireDoctorId } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import { connectDB } from "@/lib/mongodb";
import { DoctorModel } from "@/models/Doctor";

// Authenticated doctor id, with the DB connected.
export async function authed(request: Request): Promise<string> {
  const doctorId = await requireDoctorId(request);
  await connectDB();
  return doctorId;
}

export async function authedDoctor(request: Request) {
  const doctorId = await authed(request);
  const doctor = await DoctorModel.findById(doctorId);
  if (!doctor) throw new HttpError(401, "Account no longer exists");
  return doctor;
}
