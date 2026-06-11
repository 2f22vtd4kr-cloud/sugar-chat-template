import { Router } from "express";
import { requireTelegramAuth } from "../middlewares/telegram-auth.js";
import { db, usersTable, ledgerEntriesTable, shopInventoryTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";

const router = Router();
router.use(requireTelegramAuth);

export interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  description: string;
  creditsCost: number;
  category: "romantic" | "spicy" | "luxury" | "playful";
  gradient: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: "rose_bouquet",   name: "Rose Bouquet",   emoji: "🌹", description: "A lush arrangement of crimson roses — nothing says devotion like fresh-cut beauty.", creditsCost: 12,  category: "romantic", gradient: "135deg, #7f1d1d, #991b1b" },
  { id: "wine_bottle",    name: "Wine Bottle",     emoji: "🍷", description: "A bottle of velvety red wine, perfect for an intimate evening together.",              creditsCost: 15,  category: "romantic", gradient: "135deg, #450a0a, #7f1d1d" },
  { id: "plane_ticket",   name: "Plane Ticket",    emoji: "✈️", description: "A surprise getaway for two. Where shall we escape to together?",                       creditsCost: 25,  category: "romantic", gradient: "135deg, #1e1b4b, #312e81" },
  { id: "silk_pajamas",   name: "Silk Pajamas",    emoji: "🩷", description: "Whisper-soft silk, worn just for you on lazy Sunday mornings.",                        creditsCost: 20,  category: "romantic", gradient: "135deg, #831843, #9d174d" },
  { id: "diamond_ring",   name: "Diamond Ring",    emoji: "💍", description: "A stunning diamond solitaire — a pledge carved in forever.",                           creditsCost: 55,  category: "luxury",   gradient: "135deg, #0c4a6e, #075985" },
  { id: "vip_pass",       name: "VIP Pass",        emoji: "👑", description: "Exclusive VIP access — red-carpet treatment, reserved just for you.",                  creditsCost: 40,  category: "luxury",   gradient: "135deg, #713f12, #92400e" },
  { id: "body_lotion",    name: "Body Lotion",      emoji: "🧴", description: "Silky smooth premium lotion — slide it over every curve with care.",                   creditsCost: 20,  category: "playful",  gradient: "135deg, #14532d, #166534" },
  { id: "cat_ears",       name: "Cat Ears",        emoji: "🐱", description: "Mischievous velvet cat ears that hint at a playful alter ego.",                        creditsCost: 22,  category: "playful",  gradient: "135deg, #581c87, #6b21a8" },
  { id: "lace_lingerie",  name: "Lace Lingerie",   emoji: "👙", description: "Sheer black lace lingerie — designed to be appreciated and removed slowly.",           creditsCost: 75,  category: "spicy",    gradient: "135deg, #1c1917, #292524" },
  { id: "bondage_rope",   name: "Bondage Rope",    emoji: "🪢", description: "Soft shibari rope — trust woven into every knot.",                                     creditsCost: 35,  category: "spicy",    gradient: "135deg, #7c2d12, #9a3412" },
  { id: "dildo",          name: "Pleasure Toy",    emoji: "💜", description: "A smooth, premium pleasure wand — for moments when imagination needs company.",        creditsCost: 35,  category: "spicy",    gradient: "135deg, #4c1d95, #5b21b6" },
  { id: "anal_plug",      name: "Jewel Plug",      emoji: "💎", description: "A polished stainless plug with a glittering jewel base — beauty meets sensation.",     creditsCost: 45,  category: "spicy",    gradient: "135deg, #0f172a, #1e293b" },
  { id: "piercing_set",   name: "Piercing Set",    emoji: "✨", description: "Delicate surgical-steel body jewelry for a bold new statement.",                       creditsCost: 165, category: "luxury",   gradient: "135deg, #0c4a6e, #164e63" },
  { id: "lubricant",      name: "Lubricant",       emoji: "🫧", description: "Premium silicone-based lubricant — silky, long-lasting, never sticky.",                creditsCost: 18,  category: "spicy",    gradient: "135deg, #065f46, #047857" },
  { id: "control_ball",   name: "Control Ball",    emoji: "🔮", description: "A captivating crystal orb — symbol of delicious surrender and power exchange.",        creditsCost: 300, category: "luxury",   gradient: "135deg, #4c1d95, #7c3aed" },
];

// GET /api/shop/items
router.get("/items", (_req, res) => {
  res.json(SHOP_ITEMS);
});

// GET /api/shop/inventory
router.get("/inventory", async (req, res) => {
  const userId = req.dbUserId!;
  const items = await db
    .select()
    .from(shopInventoryTable)
    .where(eq(shopInventoryTable.userId, userId))
    .orderBy(desc(shopInventoryTable.createdAt))
    .limit(50);
  res.json(items);
});

// POST /api/shop/purchase
router.post("/purchase", async (req, res) => {
  const userId = req.dbUserId!;
  const { itemId } = req.body as { itemId: string };

  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1)
    .then((r) => r[0]);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.credits < item.creditsCost) {
    res.status(400).json({ error: "Insufficient credits", required: item.creditsCost, available: user.credits });
    return;
  }

  const purchaseId = randomUUID();

  await db.transaction(async (tx) => {
    await tx
      .update(usersTable)
      .set({ credits: sql`${usersTable.credits} - ${item.creditsCost}`, updatedAt: new Date() })
      .where(eq(usersTable.id, userId));

    await tx.insert(ledgerEntriesTable).values({
      id: randomUUID(),
      userId,
      amount: -item.creditsCost,
      type: "SHOP_PURCHASE",
      referenceId: `shop-${userId}-${itemId}-${Date.now()}`,
      description: `${item.emoji} ${item.name} — ${item.creditsCost} credits`,
    });

    await tx.insert(shopInventoryTable).values({
      id: purchaseId,
      userId,
      itemId: item.id,
      itemName: item.name,
      creditsCost: item.creditsCost,
    });
  });

  const updatedUser = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1)
    .then((r) => r[0]!);

  res.json({
    success: true,
    item,
    newCreditBalance: updatedUser.credits,
    purchaseId,
  });
});

export default router;
