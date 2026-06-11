import { Router } from "express";
import { requireTelegramAuth } from "../middlewares/telegram-auth.js";
import { db, messagesTable, conversationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

// GET /api/conversations/:companionId/messages
router.get("/:companionId/messages", requireTelegramAuth, async (req, res) => {
  const userId = req.dbUserId!;
  const companionId = String(req.params.companionId ?? "");

  const conversation = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.userId, userId),
        eq(conversationsTable.companionId, companionId)
      )
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (!conversation) {
    res.json([]);
    return;
  }

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conversation.id))
    .orderBy(desc(messagesTable.createdAt))
    .limit(50);

  res.json(
    messages.reverse().map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      sender: m.sender,
      type: m.type,
      content: m.content,
      mediaUrl: m.mediaUrl,
      createdAt: m.createdAt.toISOString(),
    }))
  );
});

export default router;
