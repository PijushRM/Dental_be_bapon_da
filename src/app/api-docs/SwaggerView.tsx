"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

// Swagger UI is browser-only (it touches window/localStorage), so skip server rendering.
const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => <p style={{ padding: 24, fontFamily: "sans-serif" }}>Loading API docs…</p>,
});

export default function SwaggerView() {
  return <SwaggerUI url="/api/openapi.json" persistAuthorization tryItOutEnabled />;
}
