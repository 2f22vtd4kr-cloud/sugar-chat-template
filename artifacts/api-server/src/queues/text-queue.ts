import { Queue, Worker } from "bullmq";
import { createRedisConnection } from "../lib/redis.js";
import { config } from "../lib/config.js";
import { db, messagesTable, conversationsTable, usersTable, ledgerEntriesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import axios from "axios";

export const textQueue = new Queue("text-processing", {
  connection: createRedisConnection(),
});

export interface TextJobData {
  conversationId: string;
  userId: string;
  companionId: string;
  userMessageId: string;
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  telegramChatId?: number;
  botToken?: string;
}

export const textWorker = new Worker<TextJobData>(
  "text-processing",
  async (job) => {
    const { conversationId, userId, systemPrompt, messages, telegramChatId, botToken } = job.data;

    let replyContent = "";

    try {
      const response = await axios.post(
        `${config.openrouterBaseUrl}/chat/completions`,
        {
          model: config.openrouterModel,
          messages: [
            { role: "system", content: systemPrompt + "\n\nRespond in 400 characters or fewer. Be natural and conversational." },
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

      replyContent =
        (response.data as { choices: Array<{ message: { content: string } }> })
          .choices[0]?.message?.content ?? "I'm here with you.";
    } catch (err) {
      console.error("[TextWorker] AI call failed:", err);
      replyContent = "I'm thinking... give me a moment.";
    }

    // Save companion reply message
    const replyId = randomUUID();
    await db.insert(messagesTable).values({
      id: replyId,
      conversationId,
      sender: "companion",
      type: "text",
      content: replyContent,
    });

    // Update conversation updatedAt and affinity (+1 per text)
    await db
      .update(conversationsTable)
      .set({
        updatedAt: new Date(),
        affinity: sql`LEAST(${conversationsTable.affinity} + 1, 100)`,
      })
      .where(eq(conversationsTable.id, conversationId));

    // Send reply via Telegram bot if chatId provided
    if (telegramChatId && botToken) {
      try {
        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          chat_id: telegramChatId,
          text: replyContent,
        });
      } catch (err) {
        console.error("[TextWorker] Telegram send failed:", err);
      }
    }

    return { replyId, content: replyContent };
  },
  {
    connection: createRedisConnection(),
    concurrency: 5,
  }
);

textWorker.on("failed", (job, err) => {
  console.error(`[TextWorker] Job ${job?.id} failed:`, err.message);

  // Refund credit on failure
  if (job?.data.userId) {
    db.update(usersTable)
      .set({ credits: sql`${usersTable.credits} + 1` })
      .where(eq(usersTable.id, job.data.userId))
      .catch((e) => console.error("[TextWorker] Refund failed:", e));
  }
});
