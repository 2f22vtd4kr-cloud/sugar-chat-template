import { pgTable, text, integer, bigint, timestamp, uniqueIndex, boolean, jsonb } from "drizzle-orm/pg-core";
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
  lastLoginDate: text("last_login_date"), // "YYYY-MM-DD"
  birthDate: text("birth_date"), // "YYYY-MM-DD" — optional, for tarot astrology
  dailyTarotEnabled: boolean("daily_tarot_enabled").notNull().default(true),
  lastTarotSentAt: timestamp("last_tarot_sent_at"),
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
});

export const conversationsTable = pgTable("conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  companionId: text("companion_id").notNull().references(() => companionsTable.id, { onDelete: "cascade" }),
  affinity: integer("affinity").notNull().default(0),
  milestonesReached: text("milestones_reached").default(""), // comma-separated: "25,50,75"
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
  giftType: text("gift_type").notNull(), // "rose" | "heart" | "diamond" | "star"
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tarotReadingsTable = pgTable("tarot_readings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  companionId: text("companion_id").notNull().references(() => companionsTable.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
  spreadType: text("spread_type").notNull().default("three_card"), // "three_card" | "five_card"
  cards: jsonb("cards").notNull(), // array of { name, position, reversed, meaning }
  readingText: text("reading_text").notNull(),
  affinityGain: integer("affinity_gain").notNull().default(2),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true, updatedAt: true });
export const insertCompanionSchema = createInsertSchema(companionsTable);
export const insertConversationSchema = createInsertSchema(conversationsTable).omit({ createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ createdAt: true });
export const insertLedgerEntrySchema = createInsertSchema(ledgerEntriesTable).omit({ createdAt: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({ createdAt: true });
export const insertGiftSchema = createInsertSchema(giftsTable).omit({ createdAt: true });
export const insertTarotReadingSchema = createInsertSchema(tarotReadingsTable).omit({ createdAt: true });
export const insertShopInventorySchema = createInsertSchema(shopInventoryTable).omit({ createdAt: true });

export type User = typeof usersTable.$inferSelect;
export type Companion = typeof companionsTable.$inferSelect;
export type Conversation = typeof conversationsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type LedgerEntry = typeof ledgerEntriesTable.$inferSelect;
export type Subscription = typeof subscriptionsTable.$inferSelect;
export type Gift = typeof giftsTable.$inferSelect;
export type TarotReading = typeof tarotReadingsTable.$inferSelect;
export type ShopInventory = typeof shopInventoryTable.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCompanion = z.infer<typeof insertCompanionSchema>;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertLedgerEntry = z.infer<typeof insertLedgerEntrySchema>;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type InsertGift = z.infer<typeof insertGiftSchema>;
export type InsertTarotReading = z.infer<typeof insertTarotReadingSchema>;
