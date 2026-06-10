import crypto from "crypto";
import { config } from "./config.js";

export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface ParsedInitData {
  user?: TelegramUser;
  auth_date: number;
  hash: string;
}

/**
 * Validates Telegram WebApp initData using HMAC-SHA256.
 * Returns parsed data on success, throws on failure.
 */
export function validateTelegramInitData(initData: string): ParsedInitData {
  if (!initData) throw new Error("No initData provided");

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new Error("Missing hash in initData");

  // Build data-check-string: all fields except hash, sorted alphabetically
  params.delete("hash");
  const dataCheckArr: string[] = [];
  params.forEach((val, key) => dataCheckArr.push(`${key}=${val}`));
  dataCheckArr.sort();
  const dataCheckString = dataCheckArr.join("\n");

  // HMAC-SHA256 with secret key = HMAC-SHA256("WebAppData", botToken)
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(config.telegramBotToken)
    .digest();

  const expectedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (expectedHash !== hash) {
    throw new Error("Invalid initData signature");
  }

  const authDate = parseInt(params.get("auth_date") ?? "0", 10);
  const now = Math.floor(Date.now() / 1000);

  // Reject data older than 1 hour
  if (now - authDate > 3600) {
    throw new Error("initData expired");
  }

  const userRaw = params.get("user");
  const user = userRaw ? (JSON.parse(userRaw) as TelegramUser) : undefined;

  return { user, auth_date: authDate, hash };
}

/**
 * Development fallback: parse initData without validation.
 * Only used when NODE_ENV is development and initData is empty or missing.
 */
export function parseInitDataDev(initData: string): ParsedInitData | null {
  if (!initData) return null;
  try {
    const params = new URLSearchParams(initData);
    const userRaw = params.get("user");
    const user = userRaw ? (JSON.parse(userRaw) as TelegramUser) : undefined;
    return { user, auth_date: Math.floor(Date.now() / 1000), hash: "" };
  } catch {
    return null;
  }
}
