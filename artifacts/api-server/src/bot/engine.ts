import { Telegraf, Scenes, session, Markup } from "telegraf";
import { config } from "../lib/config.js";
import { db, usersTable, companionsTable, conversationsTable, messagesTable, ledgerEntriesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { textQueue } from "../queues/text-queue.js";
import { imageQueue } from "../queues/image-queue.js";
import { sql } from "drizzle-orm";

export const bot = new Telegraf(config.telegramBotToken);

// Active companion sessions: chatId -> { companionId, conversationId }
const activeSessions = new Map<number, { companionId: string; conversationId: string; companionName: string }>();

// Upsert user and return DB user
async function upsertUser(telegramId: number, username?: string) {
  const telegramIdBigInt = BigInt(telegramId);
  let user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, telegramIdBigInt))
    .limit(1)
    .then((r) => r[0]);

  if (!user) {
    const id = randomUUID();
    await db.insert(usersTable).values({
      id,
      telegramId: telegramIdBigInt,
      username: username ?? null,
      credits: 10,
      freeImagesSent: 0,
    });
    user = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1).then((r) => r[0]!);
    console.log(`[Bot] New user created: ${telegramId}`);
  }

  return user;
}

// /start command
bot.start(async (ctx) => {
  const { id, username } = ctx.from;
  const user = await upsertUser(id, username);

  const companions = await db.select().from(companionsTable);
  const companionButtons = companions.map((c) =>
    [Markup.button.callback(`${c.name} — ${c.personality.substring(0, 30)}`, `companion:${c.id}`)]
  );

  await ctx.reply(
    `Welcome back${user.username ? `, @${user.username}` : ""}!\n\nYou have ${user.credits} credits.\n\nChoose a companion to chat with:`,
    Markup.inlineKeyboard([
      ...companionButtons,
      [Markup.button.callback("Credit Vault", "credits")],
      [Markup.button.url("Open Web App", `https://t.me/${config.telegramBotUsername}/app`)],
    ])
  );
});

// /cancel command — exits any active companion session
bot.command("cancel", async (ctx) => {
  const chatId = ctx.chat.id;
  if (activeSessions.has(chatId)) {
    activeSessions.delete(chatId);
    await ctx.reply("Session ended. Use /start to begin again.");
  } else {
    await ctx.reply("No active session. Use /start to choose a companion.");
  }
});

// Companion selection
bot.action(/^companion:(.+)$/, async (ctx) => {
  const companionId = ctx.match[1];
  const { id: telegramId, username } = ctx.from;
  const user = await upsertUser(telegramId, username);
  const chatId = ctx.chat!.id;

  const companion = await db
    .select()
    .from(companionsTable)
    .where(eq(companionsTable.id, companionId))
    .limit(1)
    .then((r) => r[0]);

  if (!companion) {
    await ctx.answerCbQuery("Companion not found.");
    return;
  }

  // Get or create conversation
  let conversation = await db
    .select()
    .from(conversationsTable)
    .where(and(eq(conversationsTable.userId, user.id), eq(conversationsTable.companionId, companionId)))
    .limit(1)
    .then((r) => r[0]);

  if (!conversation) {
    const convId = randomUUID();
    await db.insert(conversationsTable).values({
      id: convId,
      userId: user.id,
      companionId,
      affinity: 0,
    });
    // Insert greeting
    await db.insert(messagesTable).values({
      id: randomUUID(),
      conversationId: convId,
      sender: "companion",
      type: "text",
      content: companion.greetingText,
    });
    conversation = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId)).limit(1).then((r) => r[0]!);
  }

  activeSessions.set(chatId, {
    companionId,
    conversationId: conversation.id,
    companionName: companion.name,
  });

  await ctx.answerCbQuery();
  await ctx.reply(
    `You're now chatting with ${companion.name}.\n\nAffinity: ${conversation.affinity}/100\n\nSend a message to chat. Use /image to request a picture (3 credits). Use /cancel to exit.`
  );
  await ctx.reply(companion.greetingText);
});

// Credit vault action
bot.action("credits", async (ctx) => {
  const { id: telegramId, username } = ctx.from;
  const user = await upsertUser(telegramId, username);
  await ctx.answerCbQuery();
  await ctx.reply(
    `Credit Vault\n\nCurrent balance: ${user.credits} credits\n\nCredit packs:\n• Starter: 50 credits — $0.99\n• Popular: 200 credits — $3.49\n• Premium: 500 credits — $7.99\n\nPurchase credits in the Web App.`,
    Markup.inlineKeyboard([
      [Markup.button.url("Open Credit Store", `https://t.me/${config.telegramBotUsername}/app`)],
    ])
  );
});

// /image command — request image in active session
bot.command("image", async (ctx) => {
  const chatId = ctx.chat.id;
  const session = activeSessions.get(chatId);

  if (!session) {
    await ctx.reply("No active companion session. Use /start to choose a companion.");
    return;
  }

  const { id: telegramId, username } = ctx.from;
  const user = await upsertUser(telegramId, username);

  // Check free image or credits
  const hasFreeImage = user.freeImagesSent < 1;
  if (!hasFreeImage && user.credits < 3) {
    await ctx.reply(`Not enough credits. You need 3 credits for an image. You have ${user.credits}.\n\nGet more credits in the Web App.`);
    return;
  }

  const prompt = ctx.message.text.replace("/image", "").trim() || "a beautiful portrait";

  // Deduct credits before enqueue
  await db.transaction(async (tx) => {
    if (hasFreeImage) {
      await tx.update(usersTable).set({ freeImagesSent: sql`${usersTable.freeImagesSent} + 1` }).where(eq(usersTable.id, user.id));
    } else {
      await tx.update(usersTable).set({ credits: sql`${usersTable.credits} - 3` }).where(eq(usersTable.id, user.id));
      await tx.insert(ledgerEntriesTable).values({
        id: randomUUID(),
        userId: user.id,
        amount: -3,
        type: "IMAGE_COST",
        referenceId: randomUUID(),
        description: `Image from ${session.companionName}`,
      });
    }
  });

  await ctx.reply("Generating your image... this takes a moment.");

  const ledgerEntryId = randomUUID();
  await imageQueue.add("generate-image", {
    conversationId: session.conversationId,
    userId: user.id,
    companionId: session.companionId,
    companionName: session.companionName,
    prompt,
    ledgerEntryId,
    telegramChatId: chatId,
    botToken: config.telegramBotToken,
  });

  // Save user's image request message
  await db.insert(messagesTable).values({
    id: randomUUID(),
    conversationId: session.conversationId,
    sender: "user",
    type: "text",
    content: `/image ${prompt}`,
  });
});

// Handle regular text messages — route to AI queue
bot.on("text", async (ctx) => {
  const chatId = ctx.chat.id;
  const activeSession = activeSessions.get(chatId);

  if (!activeSession) {
    await ctx.reply("Choose a companion first using /start.");
    return;
  }

  const { id: telegramId, username } = ctx.from;
  const user = await upsertUser(telegramId, username);

  if (user.credits < 1) {
    await ctx.reply(
      `Out of credits. Get more in the Web App.`,
      Markup.inlineKeyboard([[Markup.button.url("Get Credits", `https://t.me/${config.telegramBotUsername}/app`)]])
    );
    return;
  }

  const userText = ctx.message.text;

  // Deduct 1 credit + create ledger entry atomically
  await db.transaction(async (tx) => {
    await tx.update(usersTable).set({ credits: sql`${usersTable.credits} - 1` }).where(eq(usersTable.id, user.id));
    await tx.insert(ledgerEntriesTable).values({
      id: randomUUID(),
      userId: user.id,
      amount: -1,
      type: "TEXT_COST",
      referenceId: randomUUID(),
      description: `Chat with ${activeSession.companionName}`,
    });
  });

  // Save user message
  const userMsgId = randomUUID();
  await db.insert(messagesTable).values({
    id: userMsgId,
    conversationId: activeSession.conversationId,
    sender: "user",
    type: "text",
    content: userText,
  });

  // Load recent messages for context (last 10)
  const recentMessages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, activeSession.conversationId))
    .orderBy(sql`created_at DESC`)
    .limit(10);

  const companion = await db
    .select()
    .from(companionsTable)
    .where(eq(companionsTable.id, activeSession.companionId))
    .limit(1)
    .then((r) => r[0]!);

  const contextMessages = recentMessages
    .reverse()
    .filter((m) => m.id !== userMsgId)
    .map((m) => ({
      role: (m.sender === "user" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    }));

  contextMessages.push({ role: "user", content: userText });

  // Enqueue AI processing
  await textQueue.add("process-text", {
    conversationId: activeSession.conversationId,
    userId: user.id,
    companionId: activeSession.companionId,
    userMessageId: userMsgId,
    systemPrompt: companion.systemPrompt,
    messages: contextMessages,
    telegramChatId: chatId,
    botToken: config.telegramBotToken,
  });

  // Show typing indicator
  await ctx.sendChatAction("typing");
});

export function startBot(): void {
  bot.launch({ dropPendingUpdates: true }).then(() => {
    console.log("[Bot] Telegram bot started");
  }).catch((err) => {
    console.error("[Bot] Failed to start:", err);
  });

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
