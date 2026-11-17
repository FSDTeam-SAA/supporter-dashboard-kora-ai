import type { NextConfig } from "next";

// Kept aligned with the other NOVYA dashboards: no experimental Cache Components /
// Partial Prefetching (they bypassed the auth proxy on prerendered routes in dev).
const nextConfig: NextConfig = {
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
