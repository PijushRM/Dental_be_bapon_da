import type { Schema } from "mongoose";

// Sends `id` instead of `_id`, drops `__v`, and hides internal fields.
export function cleanJSON(schema: Schema, hidden: string[] = []) {
  schema.set("toJSON", {
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      for (const key of hidden) delete ret[key];
      return ret;
    },
  });
}
