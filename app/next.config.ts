import path from "node:path";
import type { NextConfig } from "next";

const repoRoot = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  transpilePackages: [
    "@understudy/shared",
    "@understudy/engine",
    "@understudy/voice",
    "@understudy/brain",
  ],
  // Workspace packages live outside app/, so Turbopack resolves from the repo root.
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
  // Teammates hit the dev server over the LAN.
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*", "*.local"],
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, x-expertai-session" },
        ],
      },
    ];
  },
};

export default nextConfig;
