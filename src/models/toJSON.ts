import type { Schema } from "mongoose";

// Sends `id` instead of `_id`, drops `__v`, and hides internal fields.
// Works on a hydrated document's toJSON() output and on a `.lean()` result alike.
export function toClient<T extends Record<string, unknown>>(ret: T, hidden: readonly string[] = []) {
  const out: Record<string, unknown> = { ...ret, id: String(ret._id) };
  delete out._id;
  delete out.__v;
  for (const key of hidden) delete out[key];
  return out;
}

export function cleanJSON(schema: Schema, hidden: readonly string[] = []) {
  schema.set("toJSON", {
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => toClient(ret, hidden),
  });
}
