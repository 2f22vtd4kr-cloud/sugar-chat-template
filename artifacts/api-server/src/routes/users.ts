import { Router } from "express";
import { requireTelegramAuth } from "../middlewares/telegram-auth.js";
import { db, usersTable, messagesTable, conversationsTable, companionsTable, ledgerEntriesTable } from "@workspace/db";
import { eq, sum, count } from "drizzle-orm";

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
    createdAt: user.createdAt.toISOString(),
  };
}

// GET /api/users/me
router.get("/me", requireTelegramAuth, async (req, res) => {
  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.dbUserId!))
    .limit(1)
    .then((rows) => rows[0]);

  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(serializeUser(user));
});

// PATCH /api/users/me — update settings (adultConfirmed, language)
router.patch("/me", requireTelegramAuth, async (req, res) => {
  const { adultConfirmed, language } = req.body as {
    adultConfirmed?: boolean;
    language?: string;
  };

  const allowed = ["en", "es", "ru", "de", "it", "uk"];
  const updates: Partial<typeof usersTable.$inferInsert> & { updatedAt?: Date } = { updatedAt: new Date() };

  if (typeof adultConfirmed === "boolean") updates.adultConfirmed = adultConfirmed;
  if (language && allowed.includes(language)) updates.language = language;

  await db.update(usersTable).set(updates).where(eq(usersTable.id, req.dbUserId!));

  const user = await db.select().from(usersTable).where(eq(usersTable.id, req.dbUserId!)).limit(1).then((r) => r[0]!);
  res.json(serializeUser(user));
});

// GET /api/users/me/stats
router.get("/me/stats", requireTelegramAuth, async (req, res) => {
  const userId = req.dbUserId!;

  const [textStats, spendStats, conversations, topConversation] = await Promise.all([
    db.select({ total: count() }).from(messagesTable)
      .innerJoin(conversationsTable, eq(messagesTable.conversationId, conversationsTable.id))
      .where(eq(conversationsTable.userId, userId))
      .then((rows) => rows[0]?.total ?? 0),

    db.select({ total: sum(ledgerEntriesTable.amount) }).from(ledgerEntriesTable)
      .where(eq(ledgerEntriesTable.userId, userId))
      .then((rows) => Math.abs(Number(rows[0]?.total ?? 0))),

    db.select({ affinity: conversationsTable.affinity }).from(conversationsTable)
      .where(eq(conversationsTable.userId, userId)),

    db.select({ name: companionsTable.name, affinity: conversationsTable.affinity })
      .from(conversationsTable)
      .innerJoin(companionsTable, eq(conversationsTable.companionId, companionsTable.id))
      .where(eq(conversationsTable.userId, userId))
      .orderBy(conversationsTable.affinity)
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  res.json({
    totalMessages: Number(textStats),
    totalCreditsSpent: Number(spendStats),
    topCompanion: topConversation?.name ?? null,
    affinityTotal: conversations.reduce((s, c) => s + c.affinity, 0),
  });
});

export default router;
