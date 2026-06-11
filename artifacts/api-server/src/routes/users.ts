import { Router } from "express";
import { requireTelegramAuth } from "../middlewares/telegram-auth.js";
import { db, usersTable, messagesTable, conversationsTable, companionsTable, ledgerEntriesTable, subscriptionsTable } from "@workspace/db";
import { eq, sum, count, and, gte } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

function serializeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    telegramId: user.telegramId.toString(),
    username: user.username,
    firstName: user.firstName,
    credits: user.credits,
    freeImagesSent: user.freeImagesSent,
    language: user.language,
    adultConfirmed: user.adultConfirmed,
    isTelegramPremium: user.isTelegramPremium,
    streakDays: user.streakDays,
    createdAt: user.createdAt.toISOString(),
  };
}

function todayDateString() {
  return new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
}

function streakRewardCredits(streakDays: number): number {
  if (streakDays % 30 === 0) return 25;
  if (streakDays % 7 === 0) return 10;
  return 3;
}

// GET /api/users/me
router.get("/me", requireTelegramAuth, async (req, res) => {
  const user = await db.select().from(usersTable).where(eq(usersTable.id, req.dbUserId!)).limit(1).then((r) => r[0]);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(serializeUser(user));
});

// PATCH /api/users/me
router.patch("/me", requireTelegramAuth, async (req, res) => {
  const { adultConfirmed, language } = req.body as { adultConfirmed?: boolean; language?: string };
  const allowed = ["en", "es", "ru", "de", "it", "uk"];
  const updates: Partial<typeof usersTable.$inferInsert> & { updatedAt?: Date } = { updatedAt: new Date() };
  if (typeof adultConfirmed === "boolean") updates.adultConfirmed = adultConfirmed;
  if (language && allowed.includes(language)) updates.language = language;
  if (typeof req.telegramPremium === "boolean") updates.isTelegramPremium = req.telegramPremium;
  await db.update(usersTable).set(updates).where(eq(usersTable.id, req.dbUserId!));
  const user = await db.select().from(usersTable).where(eq(usersTable.id, req.dbUserId!)).limit(1).then((r) => r[0]!);
  res.json(serializeUser(user));
});

// GET /api/users/me/bonuses
router.get("/me/bonuses", requireTelegramAuth, async (req, res) => {
  const userId = req.dbUserId!;
  const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1).then((r) => r[0]);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const activeSubscription = await db
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.userId, userId),
        eq(subscriptionsTable.status, "active"),
        gte(subscriptionsTable.expiresAt, new Date())
      )
    )
    .orderBy(subscriptionsTable.expiresAt)
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const hasPremiumAccess = user.isTelegramPremium || activeSubscription !== null;
  const perks = hasPremiumAccess
    ? {
        extraEnergyPerDay: 3,
        priorityMultiplier: 1.25,
        dailyImageCredits: 1,
        badgeLabel: activeSubscription ? "VIP Subscriber" : "Telegram Premium",
      }
    : {
        extraEnergyPerDay: 0,
        priorityMultiplier: 1,
        dailyImageCredits: 0,
        badgeLabel: "Standard",
      };

  res.json({
    hasPremiumAccess,
    isTelegramPremium: user.isTelegramPremium,
    activeSubscription: activeSubscription
      ? {
          id: activeSubscription.id,
          planId: activeSubscription.planId,
          expiresAt: activeSubscription.expiresAt.toISOString(),
        }
      : null,
    ...perks,
  });
});

// GET /api/users/me/streak
router.get("/me/streak", requireTelegramAuth, async (req, res) => {
  const user = await db.select().from(usersTable).where(eq(usersTable.id, req.dbUserId!)).limit(1).then((r) => r[0]);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const today = todayDateString();
  const canClaimToday = user.lastLoginDate !== today;
  const nextStreakDays = canClaimToday ? user.streakDays + 1 : user.streakDays;
  const nextRewardCredits = streakRewardCredits(nextStreakDays);

  res.json({
    streakDays: user.streakDays,
    lastLoginDate: user.lastLoginDate,
    canClaimToday,
    nextRewardCredits,
    isWeeklyBonus: nextStreakDays % 7 === 0,
    isMonthlyBonus: nextStreakDays % 30 === 0,
  });
});

// POST /api/users/me/streak/claim — claim daily streak reward
router.post("/me/streak/claim", requireTelegramAuth, async (req, res) => {
  const user = await db.select().from(usersTable).where(eq(usersTable.id, req.dbUserId!)).limit(1).then((r) => r[0]);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const today = todayDateString();
  if (user.lastLoginDate === today) {
    res.status(400).json({ error: "Already claimed today" });
    return;
  }

  // If last login was yesterday, continue streak; otherwise reset to 1
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];
  const newStreakDays = user.lastLoginDate === yesterdayStr ? user.streakDays + 1 : 1;
  const rewardCredits = streakRewardCredits(newStreakDays);

  await db.update(usersTable).set({
    streakDays: newStreakDays,
    lastLoginDate: today,
    credits: user.credits + rewardCredits,
    updatedAt: new Date(),
  }).where(eq(usersTable.id, req.dbUserId!));

  await db.insert(ledgerEntriesTable).values({
    id: randomUUID(),
    userId: req.dbUserId!,
    amount: rewardCredits,
    type: "STREAK_REWARD",
    referenceId: `streak-${req.dbUserId!}-${today}`,
    description: `Day ${newStreakDays} streak reward — +${rewardCredits} credits`,
  });

  res.json({
    streakDays: newStreakDays,
    rewardCredits,
    newCreditBalance: user.credits + rewardCredits,
    isWeeklyBonus: newStreakDays % 7 === 0,
    isMonthlyBonus: newStreakDays % 30 === 0,
  });
});

// GET /api/users/me/stats
router.get("/me/stats", requireTelegramAuth, async (req, res) => {
  const userId = req.dbUserId!;
  const [textStats, spendStats, conversations, topConversation] = await Promise.all([
    db.select({ total: count() }).from(messagesTable).innerJoin(conversationsTable, eq(messagesTable.conversationId, conversationsTable.id)).where(eq(conversationsTable.userId, userId)).then((r) => r[0]?.total ?? 0),
    db.select({ total: sum(ledgerEntriesTable.amount) }).from(ledgerEntriesTable).where(eq(ledgerEntriesTable.userId, userId)).then((r) => Math.abs(Number(r[0]?.total ?? 0))),
    db.select({ affinity: conversationsTable.affinity }).from(conversationsTable).where(eq(conversationsTable.userId, userId)),
    db.select({ name: companionsTable.name, affinity: conversationsTable.affinity }).from(conversationsTable).innerJoin(companionsTable, eq(conversationsTable.companionId, companionsTable.id)).where(eq(conversationsTable.userId, userId)).orderBy(conversationsTable.affinity).limit(1).then((r) => r[0]),
  ]);
  res.json({ totalMessages: Number(textStats), totalCreditsSpent: Number(spendStats), topCompanion: topConversation?.name ?? null, affinityTotal: conversations.reduce((s, c) => s + c.affinity, 0) });
});

export default router;
