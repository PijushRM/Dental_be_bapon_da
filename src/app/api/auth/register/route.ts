import { hashPassword, signToken } from "@/lib/auth";
import { HttpError, handle, readJson } from "@/lib/http";
import { connectDB } from "@/lib/mongodb";
import { credentialsSchema } from "@/lib/validation";
import { DoctorModel, profileOf } from "@/models/Doctor";

export const POST = handle(async (request: Request) => {
  const { identifier, password } = credentialsSchema.parse(await readJson(request));
  await connectDB();
  if (await DoctorModel.exists({ identifier })) {
    throw new HttpError(409, "An account with this email or registration ID already exists.");
  }
  const doctor = await DoctorModel.create({
    identifier,
    passwordHash: await hashPassword(password),
    email: identifier.includes("@") ? identifier : "",
  });
  return Response.json(
    { token: await signToken(doctor.id), doctor: profileOf(doctor) },
    { status: 201 },
  );
});
