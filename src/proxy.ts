import { NextResponse, type NextRequest } from "next/server";

// CORS for every /api route, including the OPTIONS preflight browsers send before
// requests with an Authorization header or a JSON body.
//
// CORS_ORIGINS: comma-separated list of allowed origins, e.g.
//   CORS_ORIGINS=http://localhost:5173,https://app.example.com
// Use "*" to allow any origin. When unset, any origin is allowed in development
// and none in production.

const configured = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

const allowAny =
  configured.includes("*") || (configured.length === 0 && process.env.NODE_ENV !== "production");

const corsHeaders = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-Id",
  "Access-Control-Expose-Headers": "X-Request-Id, Content-Disposition",
  "Access-Control-Max-Age": "86400",
};

function isAllowed(origin: string) {
  return allowAny || configured.includes(origin);
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = origin !== "" && isAllowed(origin);

  const headers = new Headers(allowed ? corsHeaders : {});
  if (allowed) headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin");

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: allowed ? 204 : 403, headers });
  }

  const response = NextResponse.next();
  headers.forEach((value, key) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
