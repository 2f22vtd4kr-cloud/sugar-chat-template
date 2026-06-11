import { Router } from "express";
import { requireTelegramAuth } from "../middlewares/telegram-auth.js";
import {
  db,
  usersTable,
  ledgerEntriesTable,
  shopInventoryTable,
  conversationsTable,
  abandonedCheckoutsTable,
  flashSalesTable,
  messagesTable,
} from "@workspace/db";
import { eq, desc, and, gte, sum } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { whaleRecoveryQueue, cancelWhaleJob } from "../queues/whale-recovery-queue.js";

const router = Router();
router.use(requireTelegramAuth);

export interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  description: string;
  creditsCost: number;
  category: "romantic" | "spicy" | "kinky" | "luxury" | "playful";
  gradient: string;
  affinityGain: number;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: "rose_bouquet",   name: "Rose Bouquet",    emoji: "🌹", description: "A lush arrangement of crimson roses — nothing says devotion like fresh-cut beauty.",                          creditsCost: 12,  affinityGain: 3,  category: "romantic", gradient: "135deg, #7f1d1d, #991b1b" },
  { id: "wine_bottle",    name: "Wine Bottle",      emoji: "🍷", description: "A bottle of velvety red wine, perfect for an intimate evening together.",                                    creditsCost: 15,  affinityGain: 3,  category: "romantic", gradient: "135deg, #450a0a, #7f1d1d" },
  { id: "plane_ticket",   name: "Plane Ticket",     emoji: "✈️", description: "A surprise getaway for two. Where shall we escape to together?",                                             creditsCost: 25,  affinityGain: 5,  category: "romantic", gradient: "135deg, #1e1b4b, #312e81" },
  { id: "silk_pajamas",   name: "Silk Pajamas",     emoji: "🩷", description: "Whisper-soft silk, worn just for you on lazy Sunday mornings.",                                              creditsCost: 20,  affinityGain: 4,  category: "romantic", gradient: "135deg, #831843, #9d174d" },
  { id: "diamond_ring",   name: "Diamond Ring",     emoji: "💍", description: "A stunning diamond solitaire — a pledge carved in forever.",                                                  creditsCost: 55,  affinityGain: 12, category: "luxury",   gradient: "135deg, #0c4a6e, #075985" },
  { id: "vip_pass",       name: "VIP Pass",         emoji: "👑", description: "Exclusive VIP access — red-carpet treatment, reserved just for you.",                                        creditsCost: 40,  affinityGain: 8,  category: "luxury",   gradient: "135deg, #713f12, #92400e" },
  { id: "control_ball",   name: "Control Orb",      emoji: "🔮", description: "A captivating crystal orb — symbol of delicious surrender and power exchange.",                              creditsCost: 300, affinityGain: 30, category: "luxury",   gradient: "135deg, #4c1d95, #7c3aed" },
  { id: "piercing_set",   name: "Piercing Set",     emoji: "✨", description: "Delicate surgical-steel body jewelry for a bold new statement.",                                              creditsCost: 165, affinityGain: 18, category: "luxury",   gradient: "135deg, #0c4a6e, #164e63" },
  { id: "body_lotion",    name: "Body Lotion",      emoji: "🧴", description: "Silky smooth premium lotion — slide it over every curve with care.",                                         creditsCost: 20,  affinityGain: 4,  category: "playful",  gradient: "135deg, #14532d, #166534" },
  { id: "cat_ears",       name: "Cat Ears",         emoji: "🐱", description: "Mischievous velvet cat ears that hint at a playful alter ego.",                                              creditsCost: 22,  affinityGain: 5,  category: "playful",  gradient: "135deg, #581c87, #6b21a8" },
  { id: "lace_lingerie",  name: "Lace Lingerie",    emoji: "👙", description: "Sheer black lace lingerie — designed to be appreciated and removed slowly.",                                 creditsCost: 75,  affinityGain: 15, category: "spicy",    gradient: "135deg, #1c1917, #292524" },
  { id: "bondage_rope",   name: "Bondage Rope",     emoji: "🪢", description: "Soft shibari rope — trust woven into every knot.",                                                          creditsCost: 35,  affinityGain: 8,  category: "kinky",    gradient: "135deg, #7c2d12, #9a3412" },
  { id: "dildo",          name: "Pleasure Wand",    emoji: "💜", description: "A smooth, premium pleasure wand — for moments when imagination needs company.",                              creditsCost: 35,  affinityGain: 8,  category: "kinky",    gradient: "135deg, #4c1d95, #5b21b6" },
  { id: "anal_plug",      name: "Jewel Plug",       emoji: "💎", description: "A polished stainless plug with a glittering jewel base — beauty meets sensation.",                           creditsCost: 45,  affinityGain: 10, category: "kinky",    gradient: "135deg, #0f172a, #1e293b" },
  { id: "lubricant",      name: "Lubricant",        emoji: "🫧", description: "Premium silicone-based lubricant — silky, long-lasting, never sticky.",                                     creditsCost: 18,  affinityGain: 4,  category: "kinky",    gradient: "135deg, #065f46, #047857" },
];

// ── Dynamic Pricing Matrix ───────────────────────────────────────────────────
// P_dynamic = P_base × (1 + α × S_spend) × (1 − β × A_affinity) × (1 − γ × M_flash)
// α = 0.15 (whale escalation), β = 0.20 (affinity loyalty), γ = 0.15 (flash discount)

const ALPHA = 0.15;
const BETA  = 0.20;
const GAMMA = 0.15;

async function getActiveFlashSale(): Promise<{ active: boolean; discountPct: number }> {
  try {
    const now = new Date();
    const sale = await db
      .select()
      .from(flashSalesTable)
      .where(and(eq(flashSalesTable.active, true), gte(flashSalesTable.expiresAt, now)))
      .limit(1)
      .then((r) => r[0]);
    return sale ? { active: true, discountPct: sale.discountPct } : { active: false, discountPct: 0 };
  } catch {
    return { active: false, discountPct: 0 };
  }
}

async function computeDynamicPrice(
  basePrice: number,
  userId: string,
  companionId?: string
): Promise<{ finalPrice: number; flashActive: boolean; discountPct: number }> {
  // S_spend: normalized historical spend (0.0 – 1.0)
  let totalSpentResult = 0;
  try {
    const result = await db
      .select({ total: sum(ledgerEntriesTable.amount) })
      .from(ledgerEntriesTable)
      .where(and(eq(ledgerEntriesTable.userId, userId), eq(ledgerEntriesTable.type, "SHOP_PURCHASE")))
      .then((r) => r[0]);
    totalSpentResult = Math.abs(Number(result?.total ?? 0));
  } catch { /* no spend history */ }
  const S_spend = Math.min(totalSpentResult / 1000, 1.0);

  // A_affinity: normalized companion affinity (0.0 – 1.0)
  let A_affinity = 0.0;
  if (companionId) {
    try {
      const conv = await db
        .select({ affinity: conversationsTable.affinity })
        .from(conversationsTable)
        .where(and(eq(conversationsTable.userId, userId), eq(conversationsTable.companionId, companionId)))
        .limit(1)
        .then((r) => r[0]);
      A_affinity = (conv?.affinity ?? 0) / 100;
    } catch { /* no conversation */ }
  }

  // M_flash: active flash sale
  const flash = await getActiveFlashSale();
  const M_flash = flash.active ? flash.discountPct : 0;

  const finalPrice = Math.max(
    1,
    Math.round(basePrice * (1 + ALPHA * S_spend) * (1 - BETA * A_affinity) * (1 - M_flash))
  );

  return { finalPrice, flashActive: flash.active, discountPct: M_flash };
}

// ── GET /api/shop/items ──────────────────────────────────────────────────────
router.get("/items", async (req, res) => {
  const userId = req.dbUserId!;
  const companionId = req.query["companionId"] as string | undefined;
  const flash = await getActiveFlashSale();

  const itemsWithDynamic = await Promise.all(
    SHOP_ITEMS.map(async (item) => {
      const { finalPrice } = await computeDynamicPrice(item.creditsCost, userId, companionId);
      return {
        ...item,
        creditsCost: finalPrice,
        baseCreditsCost: item.creditsCost,
        flashSaleActive: flash.active,
        flashDiscountPct: flash.discountPct,
      };
    })
  );

  res.json(itemsWithDynamic);
});

// ── GET /api/shop/inventory ──────────────────────────────────────────────────
router.get("/inventory", async (req, res) => {
  const userId = req.dbUserId!;
  const items = await db
    .select()
    .from(shopInventoryTable)
    .where(eq(shopInventoryTable.userId, userId))
    .orderBy(desc(shopInventoryTable.createdAt))
    .limit(100);
  res.json(items);
});

// ── POST /api/shop/checkout-intent ──────────────────────────────────────────
// Called when user opens item detail — starts 15-min whale recovery timer
router.post("/checkout-intent", async (req, res) => {
  const userId = req.dbUserId!;
  const { itemId, telegramChatId } = req.body as { itemId: string; telegramChatId?: number };

  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) { res.status(404).json({ error: "Item not found" }); return; }

  // Cancel any existing intent for this user (they changed item)
  try {
    const existing = await db
      .select()
      .from(abandonedCheckoutsTable)
      .where(and(eq(abandonedCheckoutsTable.userId, userId), eq(abandonedCheckoutsTable.convertedAt, null as any)))
      .orderBy(desc(abandonedCheckoutsTable.createdAt))
      .limit(1)
      .then((r) => r[0]);

    if (existing?.bullJobId) {
      await cancelWhaleJob(existing.bullJobId);
    }
  } catch { /* silent */ }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const checkoutId = randomUUID();

  // Enqueue whale recovery job (delayed 15 min)
  let bullJobId: string | undefined;
  try {
    bullJobId = await whaleRecoveryQueue.add(
      "whale-recovery",
      { userId, itemId, itemName: item.name, basePrice: item.creditsCost, telegramChatId, checkoutId },
      { delay: 15 * 60 * 1000, jobId: `whale-${userId}-${itemId}-${Date.now()}` }
    ).then((j) => j.id ?? undefined);
  } catch (err) {
    console.error("[Shop] Failed to enqueue whale recovery:", err);
  }

  // Persist abandoned checkout record
  try {
    await db.insert(abandonedCheckoutsTable).values({
      id: checkoutId,
      userId,
      itemId,
      itemName: item.name,
      basePrice: item.creditsCost,
      bullJobId: bullJobId ?? null,
      expiresAt,
    });
  } catch { /* silent — non-critical */ }

  res.json({ ok: true, checkoutId, expiresAt: expiresAt.toISOString() });
});

// ── POST /api/shop/gift-item ─────────────────────────────────────────────────
// Send an owned inventory item as a gift into a conversation
router.post("/gift-item", async (req, res) => {
  const userId = req.dbUserId!;
  const { inventoryId, companionId } = req.body as { inventoryId: string; companionId: string };

  const inventoryItem = await db
    .select()
    .from(shopInventoryTable)
    .where(and(eq(shopInventoryTable.id, inventoryId), eq(shopInventoryTable.userId, userId)))
    .limit(1)
    .then((r) => r[0]);

  if (!inventoryItem) { res.status(404).json({ error: "Item not found in inventory" }); return; }
  if (inventoryItem.isGifted) { res.status(400).json({ error: "Item already gifted" }); return; }

  // Get conversation id
  const conv = await db
    .select()
    .from(conversationsTable)
    .where(and(eq(conversationsTable.userId, userId), eq(conversationsTable.companionId, companionId)))
    .limit(1)
    .then((r) => r[0]);

  if (!conv) { res.status(404).json({ error: "No conversation found with this companion" }); return; }

  // Get the shop item definition for affinity gain
  const shopItem = SHOP_ITEMS.find((i) => i.id === inventoryItem.itemId);
  const affinityGain = shopItem?.affinityGain ?? 3;

  await db.transaction(async (tx) => {
    // Mark item as gifted
    await tx
      .update(shopInventoryTable)
      .set({ isGifted: true, giftedToCompanionId: companionId, giftedAt: new Date() })
      .where(eq(shopInventoryTable.id, inventoryId));

    // Boost affinity
    await tx
      .update(conversationsTable)
      .set({
        affinity: sql`LEAST(${conversationsTable.affinity} + ${affinityGain}, 100)`,
        updatedAt: new Date(),
      })
      .where(eq(conv.id, conv.id));

    // Inject gift metadata into conversation as a system message
    await tx.insert(messagesTable).values({
      id: randomUUID(),
      conversationId: conv.id,
      sender: "user",
      type: "text",
      content: `[Gift sent: ${inventoryItem.itemName}] 🎁`,
    });
  });

  const updatedConv = await db
    .select({ affinity: conversationsTable.affinity })
    .from(conversationsTable)
    .where(eq(conversationsTable.id, conv.id))
    .limit(1)
    .then((r) => r[0]);

  res.json({ ok: true, affinityGain, newAffinity: updatedConv?.affinity ?? 0, itemName: inventoryItem.itemName });
});

// ── POST /api/shop/purchase ──────────────────────────────────────────────────
router.post("/purchase", async (req, res) => {
  const userId = req.dbUserId!;
  const { itemId, companionId, checkoutId } = req.body as {
    itemId: string;
    companionId?: string;
    checkoutId?: string;
  };

  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) { res.status(404).json({ error: "Item not found" }); return; }

  // Compute dynamic price
  const { finalPrice, flashActive, discountPct } = await computeDynamicPrice(
    item.creditsCost,
    userId,
    companionId
  );

  // ── Atomic double-spend prevention ──────────────────────────────────────────
  // Single UPDATE that atomically checks AND deducts credits in one statement.
  // If credits < finalPrice, the WHERE clause fails → 0 rows updated → we return 400.
  const purchaseRefId = randomUUID();
  const purchaseId    = randomUUID();

  const updated = await db
    .update(usersTable)
    .set({
      credits:    sql`${usersTable.credits} - ${finalPrice}`,
      totalSpent: sql`${usersTable.totalSpent} + ${finalPrice}`,
      updatedAt:  new Date(),
    })
    .where(
      and(
        eq(usersTable.id, userId),
        gte(usersTable.credits, finalPrice)   // atomic guard — prevents double-spend
      )
    )
    .returning({ newCredits: usersTable.credits });

  if (!updated.length) {
    res.status(400).json({ error: "Insufficient credits", required: finalPrice });
    return;
  }

  // Record in ledger with pricing metadata
  await db.insert(ledgerEntriesTable).values({
    id: randomUUID(),
    userId,
    amount: -finalPrice,
    type: "SHOP_PURCHASE",
    referenceId: purchaseRefId,
    description: `${item.emoji} ${item.name} — ${finalPrice} credits${flashActive ? " (flash sale)" : ""}`,
    dynamicPriceApplied: finalPrice,
    basePriceSnapshot: item.creditsCost,
  });

  // Add to inventory
  await db.insert(shopInventoryTable).values({
    id: purchaseId,
    userId,
    itemId: item.id,
    itemName: item.name,
    creditsCost: finalPrice,
  });

  // Cancel whale recovery job if present (user converted!)
  if (checkoutId) {
    try {
      const checkout = await db
        .select()
        .from(abandonedCheckoutsTable)
        .where(eq(abandonedCheckoutsTable.id, checkoutId))
        .limit(1)
        .then((r) => r[0]);

      if (checkout?.bullJobId) {
        await cancelWhaleJob(checkout.bullJobId);
      }
      await db
        .update(abandonedCheckoutsTable)
        .set({ convertedAt: new Date() })
        .where(eq(abandonedCheckoutsTable.id, checkoutId));
    } catch { /* silent */ }
  }

  res.json({
    success: true,
    item: { ...item, creditsCost: finalPrice },
    newCreditBalance: updated[0]!.newCredits,
    purchaseId,
    flashSaleApplied: flashActive,
    discountPct,
  });
});

// ── GET /api/shop/flash-sale ─────────────────────────────────────────────────
router.get("/flash-sale", async (_req, res) => {
  const flash = await getActiveFlashSale();
  res.json(flash);
});

export default router;
