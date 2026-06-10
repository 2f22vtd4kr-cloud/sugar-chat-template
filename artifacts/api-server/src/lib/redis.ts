import { Redis } from "ioredis";
import { config } from "./config.js";

function parseRedisUrl(url: string): { host: string; port: number; password?: string; tls: boolean } {
  const parsed = new URL(url);
  const tls = parsed.protocol === "rediss:";
  const host = parsed.hostname;
  const port = parseInt(parsed.port || (tls ? "6380" : "6379"), 10);
  const password = parsed.password || undefined;
  return { host, port, password, tls };
}

// Separate connection for BullMQ (cannot be reused across queue/worker contexts)
export const createRedisConnection = (): Redis => {
  const { host, port, password, tls } = parseRedisUrl(config.redisUrl);
  const redis = new Redis({
    host,
    port,
    password,
    tls: tls ? {} : undefined,
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,
  });
  redis.on("error", (err) => {
    console.error("[Redis] Connection error:", err.message);
  });
  return redis;
};

// Shared general-purpose Redis client
export const redis = createRedisConnection();
