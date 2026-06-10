---
name: Redis TLS fix
description: How to connect ioredis to Upstash/rediss:// correctly — avoid manual URL parsing.
---

**Rule:** Pass the full `rediss://` URL string directly as the first argument to `new Redis(url, options)`. ioredis natively detects `rediss://` and enables TLS automatically. Do NOT manually parse the URL into host/port/password and set `tls: {}` separately — that approach causes ECONNRESET because the TLS params can conflict.

**Why:** Previous code manually parsed the URL with a custom `parseRedisUrl()` function and built an options object. When the REDIS_URL switched from `redis://` to `rediss://`, the manual TLS setup caused TCP ECONNRESET on every connection attempt. Passing the raw URL string let ioredis handle TLS negotiation correctly.

**How to apply:** 
```ts
const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => times > 5 ? null : Math.min(times * 500, 3000),
});
```
BullMQ workers require `maxRetriesPerRequest: null`.
