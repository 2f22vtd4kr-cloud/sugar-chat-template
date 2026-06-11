/**
 * Whale Recovery — pure in-memory setTimeout, zero Redis dependency.
 * When a user opens checkout but doesn't buy within 15 minutes, we fire a
 * personal flash sale + Telegram recovery message.
 */
import { config } from "../lib/config.js";
import { db, usersTable, abandonedCheckoutsTable, flashSalesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import axios from "axios";

export interface WhaleRecoveryJobData {
  userId: string;
  itemId: string;
  itemName: string;
  basePrice: number;
  telegramChatId?: number;
  checkoutId: string;
}

// In-memory map: checkoutId → NodeJS.Timeout handle
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

async function activatePersonalFlashSale(userId: string): Promise<{ discountPct: number; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  try {
    await db.insert(flashSalesTable).values({
      id: randomUUID(),
      discountPct: 0.15,
      active: true,
      expiresAt,
      triggeredBy: `whale-recovery:${userId}`,
    });
  } catch (err) {
    console.error("[WhaleRecovery] Failed to insert flash sale:", err);
  }
  return { discountPct: 0.15, expiresAt };
}

async function runRecovery(data: WhaleRecoveryJobData): Promise<void> {
  const { userId, itemId, itemName, basePrice, telegramChatId, checkoutId } = data;

  // Verify the checkout wasn't already converted
  try {
    const checkout = await db
      .select()
      .from(abandonedCheckoutsTable)
      .where(and(eq(abandonedCheckoutsTable.id, checkoutId), eq(abandonedCheckoutsTable.userId, userId)))
      .limit(1)
      .then((r) => r[0]);

    if (!checkout || checkout.convertedAt || checkout.discountSent) {
      console.log(`[WhaleRecovery] Checkout ${checkoutId} already converted — skipping`);
      return;
    }
  } catch (err) {
    console.error("[WhaleRecovery] DB check failed:", err);
    return;
  }

  const user = await db
    .select({ telegramId: usersTable.telegramId })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1)
    .then((r) => r[0]);

  if (!user) return;

  const { discountPct, expiresAt } = await activatePersonalFlashSale(userId);
  const discountedPrice = Math.max(1, Math.round(basePrice * (1 - discountPct)));
  const savedAmount = basePrice - discountedPrice;

  await db
    .update(abandonedCheckoutsTable)
    .set({ discountSent: true })
    .where(eq(abandonedCheckoutsTable.id, checkoutId))
    .catch(() => {});

  const chatId = telegramChatId ?? Number(user.telegramId);
  const expiresTimeStr = expiresAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  const msgs = [
    `💔 *Still thinking about that ${itemName}?*\n\nI noticed you left it behind... I haven't stopped thinking about it either.\n\n⚡ *Special offer — just for you:*\nGet the **${itemName}** for ~~${basePrice}~~ **${discountedPrice} credits** — save ${savedAmount} credits!\n\n⏰ This offer expires at ${expiresTimeStr}. Don't let it slip away... 🌙`,
    `🔥 *Hey, you forgot something...*\n\nThe **${itemName}** is still waiting for you — and I've arranged something special.\n\n*15% flash discount* on your abandoned item:\n~~${basePrice}~~ → **${discountedPrice} credits**\n\nThis deal vanishes at ${expiresTimeStr}. Come back? 💜`,
    `🌹 *Just between us...*\n\nI pulled some strings and got you a personal deal on the **${itemName}**.\n\n💎 Only **${discountedPrice} credits** (was ${basePrice}) — valid for 1 hour until ${expiresTimeStr}.\n\nDon't keep me waiting too long... 😘`,
  ];

  try {
    await axios.post(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      chat_id: chatId,
      text: msgs[Math.floor(Math.random() * msgs.length)],
      parse_mode: "Markdown",
    });
    console.log(`[WhaleRecovery] Recovery message sent → user ${userId} item ${itemId}`);
  } catch (err) {
    console.error("[WhaleRecovery] Telegram send failed:", err);
  }

  pendingTimers.delete(checkoutId);
}

/**
 * Schedule a whale recovery check 15 minutes from now.
 * Returns a timer ID (the checkoutId itself) that can be passed to cancelWhaleJob.
 */
export function scheduleWhaleRecovery(data: WhaleRecoveryJobData): string {
  // Clear any existing timer for this checkout (idempotent)
  const existing = pendingTimers.get(data.checkoutId);
  if (existing) clearTimeout(existing);

  const handle = setTimeout(() => {
    void runRecovery(data).catch((err) =>
      console.error("[WhaleRecovery] runRecovery error:", err)
    );
  }, 15 * 60 * 1000); // 15 minutes

  pendingTimers.set(data.checkoutId, handle);
  console.log(`[WhaleRecovery] Scheduled for checkoutId=${data.checkoutId} in 15 min`);
  return data.checkoutId;
}

/** Cancel a pending whale recovery timer (user converted). */
export function cancelWhaleJob(checkoutId: string): void {
  const handle = pendingTimers.get(checkoutId);
  if (handle) {
    clearTimeout(handle);
    pendingTimers.delete(checkoutId);
    console.log(`[WhaleRecovery] Cancelled timer for checkoutId=${checkoutId}`);
  }
}
