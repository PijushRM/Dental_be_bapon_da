import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";

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

// Wraps a route handler so thrown HttpError / ZodError become JSON responses.
export function handle<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      // Let Next.js internal signals (e.g. prerender bail-out) pass through.
      unstable_rethrow(err);
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
      console.error(err);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Body must be valid JSON");
  }
}
