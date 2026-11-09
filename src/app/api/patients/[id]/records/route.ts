import { deleteFile, formFile, readUploadForm, saveUpload } from "@/lib/files";
import { HttpError, handle } from "@/lib/http";
import { ownedPatient } from "@/lib/patients";
import { authed } from "@/lib/session";
import { ACCEPTED_MIME_TYPES, DOC_TYPES, objectId } from "@/lib/validation";
import { RecordEntryModel } from "@/models/RecordEntry";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (request: Request, { params }: Ctx) => {
  const doctorId = await authed(request);
  const patientId = objectId((await params).id, "patient id");
  await ownedPatient(doctorId, patientId);
  const entries = await RecordEntryModel.find({ doctorId, patientId }).sort({ at: -1 });
  return Response.json({ data: entries });
});

// multipart/form-data: type = prescription | report | xray | other | note,
// file (PDF/JPG/PNG, needed unless type is "note"), note (needed when type is "note").
export const POST = handle(async (request: Request, { params }: Ctx) => {
  const doctorId = await authed(request);
  const patientId = objectId((await params).id, "patient id");
  await ownedPatient(doctorId, patientId);

  const form = await readUploadForm(request);
  const type = String(form.get("type") ?? "");
  const note = String(form.get("note") ?? "").trim();
  const file = formFile(form, "file");

  if (type !== "note" && !(DOC_TYPES as readonly string[]).includes(type)) {
    throw new HttpError(400, "Validation failed", {
      type: `type must be one of: ${[...DOC_TYPES, "note"].join(", ")}`,
    });
  }
  if (type === "note" && !note) {
    throw new HttpError(400, "Validation failed", { note: "Write the note first." });
  }
  if (type !== "note" && !file) {
    throw new HttpError(400, "Validation failed", { file: "Add a photo or file first." });
  }

  const stored = type !== "note" && file ? await saveUpload(file, doctorId, ACCEPTED_MIME_TYPES) : null;
  try {
    const entry = await RecordEntryModel.create({
      doctorId,
      patientId,
      docType: type === "note" ? null : (type as (typeof DOC_TYPES)[number]),
      file: stored,
      note,
    });
    return Response.json({ data: entry }, { status: 201 });
  } catch (err) {
    if (stored) await deleteFile(stored.fileId);
    throw err;
  }
});
