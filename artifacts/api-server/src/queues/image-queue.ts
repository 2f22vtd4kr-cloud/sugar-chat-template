import { Queue, Worker } from "bullmq";
import { createBullConnectionOptions } from "../lib/redis.js";
import { db, messagesTable, conversationsTable, usersTable, ledgerEntriesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import axios from "axios";

export const imageQueue = new Queue("image-processing", {
  connection: createBullConnectionOptions(),
});

export interface ImageJobData {
  conversationId: string;
  userId: string;
  companionId: string;
  companionName: string;
  prompt: string;
  ledgerEntryId: string;
  telegramChatId?: number;
  botToken?: string;
}

export const imageWorker = new Worker<ImageJobData>(
  "image-processing",
  async (job) => {
    const { conversationId, userId, companionName, prompt, telegramChatId, botToken } = job.data;

    const encodedPrompt = encodeURIComponent(
      `${companionName} companion: ${prompt}, anime style, detailed, beautiful`
    );
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true&seed=${Date.now()}`;

    let imageBuffer: Buffer | null = null;
    try {
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 45000,
      });
      imageBuffer = Buffer.from(response.data as ArrayBuffer);
    } catch (err) {
      console.error("[ImageWorker] Image fetch failed:", err);
      throw err; // triggers failure handler for refund
    }

    // Save image message
    const msgId = randomUUID();
    await db.insert(messagesTable).values({
      id: msgId,
      conversationId,
      sender: "companion",
      type: "image",
      content: `Here's a picture for you`,
      mediaUrl: imageUrl,
    });

    // Update affinity (+3 per image)
    await db
      .update(conversationsTable)
      .set({
        updatedAt: new Date(),
        affinity: sql`LEAST(${conversationsTable.affinity} + 3, 100)`,
      })
      .where(eq(conversationsTable.id, conversationId));

    // Send image via Telegram
    if (telegramChatId && botToken && imageBuffer) {
      try {
        const FormData = (await import("form-data")).default;
        const form = new FormData();
        form.append("chat_id", String(telegramChatId));
        form.append("photo", imageBuffer, { filename: "image.jpg", contentType: "image/jpeg" });

        await axios.post(
          `https://api.telegram.org/bot${botToken}/sendPhoto`,
          form,
          { headers: form.getHeaders(), timeout: 30000 }
        );
      } catch (err) {
        console.error("[ImageWorker] Telegram sendPhoto failed:", err);
      }
    }

    return { msgId, imageUrl };
  },
  {
    connection: createBullConnectionOptions(),
    concurrency: 3,
  }
);

imageWorker.on("failed", async (job, err) => {
  console.error(`[ImageWorker] Job ${job?.id} failed:`, err.message);

  // Refund credits on failure
  if (job?.data.userId) {
    await db.update(usersTable)
      .set({ credits: sql`${usersTable.credits} + 3` })
      .where(eq(usersTable.id, job.data.userId))
      .catch((e) => console.error("[ImageWorker] Refund failed:", e));
  }
});
