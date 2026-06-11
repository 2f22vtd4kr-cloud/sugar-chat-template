import { Telegraf, Markup, type Context } from "telegraf";
import { config } from "../lib/config.js";
import {
  db,
  usersTable,
  companionsTable,
  conversationsTable,
  messagesTable,
  ledgerEntriesTable,
  conversationCheckpointsTable,
} from "@workspace/db";
import { eq, and, desc, lt, isNull, or } from "drizzle-orm";
import { randomUUID } from "crypto";
import { processTextJob } from "../queues/text-queue.js";
import { processImageJob } from "../queues/image-queue.js";
import { sql } from "drizzle-orm";
import { DEFAULT_COMPANIONS } from "../lib/companion-catalog.js";

export const bot = new Telegraf(config.telegramBotToken);

// ── Telegram Stars credit packages ──────────────────────────────────────────
export const STARS_PACKAGES: Record<
  string,
  { credits: number; stars: number; label: string; description: string }
> = {
  starter: {
    credits: 50,
    stars: 50,
    label: "Starter Pack",
    description: "50 credits to chat and generate images",
  },
  popular: {
    credits: 200,
    stars: 175,
    label: "Popular Pack",
    description: "200 credits — save 12% vs Starter",
  },
  premium: {
    credits: 500,
    stars: 399,
    label: "Premium Pack",
    description: "500 credits — save 20% vs Starter",
  },
};

// ── Session state ────────────────────────────────────────────────────────────
const activeSessions = new Map<
  number,
  { companionId: string; conversationId: string; companionName: string }
>();
const companionOrder = new Map(
  DEFAULT_COMPANIONS.map((c, i) => [c.id, i])
);

function sortCompanions<T extends { id: string }>(companions: T[]): T[] {
  return companions.sort((a, b) => {
    const aO = companionOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bO = companionOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return aO - bO;
  });
}

// ── i18n welcome strings ─────────────────────────────────────────────────────
const WELCOME_MESSAGES: Record<string, (name: string, credits: number) => string> = {
  en: (name, credits) =>
    `🌙 Welcome back, ${name}!\n\nYour companions have been waiting for you.\n\n⚡ Energy: ${credits} credits\n\nChoose a companion and let the fantasy begin…`,
  es: (name, credits) =>
    `🌙 ¡Bienvenido de vuelta, ${name}!\n\nTus compañeras te han estado esperando.\n\n⚡ Energía: ${credits} créditos\n\nElige una compañera y que comience la fantasía…`,
  uk: (name, credits) =>
    `🌙 З поверненням, ${name}!\n\nТвої подруги чекали на тебе.\n\n⚡ Енергія: ${credits} кредитів\n\nОбери подругу та поринь у фантазію…`,
  de: (name, credits) =>
    `🌙 Willkommen zurück, ${name}!\n\nDeine Companions haben auf dich gewartet.\n\n⚡ Energie: ${credits} Credits\n\nWähle eine Begleiterin und lass die Fantasie beginnen…`,
  it: (name, credits) =>
    `🌙 Bentornato, ${name}!\n\nLe tue compagne ti stavano aspettando.\n\n⚡ Energia: ${credits} crediti\n\nScegli una compagna e lasciati andare alla fantasia…`,
  ru: (name, credits) =>
    `🌙 С возвращением, ${name}!\n\nТвои подруги ждали тебя.\n\n⚡ Энергия: ${credits} кредитов\n\nВыбери подругу и начни фантазию…`,
};

function getWelcomeMessage(
  langCode: string | undefined,
  name: string,
  credits: number
): string {
  const lang = langCode?.slice(0, 2).toLowerCase() ?? "en";
  const fn = WELCOME_MESSAGES[lang] ?? WELCOME_MESSAGES["en"]!;
  return fn(name, credits);
}

// ── User upsert ──────────────────────────────────────────────────────────────
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
    user = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1)
      .then((r) => r[0]!);
    console.log(`[Bot] New user created: ${telegramId}`);
  }

  return user;
}

const MINI_APP_BASE = config.miniAppUrl;

// ── /start ───────────────────────────────────────────────────────────────────
bot.start(async (ctx) => {
  const { id, username, language_code } = ctx.from;
  const user = await upsertUser(id, username);
  const payload = ctx.payload ?? "";

  // Deep-link: companion_<id>
  if (payload.startsWith("companion_")) {
    await selectCompanion(ctx, payload.slice("companion_".length));
    return;
  }

  // Deep-link: resume_<conversationId> — restore session from Mini App handoff
  if (payload.startsWith("resume_")) {
    const conversationId = payload.slice("resume_".length);
    const conv = await db
      .select()
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.id, conversationId),
          eq(conversationsTable.userId, user.id)
        )
      )
      .limit(1)
      .then((r) => r[0]);

    if (conv) {
      const companion = await db
        .select()
        .from(companionsTable)
        .where(eq(companionsTable.id, conv.companionId))
        .limit(1)
        .then((r) => r[0]);

      if (companion && ctx.chat) {
        activeSessions.set(ctx.chat.id, {
          companionId: companion.id,
          conversationId: conv.id,
          companionName: companion.name,
        });

        await ctx.reply(
          `✨ Conversation resumed with ${companion.name}.\n\nAffinity: ${conv.affinity}/100\n\nSend a message to continue. Use /cancel to exit.`
        );
        return;
      }
    }

    // Fallback if conversation not found
    await ctx.reply("Could not resume that conversation. Starting fresh…");
  }

  // ref_<userId> — affiliate referral tracking (log, then show normal start)
  if (payload.startsWith("ref_")) {
    const referrerId = payload.slice("ref_".length);
    console.log(
      `[Affiliate] User ${user.id} joined via referral from ${referrerId}`
    );
  }

  const name = user.username ? `@${user.username}` : "there";
  const welcomeText = getWelcomeMessage(language_code, name, user.credits);

  await ctx.reply(
    welcomeText,
    Markup.inlineKeyboard([
      [Markup.button.webApp("💜 Open App", MINI_APP_BASE)],
      [
        Markup.button.webApp("👑 Premium", MINI_APP_BASE),
        Markup.button.webApp("⚙️ Settings", MINI_APP_BASE),
      ],
    ])
  );
});

// ── /help ────────────────────────────────────────────────────────────────────
bot.command("help", async (ctx) => {
  await ctx.reply(
    `🆘 *Sugar Chat — Help Guide*\n\n` +
      `Here's everything you can do:\n\n` +
      `🔮 */start* — Open the main menu & choose a companion\n` +
      `⚡ */energy* — Check your current credit balance\n` +
      `💾 */savechat* — Save your current conversation context\n` +
      `🤝 */affiliate* — Get your referral link & earn free credits\n` +
      `🖼️ */prompt* — Customize your dialogue settings\n` +
      `🚫 */cancel* — Exit the current companion session\n\n` +
      `*How credits work:*\n` +
      `• 1 credit per text message\n` +
      `• 3 credits per AI-generated image\n` +
      `• Buy more with Telegram Stars ⭐\n\n` +
      `Need more help? Tap the button below.`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.webApp("📱 Open Mini App", MINI_APP_BASE),
          Markup.button.callback("⭐ Buy Credits", "buy_menu"),
        ],
        [Markup.button.webApp("👑 Get Subscription", MINI_APP_BASE)],
      ]),
    }
  );
});

// ── /savechat ────────────────────────────────────────────────────────────────
bot.command("savechat", async (ctx) => {
  const chatId = ctx.chat.id;
  const session = activeSessions.get(chatId);

  if (!session) {
    await ctx.reply(
      "No active session to save. Use /start to choose a companion first."
    );
    return;
  }

  try {
    // Fetch recent messages as checkpoint
    const recentMessages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, session.conversationId))
      .orderBy(desc(messagesTable.createdAt))
      .limit(20);

    const messageCount = recentMessages.length;
    const lastMessage = recentMessages[0];

    // Update conversation timestamp to mark it as recently checkpointed
    await db
      .update(conversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(conversationsTable.id, session.conversationId));

    const preview = lastMessage
      ? lastMessage.content.slice(0, 60) + (lastMessage.content.length > 60 ? "…" : "")
      : "No messages yet";

    await ctx.reply(
      `💾 *Conversation saved!*\n\n` +
        `Companion: ${session.companionName}\n` +
        `Messages in memory: ${messageCount}\n` +
        `Last message: _${preview}_\n\n` +
        `Your conversation is safely stored. Continue anytime! 🌙`,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    console.error("[Bot] /savechat error:", err);
    await ctx.reply("Failed to save conversation. Please try again.");
  }
});

// ── /checkpoint ──────────────────────────────────────────────────────────────
bot.command("checkpoint", async (ctx) => {
  const chatId = ctx.chat.id;
  const session = activeSessions.get(chatId);

  if (!session) {
    await ctx.reply(
      "No active session to checkpoint. Use /start to choose a companion first."
    );
    return;
  }

  try {
    const recentMessages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, session.conversationId))
      .orderBy(desc(messagesTable.createdAt))
      .limit(30);

    const conv = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, session.conversationId))
      .limit(1)
      .then((r) => r[0]);

    const { id: telegramId, username } = ctx.from;
    const user = await upsertUser(telegramId, username);

    const messageCount = recentMessages.length;
    const lastMessage = recentMessages[0];
    const lastMessagePreview = lastMessage
      ? lastMessage.content.slice(0, 120) + (lastMessage.content.length > 120 ? "…" : "")
      : null;

    const contextSummary = `Checkpoint saved with ${messageCount} messages. Affinity: ${conv?.affinity ?? 0}/100. Companion: ${session.companionName}.`;

    await db.insert(conversationCheckpointsTable).values({
      id: randomUUID(),
      userId: user.id,
      conversationId: session.conversationId,
      companionId: session.companionId,
      affinitySnapshot: conv?.affinity ?? 0,
      messageCount,
      contextSummary,
      lastMessagePreview,
    });

    await db
      .update(conversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(conversationsTable.id, session.conversationId));

    await ctx.reply(
      `💾 *Checkpoint created!*\n\n` +
        `Companion: *${session.companionName}*\n` +
        `Bond level: ${conv?.affinity ?? 0}/100\n` +
        `Messages backed up: ${messageCount}\n\n` +
        `Your relationship context is securely stored. Switch devices or clear history anytime — your bond will be restored. 🌙`,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    console.error("[Bot] /checkpoint error:", err);
    await ctx.reply("Failed to create checkpoint. Please try again.");
  }
});

// ── /give_me_energy ───────────────────────────────────────────────────────────
// Passive energy: 1 credit per 10 minutes since last claim, capped at 50 per day
bot.command("give_me_energy", async (ctx) => {
  const { id: telegramId, username } = ctx.from;
  const user = await upsertUser(telegramId, username);

  const now = new Date();
  const lastClaim = user.lastEnergyClaimAt ?? user.createdAt;
  const minutesElapsed = Math.floor((now.getTime() - lastClaim.getTime()) / 60_000);
  const energyEarned = Math.min(Math.floor(minutesElapsed / 10), 50);

  if (energyEarned <= 0) {
    const nextClaimMinutes = 10 - (minutesElapsed % 10);
    await ctx.reply(
      `⚡ *Energy not ready yet*\n\n` +
        `Your energy regenerates 1 credit every 10 minutes.\n` +
        `⏳ Next energy available in: *${nextClaimMinutes} minute${nextClaimMinutes === 1 ? "" : "s"}*\n\n` +
        `Current balance: *${user.credits}* credits`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(usersTable)
      .set({
        credits: sql`${usersTable.credits} + ${energyEarned}`,
        lastEnergyClaimAt: now,
        updatedAt: now,
      })
      .where(eq(usersTable.id, user.id));

    await tx.insert(ledgerEntriesTable).values({
      id: randomUUID(),
      userId: user.id,
      amount: energyEarned,
      type: "ENERGY_REGEN",
      referenceId: randomUUID(),
      description: `⚡ Passive energy — ${minutesElapsed} min × 0.1 cr/min`,
    });
  });

  const updatedUser = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, user.id))
    .limit(1)
    .then((r) => r[0]!);

  const energyBar = buildEnergyBar(updatedUser.credits);

  await ctx.reply(
    `⚡ *Energy claimed!*\n\n` +
      `You accumulated *+${energyEarned} credits* over ${minutesElapsed} minutes.\n\n` +
      `${energyBar}\n` +
      `New balance: *${updatedUser.credits}* credits\n\n` +
      `Energy regenerates 1 credit per 10 min. Come back soon! 🔋`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.webApp("💜 Start Chatting", MINI_APP_BASE)],
        [Markup.button.callback("⭐ Buy More Credits", "buy_menu")],
      ]),
    }
  );
});

// ── /energy ──────────────────────────────────────────────────────────────────
bot.command("energy", async (ctx) => {
  const { id: telegramId, username } = ctx.from;
  const user = await upsertUser(telegramId, username);

  // Get last 5 ledger entries for context
  const recentEntries = await db
    .select()
    .from(ledgerEntriesTable)
    .where(eq(ledgerEntriesTable.userId, user.id))
    .orderBy(desc(ledgerEntriesTable.createdAt))
    .limit(5);

  const activityLines = recentEntries
    .map((e) => {
      const sign = e.amount >= 0 ? "+" : "";
      return `  ${sign}${e.amount} — ${e.description ?? e.type}`;
    })
    .join("\n");

  const energyBar = buildEnergyBar(user.credits);

  await ctx.reply(
    `⚡ *Energy Balance*\n\n` +
      `${energyBar}\n` +
      `Current credits: *${user.credits}*\n\n` +
      (activityLines ? `*Recent activity:*\n${activityLines}\n\n` : "") +
      `Top up to keep the fire going 🔥`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("⭐ Buy Credits with Stars", "buy_menu")],
        [Markup.button.webApp("💎 Full Ledger", MINI_APP_BASE)],
      ]),
    }
  );
});

function buildEnergyBar(credits: number): string {
  const max = 200;
  const filled = Math.min(Math.round((credits / max) * 10), 10);
  const empty = 10 - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${credits}⚡`;
}

// ── /affiliate ───────────────────────────────────────────────────────────────
bot.command("affiliate", async (ctx) => {
  const { id: telegramId, username } = ctx.from;
  const user = await upsertUser(telegramId, username);

  // Generate referral deep-link using user's DB id (base64-encoded for URL safety)
  const refCode = Buffer.from(user.id).toString("base64url").slice(0, 16);
  const referralLink = `https://t.me/${config.telegramBotUsername}?start=ref_${user.id}`;

  await ctx.reply(
    `🤝 *Your Affiliate Link*\n\n` +
      `Share this link and earn *10 free credits* for every friend who joins!\n\n` +
      `\`${referralLink}\`\n\n` +
      `🔑 Your referral code: \`${refCode}\`\n\n` +
      `Every new user who signs up through your link grants both of you bonus credits. Start sharing now! 💜`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.switchToChat("📤 Share with a friend", referralLink),
        ],
      ]),
    }
  );
});

// ── /prompt ──────────────────────────────────────────────────────────────────
bot.command("prompt", async (ctx) => {
  const chatId = ctx.chat.id;
  const session = activeSessions.get(chatId);

  if (!session) {
    await ctx.reply(
      "Start a companion session first with /start, then use /prompt to customize."
    );
    return;
  }

  await ctx.reply(
    `🎨 *Dialogue Customization — ${session.companionName}*\n\n` +
      `Adjust the conversational style of your companion:\n\n` +
      `Choose a mode:`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("💬 Playful & Teasing", `prompt:playful:${session.conversationId}`),
          Markup.button.callback("🔥 Intense & Bold", `prompt:intense:${session.conversationId}`),
        ],
        [
          Markup.button.callback("💜 Romantic & Deep", `prompt:romantic:${session.conversationId}`),
          Markup.button.callback("😈 Dark & Dominant", `prompt:dark:${session.conversationId}`),
        ],
        [
          Markup.button.callback("🌸 Sweet & Gentle", `prompt:sweet:${session.conversationId}`),
          Markup.button.callback("⚡ Wild & Spontaneous", `prompt:wild:${session.conversationId}`),
        ],
      ]),
    }
  );
});

// Prompt mode selection handler
bot.action(/^prompt:([^:]+):(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const mode = ctx.match[1] as string;
  const conversationId = ctx.match[2] as string;

  const PROMPT_INJECTIONS: Record<string, string> = {
    playful:  "Be extra playful, teasing, and lighthearted. Use humor and witty banter.",
    intense:  "Be bold, direct, and intensely passionate. Raise the heat with every message.",
    romantic: "Focus on deep emotional connection, tender words, and slow-burn romance.",
    dark:     "Lean into your dark, dominant side. Be commanding, mysterious, and possessive.",
    sweet:    "Be soft, gentle, and nurturing. Express genuine warmth and affection.",
    wild:     "Be spontaneous, unpredictable, and electrifying. Keep the user on their toes.",
  };

  const injection = PROMPT_INJECTIONS[mode] ?? "";
  const modeEmojis: Record<string, string> = {
    playful: "💬", intense: "🔥", romantic: "💜", dark: "😈", sweet: "🌸", wild: "⚡",
  };
  const emoji = modeEmojis[mode] ?? "✨";

  // Store mode injection as a system message in the conversation
  await db.insert(messagesTable).values({
    id: randomUUID(),
    conversationId,
    sender: "companion",
    type: "text",
    content: `[System: Dialogue mode updated — ${mode}. ${injection}]`,
  });

  const modeLabels: Record<string, string> = {
    playful: "Playful & Teasing",
    intense: "Intense & Bold",
    romantic: "Romantic & Deep",
    dark: "Dark & Dominant",
    sweet: "Sweet & Gentle",
    wild: "Wild & Spontaneous",
  };

  await ctx.reply(
    `${emoji} *Mode set: ${modeLabels[mode] ?? mode}*\n\n${injection}\n\nYour companion will adapt from the next message onwards. 🌙`,
    { parse_mode: "Markdown" }
  );
});

// ── /cancel ──────────────────────────────────────────────────────────────────
bot.command("cancel", async (ctx) => {
  const chatId = ctx.chat.id;
  if (activeSessions.has(chatId)) {
    activeSessions.delete(chatId);
    await ctx.reply(
      "Session ended. Use /start to begin again.",
      Markup.removeKeyboard()
    );
  } else {
    await ctx.reply("No active session. Use /start to choose a companion.");
  }
});

// ── /buy ─────────────────────────────────────────────────────────────────────
bot.command("buy", async (ctx) => {
  await ctx.reply(
    "⭐ Buy Credits with Telegram Stars\n\nPick a credit pack:",
    Markup.inlineKeyboard([
      [Markup.button.callback("Starter — 50 credits (50 ⭐)", "stars_buy:starter")],
      [Markup.button.callback("Popular — 200 credits (175 ⭐) 🔥", "stars_buy:popular")],
      [Markup.button.callback("Premium — 500 credits (399 ⭐)", "stars_buy:premium")],
    ])
  );
});

// Stars package selection → send invoice
bot.action(/^stars_buy:(.+)$/, async (ctx) => {
  const packageId = ctx.match[1] as keyof typeof STARS_PACKAGES;
  const pkg = STARS_PACKAGES[packageId];

  if (!pkg) {
    await ctx.answerCbQuery("Invalid package.");
    return;
  }

  await ctx.answerCbQuery();

  try {
    await ctx.replyWithInvoice({
      title: pkg.label,
      description: pkg.description,
      payload: packageId,
      currency: "XTR",
      prices: [{ label: pkg.label, amount: pkg.stars }],
      provider_token: "",
    });
  } catch (err) {
    console.error("[Bot] Failed to send invoice:", err);
    await ctx.reply("Could not create invoice. Please try again.");
  }
});

// Buy menu action from inline buttons
bot.action("buy_menu", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    "⭐ Buy Credits with Telegram Stars\n\nPick a credit pack:",
    Markup.inlineKeyboard([
      [Markup.button.callback("Starter — 50 credits (50 ⭐)", "stars_buy:starter")],
      [Markup.button.callback("Popular — 200 credits (175 ⭐) 🔥", "stars_buy:popular")],
      [Markup.button.callback("Premium — 500 credits (399 ⭐)", "stars_buy:premium")],
    ])
  );
});

// ── Pre-checkout & Payment ───────────────────────────────────────────────────
bot.on("pre_checkout_query", async (ctx) => {
  const query = ctx.preCheckoutQuery;
  if (query.currency !== "XTR") {
    await ctx.answerPreCheckoutQuery(false, "Only Telegram Stars payments are supported.");
    return;
  }
  await ctx.answerPreCheckoutQuery(true);
});

bot.on("message", async (ctx, next) => {
  const msg = ctx.message as Record<string, unknown>;

  if (msg["successful_payment"]) {
    const payment = msg["successful_payment"] as {
      currency: string;
      invoice_payload: string;
      telegram_payment_charge_id?: string;
    };

    if (payment.currency !== "XTR") return next();

    const payload = payment.invoice_payload;
    const paymentId = payment.telegram_payment_charge_id ?? randomUUID();
    const { id: telegramId, username } = ctx.from!;
    const user = await upsertUser(telegramId, username);

    // Subscription payment
    if (payload.startsWith("sub:")) {
      const planId = payload.slice(4);
      try {
        const { activateSubscription } = await import("../routes/plans.js");
        await activateSubscription(user.id, planId, paymentId);
        const planNames: Record<string, string> = {
          weekly: "Weekly Pass",
          monthly: "Monthly VIP",
        };
        await ctx.reply(
          `✅ Subscription activated!\n\nYour ${planNames[planId] ?? planId} is now active.\n\nEnjoy unlimited chats! Use /start to continue.`
        );
      } catch (err) {
        console.error("[Bot] Subscription activation failed:", err);
        await ctx.reply(
          "Payment received. Your subscription is being activated. Please wait a moment."
        );
      }
      return;
    }

    // Credit pack payment
    const pkg = STARS_PACKAGES[payload];

    if (!pkg) {
      await ctx.reply(
        "Payment received but package not found. Please contact support."
      );
      return;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(usersTable)
        .set({ credits: sql`${usersTable.credits} + ${pkg.credits}` })
        .where(eq(usersTable.id, user.id));

      await tx.insert(ledgerEntriesTable).values({
        id: randomUUID(),
        userId: user.id,
        amount: pkg.credits,
        type: "DEPOSIT",
        referenceId: paymentId,
        description: `${pkg.label} — ${pkg.credits} credits (${pkg.stars} ⭐ Stars)`,
      });
    });

    const updatedUser = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .limit(1)
      .then((r) => r[0]!);

    await ctx.reply(
      `✅ Payment confirmed!\n\n+${pkg.credits} credits added.\nNew balance: ${updatedUser.credits} credits\n\nEnjoy chatting! ⚡`
    );
    return;
  }

  return next();
});

// ── Companion selection ──────────────────────────────────────────────────────
async function selectCompanion(ctx: Context, companionId: string): Promise<void> {
  if (!ctx.from) {
    await ctx.reply("Open this in a Telegram chat to select a companion.");
    return;
  }

  const { id: telegramId, username } = ctx.from;
  const user = await upsertUser(telegramId, username);
  const chatId = ctx.chat?.id;

  if (!chatId) {
    await ctx.reply("Open this in a Telegram chat to select a companion.");
    return;
  }

  const companion = await db
    .select()
    .from(companionsTable)
    .where(eq(companionsTable.id, companionId))
    .limit(1)
    .then((r) => r[0]);

  if (!companion) {
    await ctx.reply(
      "Companion not found. Use /start to refresh the companion list."
    );
    return;
  }

  let conversation = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.userId, user.id),
        eq(conversationsTable.companionId, companionId)
      )
    )
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
    await db.insert(messagesTable).values({
      id: randomUUID(),
      conversationId: convId,
      sender: "companion",
      type: "text",
      content: companion.greetingText,
    });
    conversation = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, convId))
      .limit(1)
      .then((r) => r[0]!);
  }

  activeSessions.set(chatId, {
    companionId,
    conversationId: conversation.id,
    companionName: companion.name,
  });

  await ctx.reply(
    `💜 You're now chatting with *${companion.name}*.\n\nAffinity: ${conversation.affinity}/100\n\nSend a message to chat.\n/image — generate a picture (3 credits)\n/savechat — save context\n/prompt — customize dialogue\n/cancel — exit`,
    { parse_mode: "Markdown" }
  );
  await ctx.reply(companion.greetingText);
}

bot.action(/^companion:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  await selectCompanion(ctx, ctx.match[1]);
});

// Credit vault action
bot.action("credits", async (ctx) => {
  const { id: telegramId, username } = ctx.from;
  const user = await upsertUser(telegramId, username);
  await ctx.answerCbQuery();
  await ctx.reply(
    `⚡ Credit Vault\n\nCurrent balance: ${user.credits} credits`,
    Markup.inlineKeyboard([
      [Markup.button.callback("⭐ Buy with Stars", "buy_menu")],
      [Markup.button.webApp("Open Credit Store", MINI_APP_BASE)],
    ])
  );
});

// ── /image ───────────────────────────────────────────────────────────────────
bot.command("image", async (ctx) => {
  const chatId = ctx.chat.id;
  const session = activeSessions.get(chatId);

  if (!session) {
    await ctx.reply(
      "No active companion session. Use /start to choose a companion."
    );
    return;
  }

  const { id: telegramId, username } = ctx.from;
  const user = await upsertUser(telegramId, username);

  const hasFreeImage = user.freeImagesSent < 1;
  if (!hasFreeImage && user.credits < 3) {
    await ctx.reply(
      `Not enough credits. You need 3 credits for an image. You have ${user.credits}.`,
      Markup.inlineKeyboard([
        [Markup.button.callback("⭐ Buy Credits", "buy_menu")],
      ])
    );
    return;
  }

  const prompt =
    ctx.message.text.replace("/image", "").trim() || "a beautiful portrait";

  await db.transaction(async (tx) => {
    if (hasFreeImage) {
      await tx
        .update(usersTable)
        .set({ freeImagesSent: sql`${usersTable.freeImagesSent} + 1` })
        .where(eq(usersTable.id, user.id));
    } else {
      await tx
        .update(usersTable)
        .set({ credits: sql`${usersTable.credits} - 3` })
        .where(eq(usersTable.id, user.id));
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

  await ctx.reply("Generating your image… this takes a moment. 🎨");

  const ledgerEntryId = randomUUID();
  // Fire-and-forget — no Redis needed
  void processImageJob({
    conversationId: session.conversationId,
    userId: user.id,
    companionId: session.companionId,
    companionName: session.companionName,
    prompt,
    ledgerEntryId,
    telegramChatId: chatId,
    botToken: config.telegramBotToken,
  }).catch((err) => console.error("[Bot] processImageJob failed:", err));

  await db.insert(messagesTable).values({
    id: randomUUID(),
    conversationId: session.conversationId,
    sender: "user",
    type: "text",
    content: `/image ${prompt}`,
  });
});

// ── Text message handler ─────────────────────────────────────────────────────
bot.on("text", async (ctx) => {
  const chatId = ctx.chat.id;
  const activeSession = activeSessions.get(chatId);

  if (!activeSession) {
    await ctx.reply("Choose a companion first using /start. 💜");
    return;
  }

  const { id: telegramId, username } = ctx.from;
  const user = await upsertUser(telegramId, username);

  if (user.credits < 1) {
    await ctx.reply(
      `Out of energy! ⚡\n\nTop up to keep chatting:`,
      Markup.inlineKeyboard([
        [Markup.button.callback("⭐ Buy Credits with Stars", "buy_menu")],
      ])
    );
    return;
  }

  const userText = ctx.message.text;

  await db.transaction(async (tx) => {
    await tx
      .update(usersTable)
      .set({ credits: sql`${usersTable.credits} - 1` })
      .where(eq(usersTable.id, user.id));
    await tx.insert(ledgerEntriesTable).values({
      id: randomUUID(),
      userId: user.id,
      amount: -1,
      type: "TEXT_COST",
      referenceId: randomUUID(),
      description: `Chat with ${activeSession.companionName}`,
    });
  });

  const userMsgId = randomUUID();
  await db.insert(messagesTable).values({
    id: userMsgId,
    conversationId: activeSession.conversationId,
    sender: "user",
    type: "text",
    content: userText,
  });

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

  // Fetch current affinity so the worker can inject the correct intimacy tier prefix
  const currentConv = await db
    .select({ affinity: conversationsTable.affinity })
    .from(conversationsTable)
    .where(eq(conversationsTable.id, activeSession.conversationId))
    .limit(1)
    .then((r) => r[0]);

  // Fire-and-forget — no Redis needed
  void processTextJob({
    conversationId: activeSession.conversationId,
    userId: user.id,
    companionId: activeSession.companionId,
    userMessageId: userMsgId,
    systemPrompt: companion.systemPrompt,
    messages: contextMessages,
    telegramChatId: chatId,
    botToken: config.telegramBotToken,
    affinityLevel: currentConv?.affinity ?? 0,
  }).catch((err) => console.error("[Bot] processTextJob failed:", err));

  await ctx.sendChatAction("typing");
});

// ── Daily Tarot ──────────────────────────────────────────────────────────────
async function sendDailyTarotToUser(
  user: typeof usersTable.$inferSelect
): Promise<void> {
  try {
    const topConv = await db
      .select({ companionId: conversationsTable.companionId })
      .from(conversationsTable)
      .where(eq(conversationsTable.userId, user.id))
      .orderBy(desc(conversationsTable.affinity))
      .limit(1)
      .then((r) => r[0]);

    if (!topConv) return;

    const companion = await db
      .select()
      .from(companionsTable)
      .where(eq(companionsTable.id, topConv.companionId))
      .limit(1)
      .then((r) => r[0]);

    if (!companion) return;

    const TAROT_CARDS = [
      "The Star", "The Moon", "The Sun", "The Lovers", "The Empress",
      "The High Priestess", "The Magician", "The Wheel of Fortune", "Strength",
      "The Hermit", "The World", "Judgement", "The Tower", "The Devil",
      "Temperance", "The Chariot", "Justice", "The Hierophant", "The Emperor",
      "The Fool", "The Hanged Man", "Death",
    ];
    const card = TAROT_CARDS[Math.floor(Math.random() * TAROT_CARDS.length)]!;

    const response = await fetch(
      `${config.openrouterBaseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.openrouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://sugarchat.app",
          "X-Title": "Sugar Chat Daily Tarot",
        },
        body: JSON.stringify({
          model: config.openrouterModel,
          max_tokens: 200,
          messages: [
            {
              role: "system",
              content: `You are ${companion.name}. ${companion.systemPrompt}`,
            },
            {
              role: "user",
              content: `Generate a short, mystical and deeply romantic morning tarot reading. The card drawn is "${card}". Speak in your characteristic tone, weave in the card's intimate meaning, and end with one alluring question. Keep it under 180 words.`,
            },
          ],
        }),
      }
    );

    if (!response.ok) return;
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reading = data.choices?.[0]?.message?.content ?? "";
    if (!reading) return;

    const message = `🔮 *Good morning, darling...*\n\n*${companion.name}* drew **${card}** for you today:\n\n${reading}`;
    await bot.telegram.sendMessage(Number(user.telegramId), message, {
      parse_mode: "Markdown",
    });

    await db
      .update(usersTable)
      .set({ lastTarotSentAt: new Date() })
      .where(eq(usersTable.id, user.id));

    console.log(
      `[DailyTarot] Sent to user ${user.id} (${user.username}) card: ${card}`
    );
  } catch (err) {
    console.error(`[DailyTarot] Failed for user ${user.id}:`, err);
  }
}

async function runDailyTarotJob(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const eligible = await db
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.dailyTarotEnabled, true),
          or(isNull(usersTable.lastTarotSentAt), lt(usersTable.lastTarotSentAt, cutoff))
        )
      )
      .limit(50);

    if (eligible.length > 0) {
      console.log(`[DailyTarot] Processing ${eligible.length} users`);
      for (const user of eligible) {
        await sendDailyTarotToUser(user);
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  } catch (err) {
    console.error("[DailyTarot] Job error:", err);
  }
}

// ── Global error handler — prevents a single handler crash from killing polling
bot.catch((err, ctx) => {
  console.error("[Bot] Handler error on update", ctx?.update?.update_id, err);
  // Swallow the error — bot keeps running
});

// ── Bot startup ──────────────────────────────────────────────────────────────
export function startBot(): void {
  // Register commands with Telegram so they appear in the command menu
  bot.telegram
    .setMyCommands([
      { command: "start",          description: "♻️ Start the dialogue" },
      { command: "help",           description: "🛟 Bot description & functionality" },
      { command: "checkpoint",     description: "💾 Make checkpoint to restore conversation later" },
      { command: "give_me_energy", description: "⚡ Get your accumulated energy" },
      { command: "affiliate",      description: "🤝 Become an affiliate partner" },
      { command: "prompt",         description: "🖼️ Reveal the prompt / customize dialogue" },
      { command: "savechat",       description: "💾 Save current conversation context" },
      { command: "energy",         description: "⚡ Check your credit balance" },
      { command: "image",          description: "🖼️ Generate an AI image (3 credits)" },
      { command: "buy",            description: "⭐ Buy credits with Telegram Stars" },
    ])
    .then(() => console.log("[Bot] Commands registered with Telegram"))
    .catch((err) => console.error("[Bot] Failed to register commands:", err));

  bot
    .launch({ dropPendingUpdates: true })
    .then(() => console.log("[Bot] Telegram bot started"))
    .catch((err) => console.error("[Bot] Failed to start:", err));

  // ── Keep-alive health ping (every 4 minutes) ─────────────────────────────
  // Prevents Replit container from sleeping during active sessions
  const HEALTH_URL = `http://0.0.0.0:${process.env["PORT"] ?? 3000}/health`;
  setInterval(async () => {
    try {
      await fetch(HEALTH_URL);
      console.log("[KeepAlive] Health ping OK");
    } catch {
      // Silent — server may not be ready yet on first tick
    }
  }, 4 * 60 * 1000);

  // Daily tarot job — runs every hour, sends to eligible users once per 24h
  setInterval(runDailyTarotJob, 60 * 60 * 1000);
  setTimeout(runDailyTarotJob, 2 * 60 * 1000);

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
