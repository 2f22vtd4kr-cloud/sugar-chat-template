---
name: Telegram Stars payments
description: How to implement Telegram Stars (XTR) payments in a Telegraf bot + Mini App.
---

**Rule:** Stars payments use `currency: "XTR"` and `provider_token: ""` (empty string). The `prices[].amount` is in Stars (not cents). Minimum 1 Star.

**Bot flow:**
1. `ctx.replyWithInvoice({ currency: "XTR", provider_token: "", prices: [{label, amount: stars}], payload: packageId })`
2. `bot.on("pre_checkout_query")` → always `ctx.answerPreCheckoutQuery(true)` for XTR
3. `bot.on("message")` → check `ctx.message.successful_payment` with `currency === "XTR"`, then credit user via DB transaction using `payment.invoice_payload` and `payment.telegram_payment_charge_id` as referenceId

**Mini App flow:**
- Call backend `POST /api/credits/stars-invoice` → backend calls `bot.telegram.createInvoiceLink(...)` → returns `{ invoiceLink }`
- Frontend calls `window.Telegram.WebApp.openInvoice(invoiceLink, callback)` where callback receives `"paid" | "cancelled" | "failed"`

**Why:** createInvoiceLink is needed for Mini App because the WebApp can't initiate a bot message itself. The bot handles the actual payment confirmation webhook.

**Important:** The `successful_payment` handler must be registered with `bot.on("message", ...)` middleware pattern (not `bot.on("successful_payment", ...)`) to work reliably with Telegraf v4.
