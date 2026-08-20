import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@vaqt/ui', '@vaqt/shared'],
};

export default nextConfig;
