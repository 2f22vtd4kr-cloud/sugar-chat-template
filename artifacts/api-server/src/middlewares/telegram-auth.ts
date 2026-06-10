import { Request, Response, NextFunction } from "express";
import { validateTelegramInitData, parseInitDataDev, type TelegramUser } from "../lib/telegram-auth.js";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { config } from "../lib/config.js";

declare global {
  namespace Express {
    interface Request {
      telegramUser?: TelegramUser;
      dbUserId?: string;
    }
  }
}

export async function requireTelegramAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const initData = req.headers["x-telegram-init-data"] as string | undefined;

  let telegramUser: TelegramUser | undefined;

  if (config.nodeEnv === "development") {
    // In dev mode: use mock user for any request (real or missing initData)
    telegramUser = { id: 1234567890, username: "dev_user", first_name: "Dev" };
  } else {
    if (!initData) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      const parsed = validateTelegramInitData(initData);
      if (!parsed?.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      telegramUser = parsed.user;
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  if (!telegramUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Upsert user in DB
  const telegramIdBigInt = BigInt(telegramUser.id);
  let user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, telegramIdBigInt))
    .limit(1)
    .then((rows) => rows[0]);

  if (!user) {
    const newId = randomUUID();
    await db.insert(usersTable).values({
      id: newId,
      telegramId: telegramIdBigInt,
      username: telegramUser.username ?? null,
      credits: 10,
      freeImagesSent: 0,
    });
    user = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, newId))
      .limit(1)
      .then((rows) => rows[0]);
  }

  req.telegramUser = telegramUser;
  req.dbUserId = user!.id;
  next();
}
