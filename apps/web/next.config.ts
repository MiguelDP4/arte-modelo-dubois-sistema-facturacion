import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@arte-modelo/shared'],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
