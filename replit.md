# Sugar Chat Template v7.1

Premium Telegram Mini App + bot template with a crimson Liquid Glass UI, dynamic i18n, Stars subscriptions, NSFW age gate, Telegram Premium detection, and companion progression systems.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/companion-app run dev` — run the Telegram Mini App frontend
- `pnpm run typecheck` — full workspace typecheck
- `pnpm run build` — full workspace build
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes in development

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Frontend: Vite, React, react-i18next, Framer Motion, Wouter
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval from OpenAPI

## Where things live

- DB schema: [lib/db/src/schema/index.ts](lib/db/src/schema/index.ts)
- API startup and seeding: [artifacts/api-server/src/index.ts](artifacts/api-server/src/index.ts)
- Companion seed definitions: [artifacts/api-server/src/seed/companions.ts](artifacts/api-server/src/seed/companions.ts)
- Frontend theme tokens and Liquid Glass utilities: [artifacts/companion-app/src/index.css](artifacts/companion-app/src/index.css)
- i18n bootstrap: [artifacts/companion-app/src/i18n/index.ts](artifacts/companion-app/src/i18n/index.ts)
- Telegram WebApp context and premium detection: [artifacts/companion-app/src/context/TelegramContext.tsx](artifacts/companion-app/src/context/TelegramContext.tsx)
- NSFW gate: [artifacts/companion-app/src/App.tsx](artifacts/companion-app/src/App.tsx)
- Dashboard and Settings polish: [artifacts/companion-app/src/pages/Dashboard.tsx](artifacts/companion-app/src/pages/Dashboard.tsx) and [artifacts/companion-app/src/pages/Settings.tsx](artifacts/companion-app/src/pages/Settings.tsx)

## Architecture decisions

- Keep Telegram initData validation on the API server and mirror premium status into the users table during auth refresh.
- Centralize the visual system in CSS utility classes so the Mini App can keep a consistent Liquid Glass theme across pages.
- Store localization strings in JSON per locale and wire them through react-i18next with localStorage language persistence.
- Seed companion archetypes from a dedicated module so technical metadata and insert payloads stay separated.

## Product

- Telegram-native companion UI with conversations, credits, subscriptions, streaks, affinity, gifts, and localized surfaces.

## Gotchas

- Keep new translation keys present in all six locale files before shipping UI changes.
- Update the API seed module and the frontend together when changing companion metadata fields.
- Premium status should always be refreshed from initData on auth and reflected in the users table.

