import type { NextConfig } from "next";

// Disable Lightning CSS tooling where native binaries are unavailable (e.g. Vercel build sandboxes).
if (process.env.NEXT_DISABLE_LIGHTNINGCSS === undefined) {
  process.env.NEXT_DISABLE_LIGHTNINGCSS = "1";
}

if (process.env.TAILWIND_DISABLE_LIGHTNINGCSS === undefined) {
  process.env.TAILWIND_DISABLE_LIGHTNINGCSS = "1";
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
