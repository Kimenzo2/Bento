import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: { root: path.resolve(__dirname, '../..') },
  outputFileTracingRoot: path.join(__dirname, '../..'),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
