import { pgTable, text, integer, bigint, timestamp, uniqueIndex, boolean, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "bigint" }).notNull().unique(),
  username: text("username"),
  firstName: text("first_name"),
  credits: integer("credits").notNull().default(10),
  freeImagesSent: integer("free_images_sent").notNull().default(0),
  language: text("language").notNull().default("en"),
  adultConfirmed: boolean("adult_confirmed").notNull().default(false),
  isTelegramPremium: boolean("is_telegram_premium").notNull().default(false),
  streakDays: integer("streak_days").notNull().default(0),
  lastLoginDate: text("last_login_date"),
  birthDate: text("birth_date"),
  dailyTarotEnabled: boolean("daily_tarot_enabled").notNull().default(true),
  lastTarotSentAt: timestamp("last_tarot_sent_at"),
  totalSpent: integer("total_spent").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const companionsTable = pgTable("companions", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  avatarUrl: text("avatar_url").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  personality: text("personality").notNull(),
  greetingText: text("greeting_text").notNull(),
  creditCostText: integer("credit_cost_text").notNull().default(1),
  creditCostImg: integer("credit_cost_img").notNull().default(3),
  tags: text("tags").default(""),
  preferredTags: text("preferred_tags").default(""),
});

export const conversationsTable = pgTable("conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  companionId: text("companion_id").notNull().references(() => companionsTable.id, { onDelete: "cascade" }),
  affinity: integer("affinity").notNull().default(0),
  milestonesReached: text("milestones_reached").default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  uniqueUserCompanion: uniqueIndex("unique_user_companion").on(t.userId, t.companionId),
}));

export const messagesTable = pgTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  sender: text("sender").notNull(),
  type: text("type").notNull().default("text"),
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ledgerEntriesTable = pgTable("ledger_entries", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  type: text("type").notNull(),
  referenceId: text("reference_id").notNull().unique(),
  description: text("description").notNull(),
  dynamicPriceApplied: real("dynamic_price_applied"),
  basePriceSnapshot: integer("base_price_snapshot"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subscriptionsTable = pgTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  planId: text("plan_id").notNull(),
  starsPaymentId: text("stars_payment_id").unique(),
  startsAt: timestamp("starts_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const giftsTable = pgTable("gifts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  conversationId: text("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  giftType: text("gift_type").notNull(),
  creditsCost: integer("credits_cost").notNull(),
  affinityGain: integer("affinity_gain").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const shopInventoryTable = pgTable("shop_inventory", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull(),
  itemName: text("item_name").notNull(),
  creditsCost: integer("credits_cost").notNull(),
  isGifted: boolean("is_gifted").notNull().default(false),
  giftedToCompanionId: text("gifted_to_companion_id"),
  giftedAt: timestamp("gifted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tarotReadingsTable = pgTable("tarot_readings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  companionId: text("companion_id").notNull().references(() => companionsTable.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
  spreadType: text("spread_type").notNull().default("three_card"),
  cards: jsonb("cards").notNull(),
  readingText: text("reading_text").notNull(),
  affinityGain: integer("affinity_gain").notNull().default(2),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Phase 3: Abandoned Checkout & Flash Sales ─────────────────────────────────

export const abandonedCheckoutsTable = pgTable("abandoned_checkouts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull(),
  itemName: text("item_name").notNull(),
  basePrice: integer("base_price").notNull(),
  bullJobId: text("bull_job_id"),
  discountSent: boolean("discount_sent").notNull().default(false),
  convertedAt: timestamp("converted_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const flashSalesTable = pgTable("flash_sales", {
  id: text("id").primaryKey(),
  discountPct: real("discount_pct").notNull().default(0.15),
  active: boolean("active").notNull().default(false),
  startsAt: timestamp("starts_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  triggeredBy: text("triggered_by").notNull().default("system"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Zod insert schemas ────────────────────────────────────────────────────────

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true, updatedAt: true });
export const insertCompanionSchema = createInsertSchema(companionsTable);
export const insertConversationSchema = createInsertSchema(conversationsTable).omit({ createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ createdAt: true });
export const insertLedgerEntrySchema = createInsertSchema(ledgerEntriesTable).omit({ createdAt: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({ createdAt: true });
export const insertGiftSchema = createInsertSchema(giftsTable).omit({ createdAt: true });
export const insertTarotReadingSchema = createInsertSchema(tarotReadingsTable).omit({ createdAt: true });
export const insertShopInventorySchema = createInsertSchema(shopInventoryTable).omit({ createdAt: true });
export const insertAbandonedCheckoutSchema = createInsertSchema(abandonedCheckoutsTable).omit({ createdAt: true });
export const insertFlashSaleSchema = createInsertSchema(flashSalesTable).omit({ createdAt: true });

// ── TypeScript types ──────────────────────────────────────────────────────────

export type User = typeof usersTable.$inferSelect;
export type Companion = typeof companionsTable.$inferSelect;
export type Conversation = typeof conversationsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type LedgerEntry = typeof ledgerEntriesTable.$inferSelect;
export type Subscription = typeof subscriptionsTable.$inferSelect;
export type Gift = typeof giftsTable.$inferSelect;
export type TarotReading = typeof tarotReadingsTable.$inferSelect;
export type ShopInventory = typeof shopInventoryTable.$inferSelect;
export type AbandonedCheckout = typeof abandonedCheckoutsTable.$inferSelect;
export type FlashSale = typeof flashSalesTable.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCompanion = z.infer<typeof insertCompanionSchema>;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertLedgerEntry = z.infer<typeof insertLedgerEntrySchema>;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type InsertGift = z.infer<typeof insertGiftSchema>;
export type InsertTarotReading = z.infer<typeof insertTarotReadingSchema>;
export type InsertShopInventory = z.infer<typeof insertShopInventorySchema>;
