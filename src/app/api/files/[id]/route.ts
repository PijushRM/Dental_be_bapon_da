import { fileResponse } from "@/lib/files";
import { handle } from "@/lib/http";
import { authed } from "@/lib/session";
import { objectId } from "@/lib/validation";

// Streams an uploaded file (record attachment or profile photo) to its owner.
export const GET = handle(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const doctorId = await authed(request);
    return fileResponse(objectId((await params).id, "file id"), doctorId);
  },
);
