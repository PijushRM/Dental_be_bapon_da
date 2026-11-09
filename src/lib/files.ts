import { Readable } from "node:stream";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { HttpError } from "@/lib/http";
import { MAX_FILE_BYTES } from "@/lib/validation";

const { GridFSBucket, ObjectId } = mongoose.mongo;
type GridFSBucket = InstanceType<typeof GridFSBucket>;

const BUCKET = "files";

async function bucket(): Promise<GridFSBucket> {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB connection has no db handle");
  return new GridFSBucket(db, { bucketName: BUCKET });
}

export type StoredFileMeta = { fileId: string; name: string; size: number; mimeType: string };

// Checks size and type, then streams the upload into GridFS, tagged with its owner.
export async function saveUpload(
  file: File,
  doctorId: string,
  allowedTypes: string[],
): Promise<StoredFileMeta> {
  if (!allowedTypes.includes(file.type)) {
    throw new HttpError(415, `File type must be one of: ${allowedTypes.join(", ")}`);
  }
  if (file.size === 0) throw new HttpError(400, "File is empty");
  if (file.size > MAX_FILE_BYTES) {
    throw new HttpError(413, `File must be ${MAX_FILE_BYTES / (1024 * 1024)} MB or smaller`);
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!matchesSignature(buffer, file.type)) {
    throw new HttpError(415, "File content doesn't match its type");
  }
  const name = (file.name || "file").slice(0, 200);
  const upload = (await bucket()).openUploadStream(name, {
    metadata: { doctorId, mimeType: file.type },
  });
  await new Promise<void>((resolve, reject) => {
    upload.once("finish", () => resolve());
    upload.once("error", reject);
    upload.end(buffer);
  });
  return { fileId: upload.id.toString(), name, size: file.size, mimeType: file.type };
}

// The client-declared type is checked against the file's first bytes, since files are
// served back inline with that type.
const SIGNATURES: Record<string, number[]> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46], // %PDF
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

function matchesSignature(buffer: Buffer, mimeType: string): boolean {
  const sig = SIGNATURES[mimeType];
  return !sig || sig.every((byte, i) => buffer[i] === byte);
}

export async function deleteFile(fileId: string) {
  await (await bucket()).delete(new ObjectId(fileId)).catch(() => undefined);
}

export async function assertFileOwner(fileId: string, doctorId: string) {
  const [doc] = await (await bucket()).find({ _id: new ObjectId(fileId) }).limit(1).toArray();
  if (!doc || doc.metadata?.doctorId !== doctorId) throw new HttpError(404, "File not found");
}

// Streams a stored file back, only to the doctor who owns it.
export async function fileResponse(fileId: string, doctorId: string): Promise<Response> {
  const b = await bucket();
  const _id = new ObjectId(fileId);
  const [doc] = await b.find({ _id }).limit(1).toArray();
  if (!doc || doc.metadata?.doctorId !== doctorId) throw new HttpError(404, "File not found");
  const stream = Readable.toWeb(b.openDownloadStream(_id)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": doc.metadata?.mimeType ?? "application/octet-stream",
      "Content-Length": String(doc.length),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

// Multipart overhead allowed on top of the file itself (other fields, boundaries).
const FORM_OVERHEAD_BYTES = 1024 * 1024;

// Parses a multipart upload. Rejects oversized bodies before buffering them in memory,
// and turns a malformed body into a 400 instead of a 500.
export async function readUploadForm(request: Request): Promise<FormData> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_FILE_BYTES + FORM_OVERHEAD_BYTES) {
    throw new HttpError(413, `File must be ${MAX_FILE_BYTES / (1024 * 1024)} MB or smaller`);
  }
  try {
    return await request.formData();
  } catch {
    throw new HttpError(400, "Body must be multipart/form-data");
  }
}

// Reads a multipart field that must be a file, if present.
export function formFile(form: FormData, field: string): File | null {
  const value = form.get(field);
  if (value === null || value === "") return null;
  if (!(value instanceof File)) throw new HttpError(400, `${field} must be a file`);
  return value;
}
