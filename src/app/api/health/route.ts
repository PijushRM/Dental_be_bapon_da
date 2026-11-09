import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";

export async function GET() {
  try {
    await connectDB();
    await mongoose.connection.db?.admin().ping();
    return Response.json({ status: "ok", db: "connected" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ status: "error", db: "disconnected", message }, { status: 500 });
  }
}
