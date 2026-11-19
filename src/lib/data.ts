import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
export async function overviewData(workspaceId: string) {
  const [total, active, draft, recent, activity, usage] =
    await Promise.all([
      prisma.product.count({ where: { workspaceId } }),
      prisma.product.count({ where: { workspaceId, status: "ACTIVE" } }),
      prisma.product.count({ where: { workspaceId, status: "DRAFT" } }),
      prisma.product.findMany({
        where: { workspaceId },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { images: { take: 1, orderBy: { sortOrder: "asc" } } },
      }),
      prisma.activityLog.findMany({
        where: { workspaceId },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
      prisma.aIContentGeneration.aggregate({
        where: { workspaceId },
        _count: true,
        _sum: { tokenUsage: true, estimatedCost: true },
      }),
    ]);
  return { total, active, draft, recent, activity, usage };
}
export type OverviewData = Awaited<ReturnType<typeof overviewData>>;
export const sortOptions = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  name: { name: "asc" },
  price_asc: { price: "asc" },
  price_desc: { price: "desc" },
} satisfies Record<string, Prisma.ProductOrderByWithRelationInput>;
