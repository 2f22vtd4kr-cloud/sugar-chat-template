import { Router } from "express";
import { requireTelegramAuth } from "../middlewares/telegram-auth.js";
import { db, conversationsTable, companionsTable, messagesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

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

  // Get last message for each conversation
  const result = await Promise.all(
    conversations.map(async (conv) => {
      const lastMsg = await db
        .select({ content: messagesTable.content })
        .from(messagesTable)
        .where(eq(messagesTable.conversationId, conv.id))
        .orderBy(desc(messagesTable.createdAt))
        .limit(1)
        .then((rows) => rows[0]);

      return {
        ...conv,
        updatedAt: conv.updatedAt.toISOString(),
        lastMessage: lastMsg?.content ?? null,
      };
    })
  );

  res.json(result);
});

// GET /api/conversations/:companionId
router.get("/:companionId", requireTelegramAuth, async (req, res) => {
  const userId = req.dbUserId!;
  const { companionId } = req.params;

  const companion = await db
    .select()
    .from(companionsTable)
    .where(eq(companionsTable.id, companionId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!companion) {
    res.status(404).json({ error: "Companion not found" });
    return;
  }

  let conversation = await db
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
    const newId = randomUUID();
    await db.insert(conversationsTable).values({
      id: newId,
      userId,
      companionId,
      affinity: 0,
    });

    // Insert greeting message
    await db.insert(messagesTable).values({
      id: randomUUID(),
      conversationId: newId,
      sender: "companion",
      type: "text",
      content: companion.greetingText,
    });

    conversation = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, newId))
      .limit(1)
      .then((rows) => rows[0]!);
  }

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conversation.id))
    .orderBy(messagesTable.createdAt)
    .limit(50);

  res.json({
    id: conversation.id,
    companionId: conversation.companionId,
    affinity: conversation.affinity,
    companion: {
      id: companion.id,
      name: companion.name,
      avatarUrl: companion.avatarUrl,
      personality: companion.personality,
      greetingText: companion.greetingText,
      creditCostText: companion.creditCostText,
      creditCostImg: companion.creditCostImg,
    },
    messages: messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      sender: m.sender,
      type: m.type,
      content: m.content,
      mediaUrl: m.mediaUrl,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});

export default router;
