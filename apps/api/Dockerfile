# syntax=docker/dockerfile:1
#
# Multi-stage production image for @vaqt/api (NestJS). Build from the
# monorepo root, e.g.:
#   docker build -f apps/api/Dockerfile -t vaqt-api .
#
# Unlike apps/web (Next has built-in dependency tracing via `output:
# standalone`), NestJS has no equivalent, and pnpm's node_modules are
# workspace symlinks (e.g. apps/api/node_modules/@vaqt/db -> ../../../
# packages/db) — copying just apps/api's own node_modules into a slim
# final stage would leave those symlinks dangling. So the runner stage
# copies the whole pruned workspace instead of cherry-picking apps/api.

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
# @vaqt/api... = this package plus everything it depends on (@vaqt/shared,
# @vaqt/db) — turbo's dependsOn graph (see turbo.json) builds/generates
# them first.
RUN pnpm exec turbo run build --filter=@vaqt/api...
# Strips devDependencies workspace-wide in place — safe post-build, since
# it operates on the same symlink layout rather than re-resolving it.
RUN pnpm prune --prod

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app ./

USER nestjs
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
