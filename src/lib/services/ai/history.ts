import "server-only";
import { imageResultSchema, isImageGeneration } from "@/lib/validations/ai";
import type { GenerationView } from "./types";
export function generationView(
  record: {
    id: string;
    productId: string | null;
    generationType: string;
    result: string;
    createdAt: Date;
    model: string;
    tokenUsage: number;
    estimatedCost: { toString(): string };
  },
  productName: string,
): GenerationView {
  let imageUrl: string | null = null;
  if (isImageGeneration(record.generationType)) {
    try {
      const parsed = imageResultSchema.safeParse(JSON.parse(record.result));
      if (parsed.success) imageUrl = parsed.data.url;
    } catch {
      /* Legacy invalid records are shown without an image. */
    }
  }
  return {
    id: record.id,
    productId: record.productId,
    productName,
    kind: record.generationType,
    content: imageUrl ? "" : record.result,
    imageUrl,
    createdAt: record.createdAt.toISOString(),
    model: record.model,
    tokenUsage: record.tokenUsage,
    estimatedCost: record.estimatedCost.toString(),
  };
}
