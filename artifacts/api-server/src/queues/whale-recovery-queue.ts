import { Queue, Worker, type Job } from "bullmq";
import { createBullConnectionOptions } from "../lib/redis.js";
import { config } from "../lib/config.js";
import { db, usersTable, abandonedCheckoutsTable, flashSalesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import axios from "axios";

export const whaleRecoveryQueue = new Queue("whale-recovery", {
  connection: createBullConnectionOptions(),
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 500,
    attempts: 1,
  },
});

export async function cancelWhaleJob(jobId: string): Promise<void> {
  try {
    const job = await whaleRecoveryQueue.getJob(jobId);
    if (job) await job.remove();
  } catch { /* job may already be gone */ }
}

export interface WhaleRecoveryJobData {
  userId: string;
  itemId: string;
  itemName: string;
  basePrice: number;
  telegramChatId?: number;
  checkoutId: string;
}

// ── Generate a 1-hour personal flash sale ────────────────────────────────────
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

// ── Worker ────────────────────────────────────────────────────────────────────
export const whaleRecoveryWorker = new Worker<WhaleRecoveryJobData>(
  "whale-recovery",
  async (job: Job<WhaleRecoveryJobData>) => {
    const { userId, itemId, itemName, basePrice, telegramChatId, checkoutId } = job.data;

    // Check that the checkout wasn't already converted
    const checkout = await db
      .select()
      .from(abandonedCheckoutsTable)
      .where(and(eq(abandonedCheckoutsTable.id, checkoutId), eq(abandonedCheckoutsTable.userId, userId)))
      .limit(1)
      .then((r) => r[0]);

    if (!checkout || checkout.convertedAt || checkout.discountSent) {
      console.log(`[WhaleRecovery] Checkout ${checkoutId} already converted or discount already sent — skipping`);
      return;
    }

    // Get user's Telegram ID
    const user = await db
      .select({ telegramId: usersTable.telegramId })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .then((r) => r[0]);

    if (!user) return;

    // Activate personal flash sale
    const { discountPct, expiresAt } = await activatePersonalFlashSale(userId);
    const discountedPrice = Math.max(1, Math.round(basePrice * (1 - discountPct)));
    const savedAmount = basePrice - discountedPrice;

    // Mark discount as sent
    await db
      .update(abandonedCheckoutsTable)
      .set({ discountSent: true })
      .where(eq(abandonedCheckoutsTable.id, checkoutId));

    // Send recovery Telegram message
    const chatId = telegramChatId ?? Number(user.telegramId);
    const expiresTimeStr = expiresAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

    const recoveryMessages: string[] = [
      `💔 *Still thinking about that ${itemName}?*\n\nI noticed you left it behind... I haven't stopped thinking about it either.\n\n⚡ *Special offer — just for you:*\nGet the **${itemName}** for ~~${basePrice}~~ **${discountedPrice} credits** — save ${savedAmount} credits!\n\n⏰ This offer expires at ${expiresTimeStr}. Don't let it slip away... 🌙`,
      `🔥 *Hey, you forgot something...*\n\nThe **${itemName}** is still waiting for you — and I've arranged something special.\n\n*15% flash discount* on your abandoned item:\n~~${basePrice}~~ → **${discountedPrice} credits**\n\nThis deal vanishes at ${expiresTimeStr}. Come back? 💜`,
      `🌹 *Just between us...*\n\nI pulled some strings and got you a personal deal on the **${itemName}**.\n\n💎 Only **${discountedPrice} credits** (was ${basePrice}) — valid for 1 hour until ${expiresTimeStr}.\n\nDon't keep me waiting too long... 😘`,
    ];

    const message = recoveryMessages[Math.floor(Math.random() * recoveryMessages.length)]!;

    try {
      await axios.post(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      });
      console.log(`[WhaleRecovery] Recovery message sent to user ${userId} for item ${itemId}`);
    } catch (err) {
      console.error("[WhaleRecovery] Failed to send recovery message:", err);
    }
  },
  {
    connection: createBullConnectionOptions(),
    concurrency: 10,
  }
);

whaleRecoveryWorker.on("failed", (job: Job<WhaleRecoveryJobData> | undefined, err: Error) => {
  console.error(`[WhaleRecovery] Job ${job?.id ?? "unknown"} failed:`, err.message);
});
