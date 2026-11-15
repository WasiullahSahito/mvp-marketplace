import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The shared package is plain TypeScript source, so Next must compile it.
  transpilePackages: ["@marketplace/shared"],
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
