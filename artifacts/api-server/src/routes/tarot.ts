import { Router } from "express";
import { requireTelegramAuth } from "../middlewares/telegram-auth.js";
import { db, tarotReadingsTable, conversationsTable, usersTable, companionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { drawCards, TAROT_TOPICS } from "../tarot/cards.js";

const router = Router();

router.use(requireTelegramAuth);

// GET /api/tarot/topics
router.get("/topics", (_req, res) => {
  res.json(TAROT_TOPICS);
});

// POST /api/tarot/reading
router.post("/reading", async (req, res) => {
  const userId = req.dbUserId!;
  const { companionId, topic, spreadType = "three_card", birthDate } = req.body as {
    companionId: string;
    topic: string;
    spreadType?: "three_card" | "five_card";
    birthDate?: string;
  };

  if (!companionId || !topic) {
    res.status(400).json({ error: "companionId and topic are required" });
    return;
  }

  const companion = await db
    .select()
    .from(companionsTable)
    .where(eq(companionsTable.id, companionId))
    .limit(1)
    .then((r) => r[0]);

  if (!companion) {
    res.status(404).json({ error: "Companion not found" });
    return;
  }

  if (birthDate) {
    await db.update(usersTable).set({ birthDate }).where(eq(usersTable.id, userId));
  }

  const cardCount = spreadType === "five_card" ? 5 : 3;
  const drawnCards = drawCards(cardCount);

  const topicInfo = TAROT_TOPICS.find((t) => t.id === topic);
  const topicLabel = topicInfo?.label ?? topic;

  const readingText = buildReadingNarrative(companion.name, topicLabel, drawnCards);

  const readingId = randomUUID();

  await db.insert(tarotReadingsTable).values({
    id: readingId,
    userId,
    companionId,
    topic,
    spreadType,
    cards: drawnCards as any,
    readingText,
    affinityGain: spreadType === "five_card" ? 4 : 2,
  });

  // Boost conversation affinity
  const conv = await db
    .select()
    .from(conversationsTable)
    .where(and(eq(conversationsTable.userId, userId), eq(conversationsTable.companionId, companionId)))
    .limit(1)
    .then((r) => r[0]);

  if (conv) {
    const gain = spreadType === "five_card" ? 4 : 2;
    await db
      .update(conversationsTable)
      .set({ affinity: conv.affinity + gain, updatedAt: new Date() })
      .where(eq(conversationsTable.id, conv.id));
  }

  res.json({
    id: readingId,
    companionId,
    companionName: companion.name,
    topic,
    topicLabel,
    spreadType,
    cards: drawnCards,
    readingText,
    affinityGain: spreadType === "five_card" ? 4 : 2,
    createdAt: new Date().toISOString(),
  });
});

// GET /api/tarot/history
router.get("/history", async (req, res) => {
  const userId = req.dbUserId!;
  const { companionId, limit = "10" } = req.query as { companionId?: string; limit?: string };

  const where = companionId
    ? and(eq(tarotReadingsTable.userId, userId), eq(tarotReadingsTable.companionId, companionId))
    : eq(tarotReadingsTable.userId, userId);

  const readings = await db
    .select()
    .from(tarotReadingsTable)
    .where(where)
    .orderBy(desc(tarotReadingsTable.createdAt))
    .limit(Number(limit));

  res.json(readings);
});

function buildReadingNarrative(
  companionName: string,
  topic: string,
  cards: Array<{ name: string; position: string; reversed: boolean; romanticFlavor: string; meaningUpright: string; meaningReversed: string }>
): string {
  const intro = `*${companionName} leans closer, fingers spreading the cards across velvet...*\n\n`;

  const cardReadings = cards.map((card) => {
    const meaning = card.reversed ? card.meaningReversed : card.meaningUpright;
    return `**${card.position} — ${card.name}${card.reversed ? " ᴿ" : ""}**\n${meaning} ${card.romanticFlavor}`;
  }).join("\n\n");

  const outro = `\n\n*The cards have spoken about your ${topic.toLowerCase()}. What they reveal is meant only for you.*`;

  return intro + cardReadings + outro;
}

export default router;
