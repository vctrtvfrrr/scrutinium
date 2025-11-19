import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Ensure native bindings such as better-sqlite3 remain external so the
   * runtime can load them from node_modules instead of being bundled.
   */
  serverExternalPackages: ["better-sqlite3"],
  /**
   * Provide an explicit Turbopack config so Next.js doesn’t treat the absence
   * of one as an error when no custom webpack config is supplied.
   */
  turbopack: {}
};

export default nextConfig;
