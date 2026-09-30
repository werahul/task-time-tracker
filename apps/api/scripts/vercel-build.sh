#!/usr/bin/env bash
# Build step for the API's Vercel project (Root Directory: apps/api).
# Dependencies are already installed (npm workspaces install from the repo root,
# which also runs `prisma generate`); api/index.ts is compiled by Vercel itself.
set -euo pipefail

# The API imports the shared package's compiled output.
(cd ../.. && npm run build:shared)

# Apply committed migrations, only for production deployments: preview builds
# (every pushed branch) must never apply unmerged migrations to the production
# database. Migrations use Neon's direct (non-pooled) URL when provided.
if [ "${VERCEL_ENV:-}" = "production" ]; then
  node scripts/migrate-deploy.mjs
else
  echo "Skipping migrations for a ${VERCEL_ENV:-local} build."
fi

# Vercel expects an output directory; this project serves only the function.
mkdir -p public
