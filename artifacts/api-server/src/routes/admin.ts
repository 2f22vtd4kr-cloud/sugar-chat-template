import { Router, Request, Response, NextFunction } from "express";
import {
  db,
  usersTable,
  ledgerEntriesTable,
  conversationsTable,
  messagesTable,
  companionsTable,
  subscriptionsTable,
  abandonedCheckoutsTable,
  shopInventoryTable,
} from "@workspace/db";
import { desc, count, sum, sql, gte, and, eq } from "drizzle-orm";
import { config } from "../lib/config.js";

const router = Router();

function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers["authorization"] ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== config.adminPass) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// GET /api/admin/stats
router.get("/stats", requireAdminAuth, async (_req, res) => {
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsersToday,
    activeUsers7d,
    totalRevenue,
    revenue24h,
    revenue7d,
    revenue30d,
    totalMessages,
    messages24h,
    totalSubs,
    activeSubs,
    abandonedCount,
    abandonedConverted,
  ] = await Promise.all([
    db.select({ c: count() }).from(usersTable).then((r) => Number(r[0]?.c ?? 0)),
    db.select({ c: count() }).from(usersTable).where(gte(usersTable.createdAt, since24h)).then((r) => Number(r[0]?.c ?? 0)),
    db.select({ c: count() }).from(usersTable).where(gte(usersTable.updatedAt, since7d)).then((r) => Number(r[0]?.c ?? 0)),
    db.select({ s: sum(ledgerEntriesTable.amount) }).from(ledgerEntriesTable).where(sql`${ledgerEntriesTable.amount} > 0`).then((r) => Number(r[0]?.s ?? 0)),
    db.select({ s: sum(ledgerEntriesTable.amount) }).from(ledgerEntriesTable).where(and(sql`${ledgerEntriesTable.amount} > 0`, gte(ledgerEntriesTable.createdAt, since24h))).then((r) => Number(r[0]?.s ?? 0)),
    db.select({ s: sum(ledgerEntriesTable.amount) }).from(ledgerEntriesTable).where(and(sql`${ledgerEntriesTable.amount} > 0`, gte(ledgerEntriesTable.createdAt, since7d))).then((r) => Number(r[0]?.s ?? 0)),
    db.select({ s: sum(ledgerEntriesTable.amount) }).from(ledgerEntriesTable).where(and(sql`${ledgerEntriesTable.amount} > 0`, gte(ledgerEntriesTable.createdAt, since30d))).then((r) => Number(r[0]?.s ?? 0)),
    db.select({ c: count() }).from(messagesTable).then((r) => Number(r[0]?.c ?? 0)),
    db.select({ c: count() }).from(messagesTable).where(gte(messagesTable.createdAt, since24h)).then((r) => Number(r[0]?.c ?? 0)),
    db.select({ c: count() }).from(subscriptionsTable).then((r) => Number(r[0]?.c ?? 0)),
    db.select({ c: count() }).from(subscriptionsTable).where(eq(subscriptionsTable.status, "active")).then((r) => Number(r[0]?.c ?? 0)),
    db.select({ c: count() }).from(abandonedCheckoutsTable).then((r) => Number(r[0]?.c ?? 0)),
    db.select({ c: count() }).from(abandonedCheckoutsTable).where(sql`${abandonedCheckoutsTable.convertedAt} IS NOT NULL`).then((r) => Number(r[0]?.c ?? 0)),
  ]);

  res.json({
    users: { total: totalUsers, newToday: newUsersToday, active7d: activeUsers7d },
    revenue: { total: totalRevenue, last24h: revenue24h, last7d: revenue7d, last30d: revenue30d },
    messages: { total: totalMessages, last24h: messages24h },
    subscriptions: { total: totalSubs, active: activeSubs },
    abandonedCheckouts: {
      total: abandonedCount,
      converted: abandonedConverted,
      conversionRate: abandonedCount > 0 ? Math.round((abandonedConverted / abandonedCount) * 100) : 0,
    },
  });
});

// GET /api/admin/companions — per-companion engagement
router.get("/companions", requireAdminAuth, async (_req, res) => {
  const rows = await db
    .select({
      companionId: companionsTable.id,
      name: companionsTable.name,
      conversations: count(conversationsTable.id),
      avgAffinity: sql<number>`COALESCE(AVG(${conversationsTable.affinity}), 0)`,
    })
    .from(companionsTable)
    .leftJoin(conversationsTable, eq(companionsTable.id, conversationsTable.companionId))
    .groupBy(companionsTable.id, companionsTable.name)
    .orderBy(desc(count(conversationsTable.id)));

  const withMessages = await Promise.all(
    rows.map(async (row) => {
      const msgCount = await db
        .select({ c: count() })
        .from(messagesTable)
        .innerJoin(conversationsTable, eq(messagesTable.conversationId, conversationsTable.id))
        .where(eq(conversationsTable.companionId, row.companionId))
        .then((r) => Number(r[0]?.c ?? 0));
      return {
        ...row,
        messages: msgCount,
        avgAffinity: Math.round(Number(row.avgAffinity)),
      };
    })
  );

  res.json(withMessages);
});

// GET /api/admin/whales — top spenders
router.get("/whales", requireAdminAuth, async (_req, res) => {
  const rows = await db
    .select({
      userId: usersTable.id,
      username: usersTable.username,
      firstName: usersTable.firstName,
      telegramId: usersTable.telegramId,
      totalSpent: usersTable.totalSpent,
      credits: usersTable.credits,
      createdAt: usersTable.createdAt,
      streakDays: usersTable.streakDays,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.totalSpent))
    .limit(20);

  res.json(rows.map((r) => ({ ...r, telegramId: r.telegramId.toString() })));
});

// GET /api/admin/transactions — recent ledger entries
router.get("/transactions", requireAdminAuth, async (_req, res) => {
  const rows = await db
    .select({
      id: ledgerEntriesTable.id,
      amount: ledgerEntriesTable.amount,
      type: ledgerEntriesTable.type,
      description: ledgerEntriesTable.description,
      dynamicPriceApplied: ledgerEntriesTable.dynamicPriceApplied,
      createdAt: ledgerEntriesTable.createdAt,
      username: usersTable.username,
      firstName: usersTable.firstName,
    })
    .from(ledgerEntriesTable)
    .innerJoin(usersTable, eq(ledgerEntriesTable.userId, usersTable.id))
    .orderBy(desc(ledgerEntriesTable.createdAt))
    .limit(50);

  res.json(rows);
});

// GET /api/admin/revenue-chart — daily revenue for last 30 days
router.get("/revenue-chart", requireAdminAuth, async (_req, res) => {
  const rows = await db
    .select({
      day: sql<string>`TO_CHAR(${ledgerEntriesTable.createdAt}, 'YYYY-MM-DD')`,
      revenue: sum(ledgerEntriesTable.amount),
      txCount: count(),
    })
    .from(ledgerEntriesTable)
    .where(
      and(
        sql`${ledgerEntriesTable.amount} > 0`,
        gte(ledgerEntriesTable.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      )
    )
    .groupBy(sql`TO_CHAR(${ledgerEntriesTable.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`TO_CHAR(${ledgerEntriesTable.createdAt}, 'YYYY-MM-DD')`);

  res.json(rows.map((r) => ({ day: r.day, revenue: Number(r.revenue ?? 0), txCount: Number(r.txCount ?? 0) })));
});

export default router;
