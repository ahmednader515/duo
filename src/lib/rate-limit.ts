import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
// Atomic PostgreSQL upsert works across application instances. Fail closed on DB errors.
export async function rateLimit(identity: string, limit = 10, minutes = 15) {
  const key = createHash("sha256").update(identity).digest("hex");
  const now = new Date();
  const resetAt = new Date(now.getTime() + minutes * 60000);
  const rows = await prisma.$queryRaw<
    { count: number }[]
  >`INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${key}, 1, ${resetAt}) ON CONFLICT ("key") DO UPDATE SET "count" = CASE WHEN "RateLimit"."resetAt" < ${now} THEN 1 ELSE "RateLimit"."count" + 1 END, "resetAt" = CASE WHEN "RateLimit"."resetAt" < ${now} THEN ${resetAt} ELSE "RateLimit"."resetAt" END RETURNING "count"`;
  if (rows[0].count > limit)
    throw new Error("Too many attempts. Please try again in 15 minutes.");
}
