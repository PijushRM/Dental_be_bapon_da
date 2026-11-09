import { Schema, Types, model, models, type InferSchemaType, type Model } from "mongoose";
import { toClient } from "@/models/toJSON";

const StoredFileSchema = new Schema(
  {
    fileId: { type: String, required: true },
    name: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true },
  },
  { _id: false },
);

// An upload or a note on a patient's record ("Add to record").
const RecordEntrySchema = new Schema({
  doctorId: { type: Types.ObjectId, ref: "Doctor", required: true },
  patientId: { type: Types.ObjectId, ref: "Patient", required: true },
  at: { type: Date, required: true, default: () => new Date() },
  docType: { type: String, enum: ["prescription", "report", "xray", "other", null], default: null },
  file: { type: StoredFileSchema, default: null },
  note: { type: String, default: "" },
});
RecordEntrySchema.index({ doctorId: 1, patientId: 1, at: -1 });
// Sync reads all of a doctor's entries by date.
RecordEntrySchema.index({ doctorId: 1, at: 1 });

// Works on a hydrated document's toJSON() output and on a `.lean()` result alike.
export function entryToClient(ret: Record<string, unknown>) {
  const out = toClient(ret, ["doctorId"]);
  const file = out.file as { fileId: string } | null;
  if (file) out.file = { ...file, url: `/api/files/${file.fileId}` };
  return out;
}

RecordEntrySchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret: Record<string, unknown>) => entryToClient(ret),
});

export type RecordEntry = InferSchemaType<typeof RecordEntrySchema>;

export const RecordEntryModel: Model<RecordEntry> =
  (models.RecordEntry as Model<RecordEntry>) ||
  model<RecordEntry>("RecordEntry", RecordEntrySchema);
