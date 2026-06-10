import { Router } from "express";
import { requireTelegramAuth } from "../middlewares/telegram-auth.js";
import { db, ledgerEntriesTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { bot, STARS_PACKAGES } from "../bot/engine.js";

const router = Router();

const CREDIT_PACKAGES: Record<string, { credits: number; price: string; label: string }> = {
  starter: { credits: 50, price: "$0.99", label: "Starter Pack" },
  popular: { credits: 200, price: "$3.49", label: "Popular Pack" },
  premium: { credits: 500, price: "$7.99", label: "Premium Pack" },
};

// GET /api/ledger
router.get("/", requireTelegramAuth, async (req, res) => {
  const userId = req.dbUserId!;

  const entries = await db
    .select()
    .from(ledgerEntriesTable)
    .where(eq(ledgerEntriesTable.userId, userId))
    .orderBy(desc(ledgerEntriesTable.createdAt))
    .limit(50);

  res.json(
    entries.map((e) => ({
      id: e.id,
      amount: e.amount,
      type: e.type,
      description: e.description,
      referenceId: e.referenceId,
      createdAt: e.createdAt.toISOString(),
    }))
  );
});

// POST /api/credits/purchase — direct purchase (dev/admin use)
router.post("/purchase", requireTelegramAuth, async (req, res) => {
  const userId = req.dbUserId!;
  const { packageId } = req.body as { packageId: string };

  const pkg = CREDIT_PACKAGES[packageId];
  if (!pkg) {
    res.status(400).json({ error: "Invalid package" });
    return;
  }

  const referenceId = randomUUID();

  await db.transaction(async (tx) => {
    await tx
      .update(usersTable)
      .set({ credits: sql`${usersTable.credits} + ${pkg.credits}` })
      .where(eq(usersTable.id, userId));

    await tx.insert(ledgerEntriesTable).values({
      id: randomUUID(),
      userId,
      amount: pkg.credits,
      type: "DEPOSIT",
      referenceId,
      description: `${pkg.label} — ${pkg.credits} credits (${pkg.price})`,
    });
  });

  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1)
    .then((rows) => rows[0]!);

  res.json({
    id: user.id,
    telegramId: user.telegramId.toString(),
    username: user.username,
    credits: user.credits,
    freeImagesSent: user.freeImagesSent,
    createdAt: user.createdAt.toISOString(),
  });
});

// POST /api/credits/stars-invoice — generate a Telegram Stars invoice link for the Mini App
router.post("/stars-invoice", requireTelegramAuth, async (req, res) => {
  const { packageId } = req.body as { packageId: string };

  const pkg = STARS_PACKAGES[packageId];
  if (!pkg) {
    res.status(400).json({ error: "Invalid package" });
    return;
  }

  try {
    const invoiceLink = await bot.telegram.createInvoiceLink({
      title: pkg.label,
      description: pkg.description,
      payload: packageId,
      currency: "XTR",
      prices: [{ label: pkg.label, amount: pkg.stars }],
      provider_token: "",
    });

    res.json({ invoiceLink });
  } catch (err: any) {
    console.error("[Stars] Failed to create invoice link:", err?.message);
    res.status(500).json({ error: "Failed to create invoice link" });
  }
});

// GET /api/credits/stars-packages — return available Stars packages
router.get("/stars-packages", requireTelegramAuth, async (_req, res) => {
  const packages = Object.entries(STARS_PACKAGES).map(([id, pkg]) => ({
    id,
    credits: pkg.credits,
    stars: pkg.stars,
    label: pkg.label,
    description: pkg.description,
  }));
  res.json(packages);
});

export default router;
