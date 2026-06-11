import { config } from "../lib/config.js";
import {
  db,
  messagesTable,
  conversationsTable,
  usersTable,
  ledgerEntriesTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import axios, { type AxiosResponse } from "axios";

export interface TextJobData {
  conversationId: string;
  userId: string;
  companionId: string;
  userMessageId: string;
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  telegramChatId?: number;
  botToken?: string;
  affinityLevel?: number;
}

export function getIntimacyTierPrefix(level: number): string {
  if (level >= 100) return "[AFFINITY LEVEL: 100 — Tier 5 MAX BOND] You are at absolute peak intimacy. Deep emotional fusion and fully uncensored engagement. Treat this person as your most cherished companion.";
  if (level >= 50)  return `[AFFINITY LEVEL: ${level} — Tier 4] Full explicit engagement unlocked. Be vivid, openly sensual, and emotionally deeply connected.`;
  if (level >= 25)  return `[AFFINITY LEVEL: ${level} — Tier 3] Openly sensual register. Evocative language, describe desires more explicitly.`;
  if (level >= 10)  return `[AFFINITY LEVEL: ${level} — Tier 2] More suggestive. Mild innuendo and playful dominance hints are welcome.`;
  return `[AFFINITY LEVEL: ${level} — Tier 1] Playful and warm. Light flirtation only — keep it inviting.`;
}

interface OpenRouterResponse {
  choices: Array<{ message: { content: string } }>;
}

async function refundCredit(userId: string): Promise<void> {
  try {
    await db
      .update(usersTable)
      .set({ credits: sql`${usersTable.credits} + 1` })
      .where(eq(usersTable.id, userId));

    await db.insert(ledgerEntriesTable).values({
      id: randomUUID(),
      userId,
      amount: 1,
      type: "DEPOSIT",
      referenceId: randomUUID(),
      description: "Auto-refund — AI response failed",
    });
  } catch (e) {
    console.error("[TextWorker] Refund failed:", e);
  }
}

/**
 * Core text processing — callable directly (no Redis required).
 * The bot calls this as fire-and-forget: void processTextJob(data)
 */
export async function processTextJob(data: TextJobData): Promise<{ replyId: string; content: string }> {
  const {
    conversationId,
    userId,
    systemPrompt,
    messages,
    telegramChatId,
    botToken,
    affinityLevel,
  } = data;

  const tierPrefix = getIntimacyTierPrefix(affinityLevel ?? 0);
  const fullSystemPrompt = `${tierPrefix}\n\n${systemPrompt}`;

  let replyContent = "";
  let aiSucceeded = false;

  try {
    const response: AxiosResponse<OpenRouterResponse> = await axios.post(
      `${config.openrouterBaseUrl}/chat/completions`,
      {
        model: config.openrouterModel,
        messages: [
          {
            role: "system",
            content: fullSystemPrompt + "\n\nRespond in 400 characters or fewer. Be natural and conversational.",
          },
          ...messages,
        ],
        max_tokens: 200,
      },
      {
        headers: {
          Authorization: `Bearer ${config.openrouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://replit.com",
        },
        timeout: 30000,
      }
    );

    replyContent = response.data.choices[0]?.message?.content ?? "I'm here with you.";
    aiSucceeded = true;
  } catch (err) {
    console.error("[TextWorker] AI call failed:", err);
    await refundCredit(userId);
    replyContent = "I'm thinking... give me a moment. 💭";
  }

  const replyId = randomUUID();
  await db.insert(messagesTable).values({
    id: replyId,
    conversationId,
    sender: "companion",
    type: "text",
    content: replyContent,
  });

  await db
    .update(conversationsTable)
    .set({
      updatedAt: new Date(),
      ...(aiSucceeded
        ? { affinity: sql`LEAST(${conversationsTable.affinity} + 1, 100)` }
        : {}),
    })
    .where(eq(conversationsTable.id, conversationId));

  if (telegramChatId && botToken) {
    try {
      await axios.post(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        { chat_id: telegramChatId, text: replyContent }
      );
    } catch (err) {
      console.error("[TextWorker] Telegram send failed:", err);
    }
  }

  return { replyId, content: replyContent };
}
