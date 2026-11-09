// Runs once when the server starts: print where the API docs are.
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const port = process.env.PORT || "3000";
  console.log(`\n  📘 Swagger docs:  http://localhost:${port}/api-docs\n`);
}
