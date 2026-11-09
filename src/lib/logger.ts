// Small leveled logger with no dependencies.
// Dev: coloured one-line output. Production: one JSON object per line (easy to ship to a log service).
// Set LOG_LEVEL to debug | info | warn | error (default: debug in dev, info in production).

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const COLOR: Record<Level, string> = {
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};
const RESET = "\x1b[0m";

const isProd = process.env.NODE_ENV === "production";
const envLevel = process.env.LOG_LEVEL?.toLowerCase() as Level | undefined;
const minLevel: Level = envLevel && envLevel in ORDER ? envLevel : isProd ? "info" : "debug";

function serializeError(err: unknown): Fields {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { message: String(err) };
}

function write(level: Level, msg: string, fields: Fields = {}) {
  if (ORDER[level] < ORDER[minLevel]) return;
  const out = { ...fields };
  if ("err" in out) out.err = serializeError(out.err);

  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;

  if (isProd) {
    sink(JSON.stringify({ time: new Date().toISOString(), level, msg, ...out }));
    return;
  }

  const time = new Date().toISOString().slice(11, 23);
  const { err, ...rest } = out as Fields & { err?: Fields };
  const extras = Object.entries(rest)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" ");
  sink(
    `${COLOR[level]}${time} ${level.toUpperCase().padEnd(5)}${RESET} ${msg}${extras ? ` ${extras}` : ""}`,
  );
  if (err?.stack) sink(err.stack);
  else if (err) sink(err.message);
}

export const logger = {
  debug: (msg: string, fields?: Fields) => write("debug", msg, fields),
  info: (msg: string, fields?: Fields) => write("info", msg, fields),
  warn: (msg: string, fields?: Fields) => write("warn", msg, fields),
  error: (msg: string, fields?: Fields) => write("error", msg, fields),
};
