#!/usr/bin/env bash
# Create the login the hosted web app connects with: soccer_web, a member
# of soccer_app (see roles.sql), so the app gets only those privileges and
# can never drop or empty a table.
#
# Run once per database server, as the database owner, after reset.sh has
# created the roles. Running it again only sets a new password (and the
# connection time limits below).
#
#   APP_DB_PASSWORD='<long random password>' \
#   DATABASE_URL='<owner connection URL, unpooled>' ./create_app_login.sh
#
# The password is read from the environment inside psql (\getenv), so it
# never appears on a command line or in this repository. Put the same
# password in the app's connection string (APP_DATABASE_URL on Vercel;
# see docs/WORK_PLAN.md, Hosting). PostgreSQL stores only a SCRAM hash.
set -euo pipefail
: "${APP_DB_PASSWORD:?Set APP_DB_PASSWORD to the password for the new login}"
TARGET="${DATABASE_URL:-${PGDATABASE:-nyc_fields}}"

psql -v ON_ERROR_STOP=1 -q -d "$TARGET" <<'SQL'
\getenv pw APP_DB_PASSWORD
SELECT format('CREATE ROLE soccer_web LOGIN PASSWORD %L', :'pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'soccer_web')
\gexec
SELECT format('ALTER ROLE soccer_web LOGIN PASSWORD %L', :'pw')
\gexec
GRANT soccer_app TO soccer_web;
-- Limits on the app's own connections, so a slow query or a held lock
-- cannot outlive the 15-second Vercel function (vercel.json) and keep
-- others waiting. Errors from these become "please try again" messages
-- (server/src/lib/errors.js: 57014, 55P03).
ALTER ROLE soccer_web SET statement_timeout = '8s';
ALTER ROLE soccer_web SET lock_timeout = '3s';
ALTER ROLE soccer_web SET idle_in_transaction_session_timeout = '10s';
SQL
echo "soccer_web can log in, with the soccer_app privileges only."
