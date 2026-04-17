# Railway (production)

## Root cause (fixed)

Prisma must run with **working directory = this folder** (or `--schema` pointing here). If the shell’s cwd was the **monorepo root**, `prisma/schema.prisma` was missing and `npx prisma` could download a global CLI that still looked in the wrong place.

**Fix:** `scripts/start.js` runs `npx prisma migrate deploy --schema <absolute path>` with `cwd` set to `vula24-backend`, then starts `node index.js` in the same folder.

## Deploy layout

| Railway “Root Directory” | Start command |
|--------------------------|----------------|
| *(empty — full repo)*    | Default: root `package.json` → `node vula24-backend/scripts/start.js`. Same as `railway.toml` `[deploy] startCommand`. |
| `vula24-backend`         | `npm start` → `node scripts/start.js` (no `vula24-backend/` prefix). |

Do **not** set a custom command like `npx prisma migrate deploy` without `cwd` or `--schema` — that repeats the old bug.

## Variables

`DATABASE_URL`, `JWT_SECRET`, etc. — unchanged.
