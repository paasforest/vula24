# Railway (production)

- **Root directory:** leave **empty** (repo root) or set to `vula24-backend`. If the root is the monorepo, root `package.json` runs `cd vula24-backend && npm start` so Prisma’s cwd finds `prisma/schema.prisma`.
- **Start command:** default `npm start` from root — it `cd`s into `vula24-backend`, then runs `prisma migrate deploy` and `node index.js`.
- **Variables:** `DATABASE_URL` and `JWT_SECRET` must be set (you already have these).

After you push this change, redeploy once; signup should stop returning 500 once migrations apply.
