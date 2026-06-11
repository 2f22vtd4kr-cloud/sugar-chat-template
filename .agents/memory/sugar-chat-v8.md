---
name: Sugar Chat v8 Architecture
description: Key decisions, conventions, and system architecture for Sugar Chat v8 (phases 0-5 complete)
---

## Stack
- pnpm monorepo: api-server (Express+Telegraf+BullMQ+Drizzle+Postgres), companion-app (React+Vite+Tailwind+TanStack Query)
- Design: "Liquid Glass Red" — `#090506` background, `#E11D48` crimson accents, glassmorphism utilities in `index.css`

## Phases completed
- **Phase 0**: TypeScript hardening of text-queue (OpenRouterResponse interface, refund helper)
- **Phase 1**: bot/engine.ts — 6 commands, setMyCommands, i18n welcome (EN/ES/UK/DE/IT/RU), deep-link router, /prompt modes
- **Phase 2**: companion-catalog.ts — 12 companions with `preferredTags: string[]` and 5-tier intimacy system injected at queue time
- **Phase 3**: shop.ts — dynamic pricing formula `P_base × (1+0.15×S_spend) × (1−0.20×A_affinity) × (1−0.15×M_flash)`, atomic double-spend via `UPDATE WHERE credits >= price RETURNING`, whale recovery BullMQ 15-min delayed job, `abandonedCheckoutsTable` + `flashSalesTable` in schema
- **Phase 4**: Shop.tsx — SVG vector art cards, 6 category tabs (kinky tab = purple variant), flash sale badges, checkout intent mutation; Inventory.tsx — owned/gifted items, companion picker modal, gift-to-conversation injection; App.tsx — React error boundary wrapper
- **Phase 5**: All 6 locales (en/es/ru/de/it/uk) with `shop.*` and `inventory.*` keys; DB schema extended; error boundary

## Intimacy Tier System
Injected in `text-queue.ts::getIntimacyTierPrefix(affinityLevel)`:
- Tier 1 (0–9): Playful/teasing only
- Tier 2 (10–24): Mild innuendo
- Tier 3 (25–49): Openly sensual
- Tier 4 (50–99): Fully explicit
- Tier 5 (100): Max bond, uncensored

`affinityLevel` is passed from `bot/engine.ts` → `textQueue.add` by fetching current conversation affinity before enqueue.

## Dynamic Pricing
- `S_spend = min(totalHistoricalShopSpend / 1000, 1.0)`
- `A_affinity = conversationAffinity / 100`
- `M_flash = activeFlashSale.discountPct` (0 if none)
- Double-spend: atomic `UPDATE users SET credits = credits - $price WHERE id = $id AND credits >= $price` — check returned rows count.

## Whale Recovery Flow
1. Frontend `POST /api/shop/checkout-intent {itemId}` → BullMQ delayed job (15 min)
2. User purchases → job cancelled, `abandonedCheckouts.convertedAt` set
3. If job fires → activate 1-hour personal flash sale in `flashSalesTable`, send Telegram recovery message with 15% discount

## Key files
- `artifacts/api-server/src/lib/companion-catalog.ts` — 12 companions, preferredTags, intimacy tier instructions
- `artifacts/api-server/src/routes/shop.ts` — dynamic pricing, checkout intent, atomic purchase, inventory gifting
- `artifacts/api-server/src/queues/whale-recovery-queue.ts` — BullMQ whale recovery worker
- `artifacts/api-server/src/queues/text-queue.ts` — affinityLevel injection + getIntimacyTierPrefix
- `lib/db/src/schema/index.ts` — abandonedCheckoutsTable, flashSalesTable, shopInventoryTable with new fields
- `artifacts/companion-app/src/pages/Shop.tsx` — SVG art, kinky tab, flash badge, checkout intent
- `artifacts/companion-app/src/pages/Inventory.tsx` — gift-to-companion flow
- `artifacts/companion-app/src/App.tsx` — React ErrorBoundary, /inventory route
- `artifacts/companion-app/src/index.css` — enhanced Liquid Glass v2 utilities

## **Why** key decisions were made
- Atomic UPDATE WHERE: avoids SELECT + UPDATE race condition (2 round trips) and eliminates need for SELECT FOR UPDATE / advisory locks.
- BullMQ delayed job for whale recovery: lets the Redis queue handle timeout durability; `bullJobId` stored in DB for cancellation on conversion.
- Intimacy tier in queue (not DB): keeps system prompt clean and composable; tier context is ephemeral and changes with each message.
- SVG art inline in Shop: eliminates network requests for card art; each SVG is < 1 KB; consistent with dark theme gradients.
