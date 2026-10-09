import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Le foto dei documenti vengono ridotte nel browser, ma lasciamo margine.
    serverActions: { bodySizeLimit: "8mb" },
  },
  async headers() {
    return [
      {
        // Il link ospite contiene il token: non deve finire nei referrer.
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
