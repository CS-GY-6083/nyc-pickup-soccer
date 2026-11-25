#!/usr/bin/env bash
# Database backup for the hand-in: every table's structure and data in one
# SQL file (spec: "databases backup file (including table structures and
# inserted data)").
#
#   db/backup.sh                                          # local nyc_fields
#   DATABASE_URL='<owner URL, unpooled>' db/backup.sh     # e.g. the live Neon database
#
# Writes part3/backup/nyc_fields-YYYY-MM-DD.sql. Only reads the database.
# Left out: the rows of the login "session" table (private, short-lived;
# the table itself is kept), and owners and GRANTs, so the file loads into
# any PostgreSQL 17 server. Run db/roles.sql afterwards to recreate the
# app's roles and privileges.
#
# Restore into an empty database:
#   createdb nyc_fields_restored
#   psql -v ON_ERROR_STOP=1 -d nyc_fields_restored -f backup/nyc_fields-YYYY-MM-DD.sql
set -euo pipefail
cd "$(dirname "$0")/.."

SOURCE="${DATABASE_URL:-${PGDATABASE:-nyc_fields}}"
mkdir -p backup
OUT="backup/nyc_fields-$(date +%F).sql"

pg_dump --no-owner --no-privileges --exclude-table-data=session -d "$SOURCE" -f "$OUT"
echo "Wrote part3/$OUT ($(wc -l < "$OUT" | tr -d ' ') lines)."
