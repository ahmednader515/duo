import { requireWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";
import { Studio } from "@/components/ai/studio";
import { aiConfigured } from "@/lib/services/ai";
import { storageConfigured } from "@/lib/services/storage/r2";
import { generationView } from "@/lib/services/ai/history";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; kind?: string }>;
}) {
  const { workspaceId, role } = await requireWorkspace();
  const [products, history] = await Promise.all([
    prisma.product.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        images: {
          select: { id: true, url: true },
          orderBy: { sortOrder: "asc" },
        },
      },
      take: 200,
      orderBy: { name: "asc" },
    }),
    prisma.aIContentGeneration.findMany({
      where: { workspaceId },
      take: 20,
      orderBy: { createdAt: "desc" },
      include: { product: { select: { name: true } } },
    }),
  ]);
  return (
    <Studio
      products={products}
      history={history.map((h) => generationView(h, h.product?.name || ""))}
      configured={aiConfigured}
      storage={storageConfigured}
      canWrite={role !== "MEMBER"}
      initialProduct={(await searchParams).product}
      initialKind={(await searchParams).kind}
    />
  );
}
