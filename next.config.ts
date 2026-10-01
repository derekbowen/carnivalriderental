import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node:sqlite is a Node built-in used only by server code (development store).
  serverExternalPackages: [],
  poweredByHeader: false,
  trailingSlash: false,
};

export default nextConfig;
