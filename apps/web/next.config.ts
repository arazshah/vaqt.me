import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@vaqt/ui', '@vaqt/shared'],
  // Traces and bundles only the node_modules this app actually needs into
  // .next/standalone — the production Dockerfile copies just that output
  // instead of the full (pnpm workspace, devDependencies-included)
  // node_modules tree.
  output: 'standalone',
};

export default nextConfig;
