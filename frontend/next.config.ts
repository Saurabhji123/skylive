import type { NextConfig } from "next";

// Disable Lightning CSS minifier on build environments that lack native binaries (e.g. Vercel).
if (process.env.NEXT_DISABLE_LIGHTNINGCSS === undefined) {
  process.env.NEXT_DISABLE_LIGHTNINGCSS = "1";
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
