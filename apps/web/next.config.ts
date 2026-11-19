import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@vaqt/ui', '@vaqt/shared'],
  // Traces and bundles only the node_modules this app actually needs into
  // .next/standalone — the production Dockerfile copies just that output
  // instead of the full (pnpm workspace, devDependencies-included)
  // node_modules tree.
  output: 'standalone',
  // One public domain: the browser talks to this server only, and these
  // paths are forwarded to the API container over the internal network
  // (so there is no CORS and the auth cookies are first-party). The
  // destination is fixed at build time; "api" is the compose service name.
  rewrites() {
    const api = process.env.API_INTERNAL_URL ?? 'http://api:3001';
    return Promise.resolve([
      { source: '/api/:path*', destination: `${api}/api/:path*` },
      { source: '/uploads/:path*', destination: `${api}/uploads/:path*` },
    ]);
  },
};

export default nextConfig;
