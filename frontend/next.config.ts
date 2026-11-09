import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
const apiPrefix = process.env.BACKEND_API_PREFIX ?? "/api/v1";

const nextConfig: NextConfig = {
  // Keep the trailing slash in URLs like /api/faults/ so the backend does not
  // redirect the browser to a different address.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/api/faults/",
        destination: `${backendUrl}${apiPrefix}/faults/`,
      },
      {
        source: "/api/:path*",
        destination: `${backendUrl}${apiPrefix}/:path*`,
      },
    ];
  },
};

export default nextConfig;
