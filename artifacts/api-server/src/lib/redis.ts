import { Redis, type RedisOptions } from "ioredis";
import { config } from "./config.js";

export const redisConnectionOptions: RedisOptions = {
  maxRetriesPerRequest: null, // required by BullMQ workers
  enableReadyCheck: false,
  retryStrategy: (times) => {
    if (times > 5) return null; // stop retrying after 5 attempts
    return Math.min(times * 500, 3000);
  },
};

/**
 * Pass the full rediss:// URL directly to ioredis.
 * ioredis natively parses rediss:// and enables TLS automatically —
 * no manual host/port/tls parsing needed.
 */
export const createRedisConnection = (): Redis => {
  const redis = new Redis(config.redisUrl, redisConnectionOptions);

  redis.on("connect", () => console.log("[Redis] Connected"));
  redis.on("ready", () => console.log("[Redis] Ready"));
  redis.on("error", (err) => console.error("[Redis] Error:", err.message));

  return redis;
};

export const createBullConnectionOptions = () => ({
  url: config.redisUrl,
  ...redisConnectionOptions,
});

// Shared general-purpose client (not for BullMQ — BullMQ needs its own connections)
export const redis = createRedisConnection();
