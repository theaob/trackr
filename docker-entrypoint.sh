#!/bin/sh
set -e

# Ensure data directory exists and is owned by nextjs
mkdir -p /app/data /app/data/avatars
chown -R nextjs:nodejs /app/data

FRESH_DATABASE=0

# If database does not exist, copy from seeded template
if [ ! -f /app/data/dev.db ]; then
  echo "==> [Trackr] Initializing fresh database from template at /app/data/dev.db..."
  if [ -f /app/prisma/template.db ]; then
    cp /app/prisma/template.db /app/data/dev.db
    chown nextjs:nodejs /app/data/dev.db
    FRESH_DATABASE=1
  fi
fi

# Keep the schema in step with the application. A failure here leaves the app
# querying a schema it does not match, so it stops the container rather than
# being ignored.
if [ -f ./node_modules/prisma/build/index.js ]; then
  echo "==> [Trackr] Synchronizing database schema..."
  if ! gosu nextjs node ./node_modules/prisma/build/index.js db push --skip-generate --schema=./prisma/schema.prisma; then
    echo "==> [Trackr] ERROR: database schema synchronization failed. Refusing to start." >&2
    exit 1
  fi
fi

if [ -z "$AUTH_SECRET" ]; then
  echo "==> [Trackr] AUTH_SECRET is not set; a random secret will be generated into /app/data."
  echo "             Set AUTH_SECRET (32+ characters) to keep sessions valid across volumes."
fi

if [ "$FRESH_DATABASE" = "1" ]; then
  echo "==> [Trackr] ============================ SECURITY ============================"
  echo "             This database was seeded with demo accounts that share a"
  echo "             well-known password ('trackr-demo' unless the image was built"
  echo "             with TRACKR_SEED_PASSWORD). Change or remove them before"
  echo "             exposing this instance to anyone else."
  echo "             =================================================================="
fi

echo "==> [Trackr] Server listening on port ${PORT:-3000}"
# Drop privileges and exec the main process as nextjs
exec gosu nextjs "$@"
