import { Router } from "express";
import { db, companionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { DEFAULT_COMPANIONS } from "../lib/companion-catalog.js";

const router = Router();

const companionOrder = new Map(DEFAULT_COMPANIONS.map((companion, index) => [companion.id, index]));

function sortCompanions<T extends { id: string }>(companions: T[]): T[] {
  return companions.sort((a, b) => {
    const aOrder = companionOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = companionOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });
}

// GET /api/companions
router.get("/", async (_req, res) => {
  const companions = sortCompanions(await db.select().from(companionsTable));
  const serialized = companions.map((c) => ({
    id: c.id,
    name: c.name,
    avatarUrl: c.avatarUrl,
    personality: c.personality,
    greetingText: c.greetingText,
    creditCostText: c.creditCostText,
    creditCostImg: c.creditCostImg,
    tags: c.tags,
  }));
  res.json(serialized);
});

// GET /api/companions/:id
router.get("/:id", async (req, res) => {
  const companion = await db
    .select()
    .from(companionsTable)
    .where(eq(companionsTable.id, String(req.params.id ?? "")))
    .limit(1)
    .then((rows) => rows[0]);

  if (!companion) {
    res.status(404).json({ error: "Companion not found" });
    return;
  }

  res.json({
    id: companion.id,
    name: companion.name,
    avatarUrl: companion.avatarUrl,
    personality: companion.personality,
    greetingText: companion.greetingText,
    creditCostText: companion.creditCostText,
    creditCostImg: companion.creditCostImg,
    tags: companion.tags,
  });
});

export default router;
