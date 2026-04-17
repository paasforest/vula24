# Vula24 monorepo

This repo contains **three** separate pieces — do not confuse them:

| Piece | Folder | What it is |
|--------|--------|------------|
| **API** | `vula24-backend/` | Node/Express + Prisma backend. `npm start` from repo root runs this. |
| **Client app** (customers) | `Vula24/` | End-user / booking app (Expo). **Not** the Pro app. |
| **Pro app** (locksmiths) | `Vula24Pro/` | Locksmith / provider app (Expo). **Not** the client app. |

## Expo dev servers

From the repo root (`~/vula24`), use **`npm run …`** — the script name is not a shell command on its own.

- **Client:** `npm run start:client` — bundles `./Vula24`
- **Pro:** `npm run start:pro` — bundles `./Vula24Pro`

Running `npx expo start` **from the repo root without a path** will fail (wrong project root).

Do **not** type `start:client` alone in the terminal; that will say `command not found`.

### Expo Go vs SDK

Both apps target **Expo SDK 55**, which matches **Expo Go** from the Play Store / App Store. If the project drifts to an older SDK, run `expo@^55` plus `npx expo install --fix` in that app folder.

`start:customer` is the same as `start:client` (older name).
