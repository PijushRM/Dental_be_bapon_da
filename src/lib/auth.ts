import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { SignJWT, jwtVerify } from "jose";
import { isValidObjectId } from "mongoose";
import { HttpError } from "@/lib/http";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const KEY_LEN = 64;
const TOKEN_TTL = "30d";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LEN);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

function secret(): Uint8Array {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) {
    throw new Error("JWT_SECRET must be set to at least 32 characters (see .env.example).");
  }
  return new TextEncoder().encode(value);
}

export async function signToken(doctorId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(doctorId)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(secret());
}

// Reads "Authorization: Bearer <token>" and returns the doctor's id, or throws 401.
export async function requireDoctorId(request: Request): Promise<string> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new HttpError(401, "Missing bearer token");
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    // File links carry an audience; only plain session tokens are accepted here.
    if (payload.aud !== undefined) throw new Error("not a session token");
    if (!payload.sub || !isValidObjectId(payload.sub)) throw new Error("bad subject");
    return payload.sub;
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }
}

const FILE_AUDIENCE = "file";
const FILE_LINK_TTL = "5m";

// A short-lived token that opens one file, for viewers that can't send headers.
export async function signFileToken(doctorId: string, fileId: string): Promise<string> {
  return new SignJWT({ fid: fileId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(doctorId)
    .setAudience(FILE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(FILE_LINK_TTL)
    .sign(secret());
}

// Returns the doctor id if `sig` opens `fileId`, else throws 401.
export async function verifyFileToken(sig: string, fileId: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(sig, secret(), {
      algorithms: ["HS256"],
      audience: FILE_AUDIENCE,
    });
    if (payload.fid !== fileId || !payload.sub || !isValidObjectId(payload.sub)) {
      throw new Error("wrong file");
    }
    return payload.sub;
  } catch {
    throw new HttpError(401, "Invalid or expired file link");
  }
}
