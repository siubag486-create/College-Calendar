import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: /node_modules|\.next|\.git/,
      poll: 1000,
      aggregateTimeout: 300,
    };
    return config;
  },
};

export default nextConfig;
