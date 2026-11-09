import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    // proxy.ts (CORS) buffers request bodies up to this size; the default 10MB would cut off
    // uploads near the 10MB file limit. Keep above MAX_FILE_BYTES + multipart overhead.
    proxyClientMaxBodySize: "12mb",
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
