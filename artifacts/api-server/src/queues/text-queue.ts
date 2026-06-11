import { Queue, Worker, type Job } from "bullmq";
import { createBullConnectionOptions } from "../lib/redis.js";
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

export const textQueue = new Queue("text-processing", {
  connection: createBullConnectionOptions(),
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

export const textWorker = new Worker<TextJobData>(
  "text-processing",
  async (job: Job<TextJobData>) => {
    const {
      conversationId,
      userId,
      systemPrompt,
      messages,
      telegramChatId,
      botToken,
    } = job.data;

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
              content:
                systemPrompt +
                "\n\nRespond in 400 characters or fewer. Be natural and conversational.",
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

      replyContent =
        response.data.choices[0]?.message?.content ?? "I'm here with you.";
      aiSucceeded = true;
    } catch (err) {
      console.error("[TextWorker] AI call failed:", err);
      // Refund the credit immediately — job will still complete successfully
      await refundCredit(userId);
      replyContent = "I'm thinking... give me a moment. 💭";
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

    // Update conversation updatedAt and affinity (+1 per successful text)
    await db
      .update(conversationsTable)
      .set({
        updatedAt: new Date(),
        ...(aiSucceeded
          ? { affinity: sql`LEAST(${conversationsTable.affinity} + 1, 100)` }
          : {}),
      })
      .where(eq(conversationsTable.id, conversationId));

    // Send reply via Telegram bot if chatId provided
    if (telegramChatId && botToken) {
      try {
        await axios.post(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            chat_id: telegramChatId,
            text: replyContent,
          }
        );
      } catch (err) {
        console.error("[TextWorker] Telegram send failed:", err);
      }
    }

    return { replyId, content: replyContent };
  },
  {
    connection: createBullConnectionOptions(),
    concurrency: 5,
  }
);

// Hard failure (job threw / retries exhausted) — refund if not already refunded
textWorker.on("failed", (job: Job<TextJobData> | undefined, err: Error) => {
  console.error(`[TextWorker] Job ${job?.id ?? "unknown"} failed:`, err.message);

  if (job?.data?.userId) {
    void refundCredit(job.data.userId);
  }
});
