import { handle } from "@/lib/http";
import { authedDoctor } from "@/lib/session";
import { profileOf } from "@/models/Doctor";

export const GET = handle(async (request: Request) => {
  return Response.json({ doctor: profileOf(await authedDoctor(request)) });
});
