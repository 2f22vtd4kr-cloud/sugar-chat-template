---
name: Sugar Chat v7 Architecture
description: Key decisions, file layout, and conventions for the Sugar Chat v7.0 platform
---

## Stack
- Express 5 + Drizzle ORM + PostgreSQL (lib/db)
- BullMQ + ioredis (rediss:// URL directly)
- Telegraf bot, React+Vite Telegram Mini App
- OpenRouter AI, Pollinations.ai images

## DB columns added (v7 migration)
users table: language (text, default "en"), adult_confirmed (boolean, default false), is_telegram_premium (boolean, default false), first_name (text nullable)
subscriptions table: new table — id, userId, planId, starsPaymentId, startsAt, expiresAt, status, createdAt

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

## Auth (fetch interceptor)
- window.fetch is overridden in TelegramContext.tsx to inject x-telegram-init-data header on ALL requests
- The old src/lib/api.ts is now a no-op stub (legacy)
- Dev mode: backend uses mock user (telegramId: 1234567890, username: dev_user)

## Subscription Plans
- SUBSCRIPTION_PLANS exported from src/routes/plans.ts: weekly (49⭐, 7d), monthly (175⭐, 30d)
- Invoice: POST /api/plans/invoice { planId } → { invoiceLink }
- Active sub: GET /api/plans/active
- Bot successful_payment: payload "sub:weekly" / "sub:monthly" → calls activateSubscription()
- Credit packs: payload "starter"/"popular"/"premium" (unchanged)

## Nav structure (5 items)
Home (/), Explore (/companions), Chats (/conversations), Credits (/credits), Settings (/settings)
Plans (/plans) accessible from Credits page and Dashboard banner — NOT in bottom nav

**Why:** 5-item bottom nav is the mobile standard (Instagram/TikTok pattern); Plans is a conversion page not a daily-use destination.
