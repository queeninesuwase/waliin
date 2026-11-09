import type { NextConfig } from "next";

// FastAPI base URL. Set BACKEND_URL in .env.local (see .env.example).
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
// Must match the prefix of the FastAPI routers.
const API_PREFIX = process.env.BACKEND_API_PREFIX ?? "/api/v1";

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  experimental: {
    cpus: 2,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}${API_PREFIX}/:path*`,
      },
    ];
  },
};

export default nextConfig;
