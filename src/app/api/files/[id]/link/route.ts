import { signFileToken } from "@/lib/auth";
import { assertFileOwner } from "@/lib/files";
import { handle } from "@/lib/http";
import { authed } from "@/lib/session";
import { objectId } from "@/lib/validation";

// A 5-minute link to one file, for opening it in a browser or viewer app.
export const GET = handle(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const doctorId = await authed(request);
    const fileId = objectId((await params).id, "file id");
    await assertFileOwner(fileId, doctorId);
    const sig = await signFileToken(doctorId, fileId);
    return Response.json({ url: `/api/files/${fileId}?sig=${encodeURIComponent(sig)}`, expiresIn: 300 });
  },
);
