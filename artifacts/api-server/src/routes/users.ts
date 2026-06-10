import { Router } from "express";
import { requireTelegramAuth } from "../middlewares/telegram-auth.js";
import { db, usersTable, messagesTable, conversationsTable, companionsTable, ledgerEntriesTable } from "@workspace/db";
import { eq, sum, count } from "drizzle-orm";

const router = Router();

// GET /api/users/me
router.get("/me", requireTelegramAuth, async (req, res) => {
  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.dbUserId!))
    .limit(1)
    .then((rows) => rows[0]);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    telegramId: user.telegramId.toString(),
    username: user.username,
    credits: user.credits,
    freeImagesSent: user.freeImagesSent,
    createdAt: user.createdAt.toISOString(),
  });
});

// GET /api/users/me/stats
router.get("/me/stats", requireTelegramAuth, async (req, res) => {
  const userId = req.dbUserId!;

  const [textStats, imageStats, spendStats, conversations, topConversation] = await Promise.all([
    // Total text messages sent by user
    db
      .select({ total: count() })
      .from(messagesTable)
      .innerJoin(conversationsTable, eq(messagesTable.conversationId, conversationsTable.id))
      .where(eq(conversationsTable.userId, userId))
      .then((rows) => rows[0]?.total ?? 0),

    // Total image messages
    db
      .select({ total: count() })
      .from(messagesTable)
      .innerJoin(conversationsTable, eq(messagesTable.conversationId, conversationsTable.id))
      .where(eq(conversationsTable.userId, userId))
      .then((rows) => rows[0]?.total ?? 0),

    // Total credits spent
    db
      .select({ total: sum(ledgerEntriesTable.amount) })
      .from(ledgerEntriesTable)
      .where(eq(ledgerEntriesTable.userId, userId))
      .then((rows) => Math.abs(Number(rows[0]?.total ?? 0))),

    // All conversations for affinity total
    db
      .select({ affinity: conversationsTable.affinity })
      .from(conversationsTable)
      .where(eq(conversationsTable.userId, userId)),

    // Top companion by affinity
    db
      .select({ name: companionsTable.name, affinity: conversationsTable.affinity })
      .from(conversationsTable)
      .innerJoin(companionsTable, eq(conversationsTable.companionId, companionsTable.id))
      .where(eq(conversationsTable.userId, userId))
      .orderBy(conversationsTable.affinity)
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  const affinityTotal = conversations.reduce((sum, c) => sum + c.affinity, 0);

  res.json({
    totalMessages: Number(textStats),
    totalImages: Number(imageStats),
    totalCreditsSpent: Number(spendStats),
    topCompanion: topConversation?.name ?? null,
    affinityTotal,
  });
});

export default router;
