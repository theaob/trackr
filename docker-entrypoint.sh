#!/bin/sh
set -e

# Ensure data directory exists and is owned by nextjs
mkdir -p /app/data /app/data/avatars
chown -R nextjs:nodejs /app/data

FRESH_DATABASE=0
SEEDED_DEMO=0
# TAMAM_* settings; the TRACKR_* names from before the rename still work.
SEED_DEMO="${TAMAM_SEED_DEMO:-$TRACKR_SEED_DEMO}"

# If database does not exist, copy from a template. By default that template
# is empty and the app boots into /setup to create the real admin account;
# TAMAM_SEED_DEMO=1 opts into the seeded demo dataset instead.
if [ ! -f /app/data/dev.db ]; then
  if [ "$SEED_DEMO" = "1" ] && [ -f /app/prisma/template-demo.db ]; then
    echo "==> [Tamam] Initializing fresh database from the seeded demo template..."
    cp /app/prisma/template-demo.db /app/data/dev.db
    chown nextjs:nodejs /app/data/dev.db
    FRESH_DATABASE=1
    SEEDED_DEMO=1
  elif [ -f /app/prisma/template.db ]; then
    echo "==> [Tamam] Initializing fresh (empty) database at /app/data/dev.db..."
    cp /app/prisma/template.db /app/data/dev.db
    chown nextjs:nodejs /app/data/dev.db
    FRESH_DATABASE=1
  fi
fi

# Keep the schema in step with the application. A failure here leaves the app
# querying a schema it does not match, so it stops the container rather than
# being ignored.
if [ -f ./node_modules/prisma/build/index.js ]; then
  echo "==> [Tamam] Synchronizing database schema..."
  if ! gosu nextjs node ./node_modules/prisma/build/index.js db push --skip-generate --schema=./prisma/schema.prisma; then
    echo "==> [Tamam] ERROR: database schema synchronization failed. Refusing to start." >&2
    exit 1
  fi
fi

if [ -z "$AUTH_SECRET" ]; then
  echo "==> [Tamam] AUTH_SECRET is not set; a random secret will be generated into /app/data."
  echo "             Set AUTH_SECRET (32+ characters) to keep sessions valid across volumes."
fi

# A database from a version without authentication has no password hashes, so
# nobody could sign in and the login form would only say "incorrect password".
# Only a concern once accounts exist: a brand-new (0-user) database is not a
# broken upgrade, it is setup mode, and is handled by the message below instead.
if command -v sqlite3 >/dev/null 2>&1 && [ -f /app/data/dev.db ]; then
  TOTAL_USERS=$(sqlite3 /app/data/dev.db "SELECT COUNT(*) FROM User;" 2>/dev/null || echo "")
  if [ -n "$TOTAL_USERS" ] && [ "$TOTAL_USERS" != "0" ]; then
    WITH_PASSWORD=$(sqlite3 /app/data/dev.db \
      "SELECT COUNT(*) FROM User WHERE passwordHash IS NOT NULL;" 2>/dev/null || echo "")
    if [ "$WITH_PASSWORD" = "0" ]; then
      echo "==> [Tamam] ========================== ACTION NEEDED =========================="
      echo "             No account in this database has a password, so sign-in is not"
      echo "             possible yet. Set one from a shell in this container:"
      echo "               docker exec -it trackr-app node scripts/set-password.cjs <email>"
      echo "             =========================================================================="
    fi
  fi
fi

if [ "$SEEDED_DEMO" = "1" ]; then
  echo "==> [Tamam] ============================ SECURITY ============================"
  echo "             This database was seeded with demo accounts that share a"
  echo "             well-known password ('tamam-demo' unless the image was built"
  echo "             with TAMAM_SEED_PASSWORD). Change or remove them before"
  echo "             exposing this instance to anyone else."
  echo "             =================================================================="
elif [ "$FRESH_DATABASE" = "1" ]; then
  echo "==> [Tamam] This is a fresh instance with no accounts yet."
  echo "             Open it in a browser to create the admin account and first project."
fi

echo "==> [Tamam] Server listening on port ${PORT:-3000}"
# Drop privileges and exec the main process as nextjs
exec gosu nextjs "$@"
