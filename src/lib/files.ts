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
  const name = (file.name || "file").slice(0, 200);
  const upload = (await bucket()).openUploadStream(name, {
    metadata: { doctorId, mimeType: file.type },
  });
  const buffer = Buffer.from(await file.arrayBuffer());
  await new Promise<void>((resolve, reject) => {
    upload.once("finish", () => resolve());
    upload.once("error", reject);
    upload.end(buffer);
  });
  return { fileId: upload.id.toString(), name, size: file.size, mimeType: file.type };
}

export async function deleteFile(fileId: string) {
  await (await bucket()).delete(new ObjectId(fileId)).catch(() => undefined);
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
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.filename)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

// Reads a multipart field that must be a file, if present.
export function formFile(form: FormData, field: string): File | null {
  const value = form.get(field);
  if (value === null || value === "") return null;
  if (!(value instanceof File)) throw new HttpError(400, `${field} must be a file`);
  return value;
}
