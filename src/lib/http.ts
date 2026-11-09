import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = "Not found") => new HttpError(404, what);

// Wraps a route handler so thrown HttpError / ZodError become JSON responses,
// and logs every API call: method, path, status, duration and a request id.
export function handle<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    const request = args[0] instanceof Request ? args[0] : undefined;
    const started = performance.now();
    const requestId = request?.headers.get("x-request-id") || crypto.randomUUID();
    let response: Response;
    let error: unknown;

    try {
      response = await fn(...args);
    } catch (err) {
      // Let Next.js internal signals (e.g. prerender bail-out) pass through.
      unstable_rethrow(err);
      response = toErrorResponse(err);
      if (response.status >= 500) error = err;
    }

    logRequest(request, response, requestId, performance.now() - started, error);
    try {
      response.headers.set("x-request-id", requestId);
    } catch {
      // Some responses have immutable headers; the id is still in the log.
    }
    return response;
  };
}

function toErrorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return Response.json(
      { error: err.message, ...(err.details ? { details: err.details } : {}) },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    const details = Object.fromEntries(
      err.issues.map((i) => [i.path.join(".") || "_", i.message]),
    );
    return Response.json({ error: "Validation failed", details }, { status: 400 });
  }
  if (isDuplicateKey(err)) {
    return Response.json({ error: "This already exists." }, { status: 409 });
  }
  return Response.json({ error: "Internal server error" }, { status: 500 });
}

// Path only, no query string: queries can carry patient names or phone numbers.
function logRequest(
  request: Request | undefined,
  response: Response,
  requestId: string,
  ms: number,
  err?: unknown,
) {
  const method = request?.method ?? "?";
  const path = request ? new URL(request.url).pathname : "?";
  const { status } = response;
  const fields = { status, ms: Math.round(ms), reqId: requestId, ...(err ? { err } : {}) };
  const msg = `${method} ${path}`;
  if (status >= 500) logger.error(msg, fields);
  else if (status >= 400) logger.warn(msg, fields);
  else logger.info(msg, fields);
}

// MongoDB unique-index violation (E11000), e.g. two requests creating the same thing at once.
export function isDuplicateKey(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === 11000;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Body must be valid JSON");
  }
}
