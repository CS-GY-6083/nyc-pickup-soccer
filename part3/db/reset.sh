#!/usr/bin/env bash
# Rebuild the Part 3 database from scratch: tables (schema.sql), sample
# data (seed.sql), then the real NYC soccer fields from NYC Open Data
# (open_data_fields.sql). Creates the local database first if it is missing.
#
#   ./reset.sh                    # uses the local database nyc_fields
#   PGDATABASE=other ./reset.sh   # or any other local database name
#   DATABASE_URL=postgres://... ./reset.sh
#                                 # a hosted database (e.g. the Neon one the
#                                 # Vercel site uses; use its unpooled URL)
#   SHIFT_DATES=0 ./reset.sh      # keep the dates exactly as written in seed.sql
#   OPEN_DATA_FIELDS=0 ./reset.sh # only the 12 hand-entered fields (the tests do this)
#
# The sample dates are moved forward to today (shift_dates.sql), so
# upcoming games stay upcoming. Re-run this before screenshots or a demo.
#
# WARNING: drops and recreates every project table, so all data added
# through the app is lost and everyone is logged out.
set -euo pipefail

DB="${PGDATABASE:-nyc_fields}"
# A connection URL (hosted database) wins over the local database name.
TARGET="${DATABASE_URL:-$DB}"
if [ -n "${DATABASE_URL:-}" ]; then LABEL="the database at DATABASE_URL"; else LABEL="database $DB"; fi
cd "$(dirname "$0")"
# Hide "table does not exist, skipping" notices from the DROP statements.
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"

if [ -z "${DATABASE_URL:-}" ]; then
    exists=$(psql -d postgres -tA -v db="$DB" <<'SQL'
SELECT 1 FROM pg_database WHERE datname = :'db';
SQL
)
    if [ "$exists" != "1" ]; then
        echo "Creating database $DB"
        createdb "$DB"
    fi
fi

psql -v ON_ERROR_STOP=1 -q -d "$TARGET" -f schema.sql
psql -v ON_ERROR_STOP=1 -q -d "$TARGET" -f seed.sql >/dev/null
if [ "${OPEN_DATA_FIELDS:-1}" != "0" ]; then
    psql -v ON_ERROR_STOP=1 -q -d "$TARGET" -f open_data_fields.sql >/dev/null
fi
if [ "${SHIFT_DATES:-1}" != "0" ]; then
    psql -v ON_ERROR_STOP=1 -q -tA -d "$TARGET" -f shift_dates.sql
fi
echo "Rebuilt $LABEL: schema.sql + seed.sql$([ "${OPEN_DATA_FIELDS:-1}" != "0" ] && echo ' + open_data_fields.sql')"
