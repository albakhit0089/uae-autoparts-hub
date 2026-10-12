import type { NextConfig } from "next";

// Static export so the demo can be hosted on GitHub Pages / any static host.
// NEXT_PUBLIC_BASE_PATH is set by CI when deploying to a project sub-path.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
};

export default nextConfig;
