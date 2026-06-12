import { Router } from "express";
import { requireTelegramAuth } from "../middlewares/telegram-auth.js";
import { db, usersTable, messagesTable, conversationsTable, companionsTable, ledgerEntriesTable, subscriptionsTable, shopInventoryTable } from "@workspace/db";
import { eq, sum, count, and, gte } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

// ── Streak reward schedule (7-day cycle) ─────────────────────────────────────
// Conservative rewards — profitable for a business, engaging for users
const WEEK_CYCLE_CREDITS = [3, 4, 5, 3, 3, 4, 10]; // index 6 = weekly bonus day

function streakRewardCredits(streakDays: number): number {
  if (streakDays > 0 && streakDays % 30 === 0) return 15;  // monthly bonus
  const posInCycle = (streakDays - 1) % 7;                  // 0-indexed
  return WEEK_CYCLE_CREDITS[posInCycle] ?? 3;
}

interface MilestoneInfo {
  targetDays: number;
  daysLeft: number;
  creditsBonus: number;
  label: string;
  hasGift: boolean;
  emoji: string;
}

const MILESTONES: Array<{ days: number; label: string; bonus: number; hasGift: boolean; emoji: string }> = [
  { days: 7,   label: "Week 1",      bonus: 10, hasGift: true,  emoji: "🌹" },
  { days: 14,  label: "Week 2",      bonus: 12, hasGift: true,  emoji: "💍" },
  { days: 21,  label: "Week 3",      bonus: 12, hasGift: false, emoji: "⭐" },
  { days: 30,  label: "Month 1",     bonus: 15, hasGift: true,  emoji: "💎" },
  { days: 60,  label: "Month 2",     bonus: 20, hasGift: false, emoji: "🔥" },
  { days: 90,  label: "3-Month VIP", bonus: 25, hasGift: true,  emoji: "👑" },
];

const MILESTONE_GIFTS: Record<number, { itemId: string; itemName: string; emoji: string }> = {
  7:  { itemId: "streak-rose",     itemName: "Streak Rose",     emoji: "🌹" },
  14: { itemId: "streak-bracelet", itemName: "Streak Bracelet", emoji: "💍" },
  30: { itemId: "streak-diamond",  itemName: "Streak Diamond",  emoji: "💎" },
  90: { itemId: "streak-crown",    itemName: "VIP Crown",       emoji: "👑" },
};

function getNextMilestone(streakDays: number): MilestoneInfo | null {
  const next = MILESTONES.find(m => m.days > streakDays);
  if (!next) return null;
  return {
    targetDays:   next.days,
    daysLeft:     next.days - streakDays,
    creditsBonus: next.bonus,
    label:        next.label,
    hasGift:      next.hasGift,
    emoji:        next.emoji,
  };
}

function getWeekSchedule(streakDays: number, canClaimToday: boolean) {
  const posInCycle = streakDays % 7; // how many days claimed in current cycle
  return WEEK_CYCLE_CREDITS.map((credits, i) => ({
    dayOffset:  i + 1,
    credits,
    isBonusDay: i === 6,
    claimed:    i < posInCycle,
    isToday:    canClaimToday && i === posInCycle,
  }));
}

// ── Serializers ───────────────────────────────────────────────────────────────
function serializeUser(user: typeof usersTable.$inferSelect) {
  return {
    id:               user.id,
    telegramId:       user.telegramId.toString(),
    username:         user.username,
    firstName:        user.firstName,
    credits:          user.credits,
    freeImagesSent:   user.freeImagesSent,
    language:         user.language,
    adultConfirmed:   user.adultConfirmed,
    isTelegramPremium:user.isTelegramPremium,
    streakDays:       user.streakDays,
    createdAt:        user.createdAt.toISOString(),
  };
}

function todayDateString() {
  return new Date().toISOString().split("T")[0];
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/users/me
router.get("/me", requireTelegramAuth, async (req, res) => {
  const user = await db.select().from(usersTable).where(eq(usersTable.id, req.dbUserId!)).limit(1).then((r) => r[0]);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(serializeUser(user));
});

// PATCH /api/users/me
router.patch("/me", requireTelegramAuth, async (req, res) => {
  const { adultConfirmed, language, dailyTarotEnabled } = req.body as { adultConfirmed?: boolean; language?: string; dailyTarotEnabled?: boolean };
  const allowed = ["en", "es", "ru", "de", "it", "uk"];
  const updates: Partial<typeof usersTable.$inferInsert> & { updatedAt?: Date } = { updatedAt: new Date() };
  if (typeof adultConfirmed === "boolean") updates.adultConfirmed = adultConfirmed;
  if (language && allowed.includes(language)) updates.language = language;
  if (typeof dailyTarotEnabled === "boolean") updates.dailyTarotEnabled = dailyTarotEnabled;
  if (typeof req.telegramPremium === "boolean") updates.isTelegramPremium = req.telegramPremium;
  await db.update(usersTable).set(updates).where(eq(usersTable.id, req.dbUserId!));
  const user = await db.select().from(usersTable).where(eq(usersTable.id, req.dbUserId!)).limit(1).then((r) => r[0]!);
  res.json({ ...serializeUser(user), dailyTarotEnabled: user.dailyTarotEnabled });
});

// GET /api/users/me/bonuses
router.get("/me/bonuses", requireTelegramAuth, async (req, res) => {
  const userId = req.dbUserId!;
  const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1).then((r) => r[0]);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const activeSubscription = await db
    .select().from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.userId, userId), eq(subscriptionsTable.status, "active"), gte(subscriptionsTable.expiresAt, new Date())))
    .orderBy(subscriptionsTable.expiresAt).limit(1).then((rows) => rows[0] ?? null);

  const hasPremiumAccess = user.isTelegramPremium || activeSubscription !== null;
  const perks = hasPremiumAccess
    ? { extraEnergyPerDay: 3, priorityMultiplier: 1.25, dailyImageCredits: 1, badgeLabel: activeSubscription ? "VIP Subscriber" : "Telegram Premium" }
    : { extraEnergyPerDay: 0, priorityMultiplier: 1, dailyImageCredits: 0, badgeLabel: "Standard" };

  res.json({
    hasPremiumAccess,
    isTelegramPremium: user.isTelegramPremium,
    activeSubscription: activeSubscription
      ? { id: activeSubscription.id, planId: activeSubscription.planId, expiresAt: activeSubscription.expiresAt.toISOString() }
      : null,
    ...perks,
  });
});

// GET /api/users/me/streak
router.get("/me/streak", requireTelegramAuth, async (req, res) => {
  const user = await db.select().from(usersTable).where(eq(usersTable.id, req.dbUserId!)).limit(1).then((r) => r[0]);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const today = todayDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const canClaimToday = user.lastLoginDate !== today;

  // Detect whether the streak is continuing or broken (would reset to 1)
  const streakIsBroken = canClaimToday
    && user.lastLoginDate !== null
    && user.lastLoginDate !== yesterdayStr;

  // Projected days after claim — reset to 1 if broken, increment if continuing
  const nextStreakDays = canClaimToday
    ? (streakIsBroken ? 1 : user.streakDays + 1)
    : user.streakDays;

  const nextRewardCredits = streakRewardCredits(nextStreakDays);
  const nextMilestone = getNextMilestone(nextStreakDays);

  // Show week schedule as it will look AFTER claiming
  const scheduleBase = streakIsBroken ? 0 : user.streakDays;

  res.json({
    streakDays:        user.streakDays,
    lastLoginDate:     user.lastLoginDate,
    canClaimToday,
    streakWillReset:   streakIsBroken,
    nextRewardCredits,
    isWeeklyBonus:     nextStreakDays % 7 === 0 && nextStreakDays > 0,
    isMonthlyBonus:    nextStreakDays % 30 === 0 && nextStreakDays > 0,
    weekSchedule:      getWeekSchedule(scheduleBase, canClaimToday),
    nextMilestone,
    allMilestones:     MILESTONES.map(m => ({
      days:      m.days,
      label:     m.label,
      bonus:     m.bonus,
      hasGift:   m.hasGift,
      emoji:     m.emoji,
      achieved:  user.streakDays >= m.days,
    })),
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

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];
  const newStreakDays = user.lastLoginDate === yesterdayStr ? user.streakDays + 1 : 1;
  const rewardCredits = streakRewardCredits(newStreakDays);
  const isWeeklyBonus  = newStreakDays % 7 === 0;
  const isMonthlyBonus = newStreakDays % 30 === 0;
  const streakReset    = user.lastLoginDate !== null && user.lastLoginDate !== yesterdayStr && user.streakDays > 0;

  await db.update(usersTable).set({
    streakDays:    newStreakDays,
    lastLoginDate: today,
    credits:       user.credits + rewardCredits,
    updatedAt:     new Date(),
  }).where(eq(usersTable.id, req.dbUserId!));

  await db.insert(ledgerEntriesTable).values({
    id:          randomUUID(),
    userId:      req.dbUserId!,
    amount:      rewardCredits,
    type:        "STREAK_REWARD",
    referenceId: `streak-${req.dbUserId!}-${today}`,
    description: `Day ${newStreakDays} streak reward — +${rewardCredits} credits`,
  });

  // Grant milestone gift if applicable
  let milestoneGift: { itemName: string; emoji: string } | null = null;
  const gift = MILESTONE_GIFTS[newStreakDays];
  if (gift) {
    await db.insert(shopInventoryTable).values({
      id:        randomUUID(),
      userId:    req.dbUserId!,
      itemId:    gift.itemId,
      itemName:  `${gift.emoji} ${gift.itemName}`,
      creditsCost: 0,
      isGifted:  false,
    });
    milestoneGift = { itemName: gift.itemName, emoji: gift.emoji };
  }

  res.json({
    streakDays:       newStreakDays,
    rewardCredits,
    newCreditBalance: user.credits + rewardCredits,
    isWeeklyBonus,
    isMonthlyBonus,
    milestoneGift,
    streakReset,
    weekSchedule:     getWeekSchedule(newStreakDays, false),
    nextMilestone:    getNextMilestone(newStreakDays),
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
