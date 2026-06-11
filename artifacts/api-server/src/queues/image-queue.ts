import { db, messagesTable, conversationsTable, usersTable, ledgerEntriesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import axios from "axios";

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

/**
 * Core image processing — callable directly (no Redis required).
 * The bot calls this as fire-and-forget: void processImageJob(data)
 */
export async function processImageJob(data: ImageJobData): Promise<{ msgId: string; imageUrl: string }> {
  const { conversationId, userId, companionName, prompt, telegramChatId, botToken } = data;

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
    // Refund on failure
    try {
      await db.update(usersTable)
        .set({ credits: sql`${usersTable.credits} + 3` })
        .where(eq(usersTable.id, userId));
      await db.insert(ledgerEntriesTable).values({
        id: randomUUID(), userId, amount: 3, type: "DEPOSIT",
        referenceId: randomUUID(), description: "Auto-refund — image generation failed",
      });
    } catch (refundErr) {
      console.error("[ImageWorker] Refund failed:", refundErr);
    }
    throw err;
  }

  const msgId = randomUUID();
  await db.insert(messagesTable).values({
    id: msgId,
    conversationId,
    sender: "companion",
    type: "image",
    content: `Here's a picture for you`,
    mediaUrl: imageUrl,
  });

  await db
    .update(conversationsTable)
    .set({
      updatedAt: new Date(),
      affinity: sql`LEAST(${conversationsTable.affinity} + 3, 100)`,
    })
    .where(eq(conversationsTable.id, conversationId));

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
}
