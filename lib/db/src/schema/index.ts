import { pgTable, text, integer, bigint, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "bigint" }).notNull().unique(),
  username: text("username"),
  credits: integer("credits").notNull().default(10),
  freeImagesSent: integer("free_images_sent").notNull().default(0),
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
});

export const conversationsTable = pgTable("conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  companionId: text("companion_id").notNull().references(() => companionsTable.id, { onDelete: "cascade" }),
  affinity: integer("affinity").notNull().default(0),
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

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true, updatedAt: true });
export const insertCompanionSchema = createInsertSchema(companionsTable);
export const insertConversationSchema = createInsertSchema(conversationsTable).omit({ createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ createdAt: true });
export const insertLedgerEntrySchema = createInsertSchema(ledgerEntriesTable).omit({ createdAt: true });

export type User = typeof usersTable.$inferSelect;
export type Companion = typeof companionsTable.$inferSelect;
export type Conversation = typeof conversationsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type LedgerEntry = typeof ledgerEntriesTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCompanion = z.infer<typeof insertCompanionSchema>;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertLedgerEntry = z.infer<typeof insertLedgerEntrySchema>;
