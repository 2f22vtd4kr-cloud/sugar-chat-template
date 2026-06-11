import { Router } from "express";
import { requireTelegramAuth } from "../middlewares/telegram-auth.js";
import { db, subscriptionsTable, ledgerEntriesTable, usersTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import { bot } from "../bot/engine.js";

const router = Router();

export const SUBSCRIPTION_PLANS: Record<string, {
  id: string; label: string; stars: number; daysValid: number;
  description: string; benefits: string[];
}> = {
  weekly: {
    id: "weekly", label: "Weekly Pass", stars: 49, daysValid: 7,
    description: "Unlimited text chats + 5 daily image credits",
    benefits: ["unlimited_chat", "daily_images", "premium_badge"],
  },
  monthly: {
    id: "monthly", label: "Monthly VIP", stars: 175, daysValid: 30,
    description: "Everything in Weekly + priority AI + 50% off images",
    benefits: ["unlimited_chat", "daily_images", "priority_ai", "half_images", "premium_badge"],
  },
};

// GET /api/plans — list all plans
router.get("/", requireTelegramAuth, (_req, res) => {
  res.json(Object.values(SUBSCRIPTION_PLANS));
});

// GET /api/plans/active — current user's active subscription
router.get("/active", requireTelegramAuth, async (req, res) => {
  const sub = await db
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.userId, req.dbUserId!),
        eq(subscriptionsTable.status, "active"),
        gte(subscriptionsTable.expiresAt, new Date())
      )
    )
    .orderBy(subscriptionsTable.expiresAt)
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!sub) { res.json(null); return; }

  res.json({
    id: sub.id,
    planId: sub.planId,
    startsAt: sub.startsAt.toISOString(),
    expiresAt: sub.expiresAt.toISOString(),
    status: sub.status,
    plan: SUBSCRIPTION_PLANS[sub.planId] ?? null,
  });
});

// POST /api/plans/invoice — generate Stars invoice link for a subscription
router.post("/invoice", requireTelegramAuth, async (req, res) => {
  const { planId } = req.body as { planId: string };
  const plan = SUBSCRIPTION_PLANS[planId];
  if (!plan) { res.status(400).json({ error: "Invalid plan" }); return; }

  try {
    const invoiceLink = await bot.telegram.createInvoiceLink({
      title: plan.label,
      description: plan.description,
      payload: `sub:${planId}`,
      currency: "XTR",
      prices: [{ label: plan.label, amount: plan.stars }],
      provider_token: "",
    });
    res.json({ invoiceLink });
  } catch (err: any) {
    console.error("[Plans] Failed to create invoice:", err?.message);
    res.status(500).json({ error: "Failed to create invoice link" });
  }
});

// Called by the bot's successful_payment handler to activate a subscription
export async function activateSubscription(userId: string, planId: string, paymentId: string) {
  const plan = SUBSCRIPTION_PLANS[planId];
  if (!plan) throw new Error(`Unknown plan: ${planId}`);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + plan.daysValid * 24 * 60 * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx.insert(subscriptionsTable).values({
      id: randomUUID(),
      userId,
      planId,
      starsPaymentId: paymentId,
      startsAt: now,
      expiresAt,
      status: "active",
    });

    await tx
      .update(usersTable)
      .set({ isTelegramPremium: true, updatedAt: now })
      .where(eq(usersTable.id, userId));

    await tx.insert(ledgerEntriesTable).values({
      id: randomUUID(),
      userId,
      amount: 0,
      type: "SUBSCRIPTION",
      referenceId: paymentId,
      description: `${plan.label} activated — expires ${expiresAt.toLocaleDateString()}`,
    });
  });
}

export default router;
