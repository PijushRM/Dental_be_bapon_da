import mongoose from "mongoose";
import { handle } from "@/lib/http";
import { logger } from "@/lib/logger";
import { connectDB } from "@/lib/mongodb";

export const GET = handle(async () => {
  try {
    await connectDB();
    await mongoose.connection.db?.admin().ping();
    return Response.json({ status: "ok", db: "connected" });
  } catch (err) {
    logger.error("Health check: database unreachable", { err });
    return Response.json({ status: "error", db: "disconnected" }, { status: 500 });
  }
});
