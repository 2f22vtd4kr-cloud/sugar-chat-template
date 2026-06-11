---
name: Telegraf webApp button URL
description: Markup.button.webApp() silently kills the bot — use Markup.button.url() for t.me links
---

## Rule
Never use `Markup.button.webApp(text, url)` with a `https://t.me/botname/app` URL. It causes a `400: Bad Request: BUTTON_URL_INVALID` error that propagates up through Telegraf and kills the long-polling loop permanently until the process restarts.

## Why
Telegram's Bot API `web_app` button type requires the `url` field to be the **direct HTTPS URL** of the web app (the actual deployed domain, e.g. `https://myapp.replit.app`), NOT a `t.me` redirect. A `t.me/botname/app` URL is valid for sharing but invalid as a `web_app` button URL.

Without a `bot.catch()` global handler, the first handler crash kills the Telegraf polling loop entirely — every subsequent user message is silently ignored. The bot appears "silent" even though the process is still running.

## How to apply
- **Reply keyboard webApp buttons**: Change to `Markup.inlineKeyboard([[Markup.button.url(text, tmeUrl)]])`. Inline keyboard `url` buttons DO accept `t.me` URLs and correctly open the Mini App.
- **Inline keyboard webApp buttons**: Change `Markup.button.webApp()` → `Markup.button.url()`.
- **If you have the real HTTPS app URL** (via a `MINI_APP_URL` env var): you CAN use `Markup.button.webApp()` with it.
- **Always add** `bot.catch((err, ctx) => { console.error(...) })` before `bot.launch()` to prevent any handler crash from killing polling.
