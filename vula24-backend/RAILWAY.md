# Railway (production)

- **Root directory:** set to `vula24-backend` if the repo root is the monorepo (so `package.json` here is used).
- **Start command:** leave default `npm start` — it runs `prisma migrate deploy` then `node index.js`, so the Postgres schema stays in sync on every deploy.
- **Variables:** `DATABASE_URL` and `JWT_SECRET` must be set (you already have these).

After you push this change, redeploy once; signup should stop returning 500 once migrations apply.
