import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Enable standalone output for Docker
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
