import { Request, Response, NextFunction } from "express";
import { validateTelegramInitData, type TelegramUser } from "../lib/telegram-auth.js";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { config } from "../lib/config.js";

declare global {
  namespace Express {
    interface Request {
      telegramUser?: TelegramUser;
      dbUserId?: string;
      telegramPremium?: boolean;
    }
  }
}

function extractTelegramUserFields(initData: string): { isPremium: boolean; firstName?: string; languageCode?: string } {
  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get("user");
    if (!userStr) return { isPremium: false };
    const tgUser = JSON.parse(decodeURIComponent(userStr));
    return {
      isPremium: tgUser.is_premium === true,
      firstName: tgUser.first_name ?? undefined,
      languageCode: tgUser.language_code ?? undefined,
    };
  } catch {
    return { isPremium: false };
  }
}

// Stable preview user ID for browser/sandbox access (no Telegram context)
const PREVIEW_TELEGRAM_ID = 9_999_999_999;

export async function requireTelegramAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const initData = req.headers["x-telegram-init-data"] as string | undefined;

  let telegramUser: TelegramUser | undefined;
  let isPremium = false;
  let firstName: string | undefined;
  let languageCode: string | undefined;

  if (config.nodeEnv === "development") {
    // Development: always use dev user
    telegramUser = { id: 1234567890, username: "dev_user", first_name: "Dev" };
  } else if (!initData || initData.trim() === "") {
    // Production with no initData: use a preview guest user
    // This allows the app to be previewed in a browser without Telegram
    console.warn("[Auth] No initData — serving preview guest user");
    telegramUser = { id: PREVIEW_TELEGRAM_ID, username: "preview_user", first_name: "Preview" };
  } else {
    // Production with initData: validate against Telegram HMAC
    try {
      const parsed = validateTelegramInitData(initData);
      if (!parsed?.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      telegramUser = parsed.user;
      const extra = extractTelegramUserFields(initData);
      isPremium = extra.isPremium;
      firstName = extra.firstName;
      languageCode = extra.languageCode;
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  if (!telegramUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const telegramIdBigInt = BigInt(telegramUser.id);
  let user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, telegramIdBigInt))
    .limit(1)
    .then((rows) => rows[0]);

  if (!user) {
    const newId = randomUUID();
    const defaultLang = languageCode?.startsWith("ru") ? "ru"
      : languageCode?.startsWith("uk") ? "uk"
      : languageCode?.startsWith("de") ? "de"
      : languageCode?.startsWith("it") ? "it"
      : languageCode?.startsWith("es") ? "es"
      : "en";
    await db.insert(usersTable).values({
      id: newId,
      telegramId: telegramIdBigInt,
      username: telegramUser.username ?? null,
      firstName: firstName ?? telegramUser.first_name ?? null,
      credits: 10,
      freeImagesSent: 0,
      isTelegramPremium: isPremium,
      language: defaultLang,
    });
    user = await db.select().from(usersTable).where(eq(usersTable.id, newId)).limit(1).then((rows) => rows[0]);
  } else if (isPremium !== user.isTelegramPremium) {
    await db.update(usersTable).set({ isTelegramPremium: isPremium, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
  }

  req.telegramUser = telegramUser;
  req.dbUserId = user!.id;
  req.telegramPremium = isPremium;
  next();
}
