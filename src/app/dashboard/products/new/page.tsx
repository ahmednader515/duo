import { requireWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/products/product-form";
import { storageConfigured } from "@/lib/services/storage/r2";
export default async function Page() {
  const { workspaceId } = await requireWorkspace(true);
  const categories = await prisma.category.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
  return <ProductForm categories={categories} storage={storageConfigured} />;
}
