import { handle } from "@/lib/http";
import { buildOpenApiSpec } from "@/lib/openapi";

// The OpenAPI 3 document behind /api-docs. Uses the caller's origin as the server URL,
// so "Try it out" works on localhost, a LAN IP or a deployed host alike.
export const GET = handle(async (request: Request) =>
  Response.json(buildOpenApiSpec(new URL(request.url).origin)),
);
