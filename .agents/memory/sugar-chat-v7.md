---
name: Sugar Chat v7 Architecture
description: Key decisions, file layout, and conventions for the Sugar Chat v7 platform (including v7.3 features)
---

## Stack
- Express 5 + Drizzle ORM + PostgreSQL (lib/db)
- BullMQ + ioredis (rediss:// URL directly)
- Telegraf bot, React+Vite Telegram Mini App
- OpenRouter AI, Pollinations.ai images

## DB columns added (v7 migration)
users table: language (text, default "en"), adult_confirmed (boolean, default false), is_telegram_premium (boolean, default false), first_name (text nullable), birth_date (text nullable, added v7.3)
subscriptions table: new table — id, userId, planId, starsPaymentId, startsAt, expiresAt, status, createdAt
tarotReadingsTable: new table (v7.3) — id, userId, companionId, topic, spreadType, cards (jsonb), readingText, affinityGain, createdAt

## Theme: Red Liquid Glass
- CSS custom properties in index.css — --background: 340 28% 5%, --primary: 348 76% 49%
- Utility classes: .glass, .glass-card, .glass-nav, .glow-red, .gradient-red, .text-gradient-red
- Font: Outfit / Inter

## NSFW Gate
- NsfwGate wraps Router in App.tsx; uses useGetMe to check adultConfirmed
- Calls PATCH /api/users/me { adultConfirmed: true } on confirmation
- Shows NsfwModal component (src/components/NsfwModal.tsx)

## i18n
- 6 locales: en, es, ru, de, it, uk (src/locales/*.json)
- i18next + react-i18next + i18next-browser-languagedetector
- Import i18n in main.tsx BEFORE App renders
- Language persisted in localStorage key "sugar_lang" + DB via PATCH /api/users/me
- v7.3 keys added: tarot.*, gifts.*, streak.*

## Auth (fetch interceptor)
- window.fetch is overridden in TelegramContext.tsx to inject x-telegram-init-data header on ALL requests
- The old src/lib/api.ts is now a no-op stub (legacy)
- Dev mode: backend uses mock user (telegramId: 1234567890, username: dev_user)

## Middleware Convention
- Auth middleware export name: `requireTelegramAuth` (NOT `requireUser`)
- File: `artifacts/api-server/src/middlewares/telegram-auth.ts`
- Sets on req: `req.telegramUser`, `req.dbUserId`, `req.telegramPremium`
- Routes use `req.dbUserId!` directly — never `req.user`

**Why:** A previous session used `requireUser` in a new route and caused a build failure. Always check exports before importing from this file.

## Subscription Plans
- SUBSCRIPTION_PLANS exported from src/routes/plans.ts: weekly (49⭐, 7d), monthly (175⭐, 30d)
- Invoice: POST /api/plans/invoice { planId } → { invoiceLink }
- Active sub: GET /api/plans/active
- Bot successful_payment: payload "sub:weekly" / "sub:monthly" → calls activateSubscription()
- Credit packs: payload "starter"/"popular"/"premium" (unchanged)

## Companion Catalog (v7.3 — 12 locked archetypes)
Slugs (used as PK): elena-voss, mia-reyes, lilith-vex, hana-sato, rhea-kane, raven-noir, nya-miko, sylvana-nightwhisper, victoria-hale, sophie-laurent, alex-rivera, isabella-rose
File: `artifacts/api-server/src/lib/companion-catalog.ts`
All companions are locked (require subscription).

## Tarot System (v7.3)
- 78-card DB: `artifacts/companion-app/src/tarot/cards.ts` (frontend) and `artifacts/api-server/src/tarot/cards.ts` (backend)
- Topics: love, career, spiritual, general, shadow
- Spread types: three_card (2 affinity), five_card (4 affinity)
- API routes: GET /api/tarot/topics, POST /api/tarot/reading, GET /api/tarot/history
- Frontend: `/tarot/:companionId` route, Tarot button in ConversationDetail

## API Server Startup Requirements
Requires ALL of these env vars (missing any → crash):
TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, REDIS_URL, OPENROUTER_API_KEY, ADMIN_PASS, DATABASE_URL

## TypeScript Notes
- Pre-existing TS errors: `lib/db/dist` and `lib/api-client-react/dist` not built (tsc --noEmit shows TS6305)
- Does NOT affect esbuild compilation — `node ./build.mjs` succeeds
- `vite build` needs PORT env var (only set at runtime by workflow)

## Nav structure (5 items)
Home (/), Explore (/companions), Chats (/conversations), Credits (/credits), Settings (/settings)
Plans (/plans) accessible from Credits page and Dashboard banner — NOT in bottom nav

**Why:** 5-item bottom nav is the mobile standard (Instagram/TikTok pattern); Plans is a conversion page not a daily-use destination.

## Version
Current: v7.3 (displayed in Settings.tsx)
