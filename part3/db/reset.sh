#!/usr/bin/env bash
# Rebuild the Part 3 database from scratch: tables (schema.sql), then
# sample data (seed.sql). Creates the database first if it is missing.
#
#   ./reset.sh                  # uses database nyc_fields
#   PGDATABASE=other ./reset.sh # or any other database name
#   SHIFT_DATES=0 ./reset.sh    # keep the dates exactly as written in seed.sql
#
# The sample dates are moved forward to today (shift_dates.sql), so
# upcoming games stay upcoming. Re-run this before screenshots or a demo.
#
# WARNING: drops and recreates every project table, so all data added
# through the app is lost and everyone is logged out.
set -euo pipefail

DB="${PGDATABASE:-nyc_fields}"
cd "$(dirname "$0")"
# Hide "table does not exist, skipping" notices from the DROP statements.
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"

exists=$(psql -d postgres -tA -v db="$DB" <<'SQL'
SELECT 1 FROM pg_database WHERE datname = :'db';
SQL
)
if [ "$exists" != "1" ]; then
    echo "Creating database $DB"
    createdb "$DB"
fi

psql -v ON_ERROR_STOP=1 -q -d "$DB" -f schema.sql
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f seed.sql >/dev/null
if [ "${SHIFT_DATES:-1}" != "0" ]; then
    psql -v ON_ERROR_STOP=1 -q -tA -d "$DB" -f shift_dates.sql
fi
echo "Database $DB rebuilt with schema.sql + seed.sql"
