import { db, companionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { DEFAULT_COMPANIONS } from "./companion-catalog.js";

export async function seedCompanions(): Promise<void> {
  for (const companion of DEFAULT_COMPANIONS) {
    const values = {
      name: companion.name,
      avatarUrl: companion.avatarUrl,
      systemPrompt: companion.systemPrompt,
      personality: companion.personality,
      greetingText: companion.greetingText,
      creditCostText: companion.creditCostText,
      creditCostImg: companion.creditCostImg,
      tags: companion.tags,
      preferredTags: companion.preferredTags.join(","),
    };

    const existing = await db
      .select()
      .from(companionsTable)
      .where(eq(companionsTable.id, companion.id))
      .limit(1)
      .then((rows) => rows[0]);

    if (existing) {
      await db.update(companionsTable).set(values).where(eq(companionsTable.id, companion.id));
      console.log(`[Seed] Updated companion: ${companion.name} (${companion.id})`);
      continue;
    }

    await db.insert(companionsTable).values({ id: companion.id, ...values });
    console.log(`[Seed] Created companion: ${companion.name} (${companion.id})`);
  }
}
