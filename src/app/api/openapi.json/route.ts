import { buildOpenApiSpec } from "@/lib/openapi";

// The OpenAPI 3 document behind /api-docs. Uses the caller's origin as the server URL,
// so "Try it out" works on localhost, a LAN IP or a deployed host alike.
export function GET(request: Request) {
  return Response.json(buildOpenApiSpec(new URL(request.url).origin));
}
