import { db, companionsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { DEFAULT_COMPANIONS } from "./companion-catalog.js";

export async function seedCompanions(): Promise<void> {
  for (const companion of DEFAULT_COMPANIONS) {
    const namesToMatch = [companion.name, ...(companion.legacyNames ?? [])];

    const existing = await db
      .select()
      .from(companionsTable)
      .where(inArray(companionsTable.name, namesToMatch))
      .limit(1)
      .then((rows) => rows[0]);

    const values = {
      name: companion.name,
      avatarUrl: companion.avatarUrl,
      systemPrompt: companion.systemPrompt,
      personality: companion.personality,
      greetingText: companion.greetingText,
      creditCostText: companion.creditCostText,
      creditCostImg: companion.creditCostImg,
      tags: companion.tags,
    };

    if (existing) {
      await db.update(companionsTable).set(values).where(eq(companionsTable.id, existing.id));
      console.log(`[Seed] Updated companion: ${existing.name} → ${companion.name}`);
      continue;
    }

    await db.insert(companionsTable).values({ id: companion.id, ...values });
    console.log(`[Seed] Created companion: ${companion.name}`);
  }
}
