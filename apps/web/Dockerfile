# syntax=docker/dockerfile:1
#
# Multi-stage production image for @vaqt/web (Next.js). Build from the
# monorepo root, e.g.:
#   docker build -f apps/web/Dockerfile -t vaqt-web .
#
# Uses Next's `output: 'standalone'` (see next.config.ts) so the final
# stage copies a self-contained, dependency-traced server instead of the
# full pnpm workspace node_modules tree.

FROM node:22-alpine AS base
RUN corepack enable
# This build environment's Docker network advertises IPv6 registry
# addresses it can't actually route (ENETUNREACH), which otherwise wastes
# every connection attempt on a dead-end before falling back to IPv4.
ENV NODE_OPTIONS=--dns-result-order=ipv4first

FROM base AS deps
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

FROM deps AS builder
WORKDIR /app
# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, not
# read at container start. Empty (the default) = the browser calls the same
# origin, and this server proxies /api and /uploads to the API container
# (next.config.ts rewrites). Pass a full URL only for a split-domain setup.
ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Where the proxy (and server-side fetches) reach the API inside the network.
ARG API_INTERNAL_URL=http://api:3001
ENV API_INTERNAL_URL=$API_INTERNAL_URL
# @vaqt/web... = this package plus everything it depends on (@vaqt/shared,
# @vaqt/ui) — turbo's dependsOn graph (see turbo.json) builds them first.
RUN pnpm exec turbo run build --filter=@vaqt/web...

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ARG API_INTERNAL_URL=http://api:3001
ENV API_INTERNAL_URL=$API_INTERNAL_URL
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Standalone output already nests by workspace path (apps/web/server.js) —
# the monorepo's lockfile at the root is what makes Next detect and trace
# relative to the workspace root rather than just apps/web.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
