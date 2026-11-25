// Cross-platform test launcher. Rebuilds nyc_fields_test with the same
// PostgreSQL owner credentials as server/.env, then runs the API as the
// restricted soccer_app role. Works from PowerShell, cmd, macOS and Linux.
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = fileURLToPath(new URL('.', import.meta.url));
const serverDir = resolve(here, '..');
const dbDir = resolve(serverDir, '../db');
const TEST_DATABASE = 'nyc_fields_test';

function databaseUrl(name) {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('DATABASE_URL is missing. Copy .env.example to .env and add your PostgreSQL username and password.');
  }
  const url = new URL(raw);
  url.pathname = `/${name}`;
  return url.toString();
}

function findPsql() {
  if (process.env.PSQL && existsSync(process.env.PSQL)) return process.env.PSQL;
  if (process.platform === 'win32') {
    const root = join(process.env.ProgramFiles ?? 'C:\\Program Files', 'PostgreSQL');
    if (existsSync(root)) {
      const versions = readdirSync(root).sort((a, b) => Number(b) - Number(a));
      for (const version of versions) {
        const candidate = join(root, version, 'bin', 'psql.exe');
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  return 'psql';
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function rebuildDatabase() {
  const owner = new pg.Pool({ connectionString: databaseUrl('postgres'), max: 1 });
  try {
    await owner.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [TEST_DATABASE],
    );
    await owner.query(`DROP DATABASE IF EXISTS ${TEST_DATABASE}`);
    await owner.query(`CREATE DATABASE ${TEST_DATABASE}`);
  } finally {
    await owner.end();
  }

  const url = new URL(databaseUrl(TEST_DATABASE));
  const psqlEnv = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: TEST_DATABASE,
    PGOPTIONS: '-c client_min_messages=warning',
  };
  const psql = findPsql();
  for (const file of ['schema.sql', 'roles.sql', 'seed.sql']) {
    run(psql, ['-q', '-v', 'ON_ERROR_STOP=1', '-f', join(dbDir, file)], { env: psqlEnv });
  }
  run(psql, ['-q', '-v', 'ON_ERROR_STOP=1', '-f', join(here, 'fake-clock.sql')], { env: psqlEnv });
}

function testFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return testFiles(path);
    return entry.name.endsWith('.test.js') ? [path] : [];
  });
}

await rebuildDatabase();
if (process.argv.includes('--db-only')) process.exit(0);

const coverage = process.argv.includes('--coverage');
const args = ['--test', '--test-concurrency=1'];
if (coverage) {
  args.push(
    '--experimental-test-coverage',
    '--test-coverage-include=src/**',
    '--test-coverage-lines=80',
    '--test-coverage-branches=80',
    '--test-coverage-functions=80',
  );
}
args.push(...testFiles(here));

const env = {
  ...process.env,
  DATABASE_URL: databaseUrl(TEST_DATABASE),
  DB_SET_ROLE: 'soccer_app',
};
delete env.APP_DATABASE_URL;
run(process.execPath, args, { cwd: serverDir, env });
