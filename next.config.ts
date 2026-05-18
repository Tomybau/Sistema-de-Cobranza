import type { NextConfig } from "next";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";

const pkg = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf-8")) as { version: string };

let gitSha = (process.env.GIT_SHA ?? "").slice(0, 7) || "local";
try {
  gitSha = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  // en contenedores Docker sin git, usamos GIT_SHA del build arg o "local"
}

const nextConfig: NextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_GIT_SHA: gitSha,
  },
};

export default nextConfig;
