/**
 * Production start: run Prisma and the API with cwd = backend root and an absolute --schema path.
 * Root cause fixed: Prisma was sometimes invoked from the monorepo root, so ./prisma/schema.prisma did not exist
 * and npx downloaded a global prisma that still looked for the schema in the wrong cwd.
 */
const path = require('path');
const { existsSync } = require('fs');
const { spawnSync } = require('child_process');

const backendRoot = path.resolve(__dirname, '..');
const schemaPath = path.join(backendRoot, 'prisma', 'schema.prisma');

process.chdir(backendRoot);

if (!existsSync(schemaPath)) {
  console.error('[start] FATAL: missing', schemaPath, 'cwd=', process.cwd());
  process.exit(1);
}

const env = { ...process.env };
const shell = process.platform === 'win32';

const migrate = spawnSync(
  'npx',
  ['prisma', 'migrate', 'deploy', '--schema', schemaPath],
  { stdio: 'inherit', cwd: backendRoot, env, shell }
);

if (migrate.status !== 0) {
  process.exit(migrate.status ?? 1);
}

const server = spawnSync(process.execPath, [path.join(backendRoot, 'index.js')], {
  stdio: 'inherit',
  cwd: backendRoot,
  env,
});

process.exit(server.status ?? 0);
