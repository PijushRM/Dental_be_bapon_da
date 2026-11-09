import { signToken, verifyPassword } from "@/lib/auth";
import { HttpError, handle, readJson } from "@/lib/http";
import { connectDB } from "@/lib/mongodb";
import { credentialsSchema } from "@/lib/validation";
import { DoctorModel, profileOf } from "@/models/Doctor";

export const POST = handle(async (request: Request) => {
  const { identifier, password } = credentialsSchema.parse(await readJson(request));
  await connectDB();
  const doctor = await DoctorModel.findOne({ identifier });
  if (!doctor || !(await verifyPassword(password, doctor.passwordHash))) {
    throw new HttpError(401, "Email/ID or password is incorrect.");
  }
  return Response.json({ token: await signToken(doctor.id), doctor: profileOf(doctor) });
});
