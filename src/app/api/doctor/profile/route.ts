import { HttpError, handle, readJson } from "@/lib/http";
import { authedDoctor } from "@/lib/session";
import { profilePatchSchema } from "@/lib/validation";
import { profileOf } from "@/models/Doctor";

export const GET = handle(async (request: Request) => {
  return Response.json({ doctor: profileOf(await authedDoctor(request)) });
});

// Partial update: Edit Profile parts 1 and 2, and the Settings alerts toggle.
export const PATCH = handle(async (request: Request) => {
  const doctor = await authedDoctor(request);
  const changes = profilePatchSchema.parse(await readJson(request));
  const opens = changes.opens ?? doctor.opens;
  const closes = changes.closes ?? doctor.closes;
  if (closes <= opens) {
    throw new HttpError(400, "Validation failed", {
      closes: "Closing time must be after opening time.",
    });
  }
  doctor.set(changes);
  await doctor.save();
  return Response.json({ doctor: profileOf(doctor) });
});
