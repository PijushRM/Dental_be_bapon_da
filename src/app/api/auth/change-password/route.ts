import { hashPassword, signToken, verifyPassword } from "@/lib/auth";
import { HttpError, handle, readJson } from "@/lib/http";
import { authedDoctor } from "@/lib/session";
import { changePasswordSchema } from "@/lib/validation";

export const POST = handle(async (request: Request) => {
  const doctor = await authedDoctor(request);
  const body = await readJson(request);
  const current = (body as { current?: unknown })?.current;
  // Check the current password first, like the app does.
  if (typeof current !== "string" || !(await verifyPassword(current, doctor.passwordHash))) {
    throw new HttpError(400, "Your current password is incorrect.", {
      current: "Your current password is incorrect.",
    });
  }
  const { next } = changePasswordSchema.parse(body);
  doctor.passwordHash = await hashPassword(next);
  // Signs out every other phone; this one gets a fresh token below.
  doctor.passwordChangedAt = new Date();
  await doctor.save();
  return Response.json({ ok: true, token: await signToken(doctor.id) });
});
