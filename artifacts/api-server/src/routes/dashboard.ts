import { Router } from "express";
import { requireTelegramAuth } from "../middlewares/telegram-auth.js";
import { db, usersTable, conversationsTable, messagesTable, companionsTable } from "@workspace/db";
import { eq, count, desc } from "drizzle-orm";

const router = Router();

// GET /api/dashboard/summary
router.get("/summary", requireTelegramAuth, async (req, res) => {
  const userId = req.dbUserId!;

  const [user, conversations, totalMsgs] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1).then((r) => r[0]),
    db
      .select({
        id: conversationsTable.id,
        companionId: conversationsTable.companionId,
        affinity: conversationsTable.affinity,
        updatedAt: conversationsTable.updatedAt,
        companionName: companionsTable.name,
        companionAvatar: companionsTable.avatarUrl,
      })
      .from(conversationsTable)
      .innerJoin(companionsTable, eq(conversationsTable.companionId, companionsTable.id))
      .where(eq(conversationsTable.userId, userId))
      .orderBy(desc(conversationsTable.updatedAt))
      .limit(5),
    db
      .select({ total: count() })
      .from(messagesTable)
      .innerJoin(conversationsTable, eq(messagesTable.conversationId, conversationsTable.id))
      .where(eq(conversationsTable.userId, userId))
      .then((r) => Number(r[0]?.total ?? 0)),
  ]);

  // Get last message for each recent conversation
  const recentActivity = await Promise.all(
    conversations.map(async (conv) => {
      const lastMsg = await db
        .select({ content: messagesTable.content })
        .from(messagesTable)
        .where(eq(messagesTable.conversationId, conv.id))
        .orderBy(desc(messagesTable.createdAt))
        .limit(1)
        .then((r) => r[0]);

      return {
        companionId: conv.companionId,
        companionName: conv.companionName,
        companionAvatar: conv.companionAvatar,
        lastMessage: lastMsg?.content ?? null,
        updatedAt: conv.updatedAt.toISOString(),
        affinity: conv.affinity,
      };
    })
  );

  const totalAffinity = conversations.reduce((sum, c) => sum + c.affinity, 0);

  res.json({
    credits: user?.credits ?? 0,
    totalMessages: totalMsgs,
    activeConversations: conversations.length,
    totalAffinity,
    recentActivity,
  });
});

export default router;
