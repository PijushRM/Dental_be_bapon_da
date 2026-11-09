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

export type Session = { doctorId: string; issuedAt: number }; // issuedAt: seconds

// Reads "Authorization: Bearer <token>" and returns who it is for and when it
// was issued, or throws 401. Callers also check the account (see session.ts).
export async function requireSession(request: Request): Promise<Session> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new HttpError(401, "Missing bearer token");
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    // File links carry an audience; only plain session tokens are accepted here.
    if (payload.aud !== undefined) throw new Error("not a session token");
    if (!payload.sub || !isValidObjectId(payload.sub)) throw new Error("bad subject");
    if (typeof payload.iat !== "number") throw new Error("no issue time");
    return { doctorId: payload.sub, issuedAt: payload.iat };
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }
}

// True when the password changed after this token was issued. Token times are
// whole seconds, so a token from the same second as the change still counts.
export function revokedBy(passwordChangedAt: Date | null | undefined, issuedAt: number) {
  return !!passwordChangedAt && issuedAt < Math.floor(passwordChangedAt.getTime() / 1000);
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
