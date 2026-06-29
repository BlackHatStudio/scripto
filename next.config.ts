import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  logging: false,
  allowedDevOrigins: ["http://localhost:4444", "http://127.0.0.1:4444"],
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    config.watchOptions = {
      ...(config.watchOptions ?? {}),
      ignored: [
        ...(Array.isArray(config.watchOptions?.ignored) ? config.watchOptions.ignored : []),
        "**/.playwright-mcp/**",
        "**/backend/dist/**",
        "**/tsconfig.tsbuildinfo",
        "**/startup-debug.log",
        "**/dev-session.log",
      ],
    }

    return config
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
