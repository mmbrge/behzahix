import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build to plain HTML/CSS/JS in `out/` so the site runs on any regular
  // (cPanel/DirectAdmin) host without Node.js.
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
