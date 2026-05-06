import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/auth/sign-in", destination: "/login", permanent: true },
      { source: "/auth/sign-up", destination: "/signup", permanent: true },
    ];
  },
};

export default nextConfig;
