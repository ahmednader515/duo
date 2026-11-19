import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/products/product-form";
import { storageConfigured } from "@/lib/services/storage/r2";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { workspaceId } = await requireWorkspace(true);
  const { id } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findFirst({
      where: { id, workspaceId },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.category.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!product) notFound();
  return (
    <ProductForm
      categories={categories}
      storage={storageConfigured}
      product={{
        ...product,
        price: product.price.toString(),
        compareAtPrice: product.compareAtPrice?.toString() || null,
        weight: product.weight?.toString() || null,
        dimensions: product.dimensions as {
          length?: number;
          width?: number;
          height?: number;
        } | null,
      }}
    />
  );
}
