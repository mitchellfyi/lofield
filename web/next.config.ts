import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  output: "standalone", // Enable standalone output for Docker
};

export default nextConfig;
