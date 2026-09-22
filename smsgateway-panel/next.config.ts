import type { NextConfig } from "next";

// When PocketBase runs in the SAME container as the panel (the one-click deploy),
// the browser can't reach it directly — so the panel proxies it at /pb.
// Set NEXT_PUBLIC_PB_URL=/pb in that setup; in a split deploy, point
// NEXT_PUBLIC_PB_URL straight at the public PocketBase URL and /pb is unused.
const PB_INTERNAL = process.env.POCKETBASE_INTERNAL_URL || "http://127.0.0.1:8090";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [{ source: "/pb/:path*", destination: `${PB_INTERNAL}/:path*` }];
  },
};

export default nextConfig;
