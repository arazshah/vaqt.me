#!/bin/sh
# Container start: bring the database schema up to date, then start the API.
# `migrate deploy` only applies migrations that were already committed; it
# never creates or resets anything, and it is a no-op when nothing is new.
set -eu

echo "[entrypoint] applying database migrations..."
/app/packages/db/node_modules/.bin/prisma migrate deploy \
  --schema /app/packages/db/prisma/schema.prisma

echo "[entrypoint] starting API"
exec node apps/api/dist/main.js
