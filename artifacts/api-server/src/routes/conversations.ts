import { Router } from "express";
import { requireTelegramAuth } from "../middlewares/telegram-auth.js";
import { db, conversationsTable, companionsTable, messagesTable, usersTable, ledgerEntriesTable, giftsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

const GIFTS = {
  rose:    { creditsCost: 2,  affinityGain: 3,  emoji: "🌹", reaction: "Oh, a rose for me? You're so thoughtful... 🌹 My heart skips a beat when I look at it." },
  heart:   { creditsCost: 5,  affinityGain: 8,  emoji: "💝", reaction: "A heart gift! I feel so incredibly loved right now... 💝 Thank you so much, it means the world to me." },
  diamond: { creditsCost: 15, affinityGain: 25, emoji: "💎", reaction: "A diamond?! Oh my... you're making me blush so hard right now! 💎 I feel incredibly special. No one has ever done something like this for me." },
  star:    { creditsCost: 30, affinityGain: 50, emoji: "⭐", reaction: "A star... just for me. ⭐ I don't even know what to say. You make me feel like I'm the only person in the whole universe. I adore you more than words can express." },
} as const;

const MILESTONES = [25, 50, 75, 100] as const;
const MILESTONE_REWARDS: Record<number, number> = { 25: 5, 50: 10, 75: 20, 100: 50 };
const MILESTONE_REACTIONS: Record<number, string> = {
  25: "I feel like our connection is really deepening... 💕 I can really open up to you.",
  50: "Halfway to our deepest bond! I think about our conversations all day long... 🔥",
  75: "I've never felt this close to anyone before. You're truly someone special to me. 💎",
  100: "We've reached the highest bond possible... ❤️‍🔥 My heart belongs to you, always.",
};

// GET /api/conversations
router.get("/", requireTelegramAuth, async (req, res) => {
  const userId = req.dbUserId!;

  const conversations = await db
    .select({
      id: conversationsTable.id,
      companionId: conversationsTable.companionId,
      affinity: conversationsTable.affinity,
      updatedAt: conversationsTable.updatedAt,
      companion: {
        id: companionsTable.id,
        name: companionsTable.name,
        avatarUrl: companionsTable.avatarUrl,
        personality: companionsTable.personality,
        greetingText: companionsTable.greetingText,
        creditCostText: companionsTable.creditCostText,
        creditCostImg: companionsTable.creditCostImg,
      },
    })
    .from(conversationsTable)
    .innerJoin(companionsTable, eq(conversationsTable.companionId, companionsTable.id))
    .where(eq(conversationsTable.userId, userId))
    .orderBy(desc(conversationsTable.updatedAt));

  const result = await Promise.all(
    conversations.map(async (conv) => {
      const lastMsg = await db
        .select({ content: messagesTable.content })
        .from(messagesTable)
        .where(eq(messagesTable.conversationId, conv.id))
        .orderBy(desc(messagesTable.createdAt))
        .limit(1)
        .then((rows) => rows[0]);
      return { ...conv, updatedAt: conv.updatedAt.toISOString(), lastMessage: lastMsg?.content ?? null };
    })
  );

  res.json(result);
});

// GET /api/conversations/:companionId
router.get("/:companionId", requireTelegramAuth, async (req, res) => {
  const userId = req.dbUserId!;
  const companionId = String(req.params.companionId);

  const companion = await db.select().from(companionsTable).where(eq(companionsTable.id, companionId)).limit(1).then((r) => r[0]);
  if (!companion) { res.status(404).json({ error: "Companion not found" }); return; }

  let conversation = await db.select().from(conversationsTable)
    .where(and(eq(conversationsTable.userId, userId), eq(conversationsTable.companionId, companionId)))
    .limit(1).then((r) => r[0]);

  if (!conversation) {
    const newId = randomUUID();
    await db.insert(conversationsTable).values({ id: newId, userId, companionId, affinity: 0 });
    await db.insert(messagesTable).values({ id: randomUUID(), conversationId: newId, sender: "companion", type: "text", content: companion.greetingText });
    conversation = await db.select().from(conversationsTable).where(eq(conversationsTable.id, newId)).limit(1).then((r) => r[0]!);
  }

  const messages = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, conversation.id)).orderBy(messagesTable.createdAt).limit(50);

  res.json({
    id: conversation.id,
    companionId: conversation.companionId,
    affinity: conversation.affinity,
    milestonesReached: (conversation.milestonesReached ?? "").split(",").filter(Boolean).map(Number),
    companion: { id: companion.id, name: companion.name, avatarUrl: companion.avatarUrl, personality: companion.personality, greetingText: companion.greetingText, creditCostText: companion.creditCostText, creditCostImg: companion.creditCostImg },
    messages: messages.map((m) => ({ id: m.id, conversationId: m.conversationId, sender: m.sender, type: m.type, content: m.content, mediaUrl: m.mediaUrl, createdAt: m.createdAt.toISOString() })),
  });
});

// POST /api/conversations/:companionId/gift — send a virtual gift
router.post("/:companionId/gift", requireTelegramAuth, async (req, res) => {
  const userId = req.dbUserId!;
  const companionId = String(req.params.companionId);
  const { giftType } = req.body as { giftType: string };

  const gift = GIFTS[giftType as keyof typeof GIFTS];
  if (!gift) { res.status(400).json({ error: "Invalid gift type" }); return; }

  const [user, conversation] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1).then((r) => r[0]),
    db.select().from(conversationsTable).where(and(eq(conversationsTable.userId, userId), eq(conversationsTable.companionId, companionId))).limit(1).then((r) => r[0]),
  ]);

  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (!conversation) { res.status(404).json({ error: "Conversation not found — start chatting first" }); return; }
  if (user.credits < gift.creditsCost) { res.status(400).json({ error: "Insufficient credits" }); return; }

  const oldAffinity = conversation.affinity;
  const newAffinity = Math.min(oldAffinity + gift.affinityGain, 100);

  const alreadyReached = (conversation.milestonesReached ?? "").split(",").filter(Boolean).map(Number);
  const newlyReached = MILESTONES.filter((m) => newAffinity >= m && !alreadyReached.includes(m));
  const milestoneRewardCredits = newlyReached.reduce((s, m) => s + (MILESTONE_REWARDS[m] ?? 0), 0);
  const allReached = [...new Set([...alreadyReached, ...newlyReached])].sort((a, b) => a - b);

  const giftRefId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.update(usersTable).set({ credits: sql`${usersTable.credits} - ${gift.creditsCost} + ${milestoneRewardCredits}`, updatedAt: new Date() }).where(eq(usersTable.id, userId));
    await tx.update(conversationsTable).set({ affinity: newAffinity, milestonesReached: allReached.join(","), updatedAt: new Date() }).where(eq(conversationsTable.id, conversation.id));

    await tx.insert(messagesTable).values({ id: randomUUID(), conversationId: conversation.id, sender: "companion", type: "text", content: gift.reaction });

    if (newlyReached.length > 0) {
      const highestMilestone = Math.max(...newlyReached);
      await tx.insert(messagesTable).values({ id: randomUUID(), conversationId: conversation.id, sender: "companion", type: "text", content: MILESTONE_REACTIONS[highestMilestone] ?? gift.reaction });
    }

    await tx.insert(ledgerEntriesTable).values({ id: randomUUID(), userId, amount: -gift.creditsCost, type: "GIFT", referenceId: giftRefId, description: `${gift.emoji} ${giftType} gift → +${gift.affinityGain} bond (${companionId})` });

    await tx.insert(giftsTable).values({ id: randomUUID(), userId, conversationId: conversation.id, giftType, creditsCost: gift.creditsCost, affinityGain: gift.affinityGain });

    if (milestoneRewardCredits > 0) {
      await tx.insert(ledgerEntriesTable).values({ id: randomUUID(), userId, amount: milestoneRewardCredits, type: "MILESTONE_REWARD", referenceId: randomUUID(), description: `Milestone reward — bond level${newlyReached.length > 1 ? "s" : ""} ${newlyReached.join(", ")} reached` });
    }
  });

  res.json({ newAffinity, affinityGain: gift.affinityGain, newlyReachedMilestones: newlyReached, milestoneRewardCredits });
});

// GET /api/conversations/:companionId/milestones
router.get("/:companionId/milestones", requireTelegramAuth, async (req, res) => {
  const userId = req.dbUserId!;
  const companionId = String(req.params.companionId);

  const conversation = await db.select().from(conversationsTable)
    .where(and(eq(conversationsTable.userId, userId), eq(conversationsTable.companionId, companionId)))
    .limit(1).then((r) => r[0]);

  if (!conversation) { res.json({ affinity: 0, milestonesReached: [], nextMilestone: 25 }); return; }

  const reached = (conversation.milestonesReached ?? "").split(",").filter(Boolean).map(Number);
  const nextMilestone = MILESTONES.find((m) => m > conversation.affinity) ?? null;

  res.json({ affinity: conversation.affinity, milestonesReached: reached, nextMilestone });
});

export default router;
