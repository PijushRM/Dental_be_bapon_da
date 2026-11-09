import { verifyFileToken } from "@/lib/auth";
import { fileResponse } from "@/lib/files";
import { handle } from "@/lib/http";
import { connectDB } from "@/lib/mongodb";
import { authed } from "@/lib/session";
import { objectId } from "@/lib/validation";

// Streams an uploaded file (record attachment or profile photo) to its owner.
// Auth: "Authorization: Bearer <token>", or ?sig= from GET /api/files/:id/link.
export const GET = handle(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const fileId = objectId((await params).id, "file id");
    const sig = new URL(request.url).searchParams.get("sig");
    let doctorId: string;
    if (sig) {
      doctorId = await verifyFileToken(sig, fileId);
      await connectDB();
    } else {
      doctorId = await authed(request);
    }
    return fileResponse(fileId, doctorId);
  },
);
