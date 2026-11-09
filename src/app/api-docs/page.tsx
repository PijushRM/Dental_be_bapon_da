import type { Metadata } from "next";
import SwaggerView from "./SwaggerView";

export const metadata: Metadata = { title: "Dental API docs" };

export default function ApiDocsPage() {
  // Swagger UI ships light styles only: keep this page light in dark mode too.
  return (
    <main style={{ background: "#fff", color: "#3b4151", minHeight: "100vh" }}>
      <SwaggerView />
    </main>
  );
}
