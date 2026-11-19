import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { postgresConnectionString } from "@/lib/database-url";
const globalDb = globalThis as unknown as {
  prisma?: PrismaClient;
  databaseConnection?: string;
};
const connectionString = postgresConnectionString(
  process.env.DATABASE_URL ||
    "postgresql://unconfigured:unconfigured@localhost:5432/duo",
);
export const databaseConfigured = Boolean(process.env.DATABASE_URL);
export const prisma =
  (globalDb.databaseConnection === connectionString
    ? globalDb.prisma
    : undefined) ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: 5,
    }),
  });
if (process.env.NODE_ENV !== "production") {
  // Recreate pools after connection/TLS configuration changes during Fast Refresh.
  if (globalDb.prisma && globalDb.prisma !== prisma)
    void globalDb.prisma.$disconnect().catch(() => {});
  globalDb.prisma = prisma;
  globalDb.databaseConnection = connectionString;
}
