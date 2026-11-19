import { z } from "zod";

export const generationSchema = z
  .object({
    requestId: z.uuid(),
    productId: z.string().min(1).max(100),
    kind: z.enum([
      "TITLE",
      "DESCRIPTION",
      "SEO",
      "IMAGE_GENERATION",
      "IMAGE_EDIT",
    ]),
    language: z.enum(["ar", "en"]),
    tone: z.enum(["professional", "friendly", "persuasive"]),
    prompt: z.string().trim().max(3000).default(""),
    keywords: z.string().trim().max(500).default(""),
    imageId: z.string().max(100).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      (value.kind === "IMAGE_GENERATION" || value.kind === "IMAGE_EDIT") &&
      !value.prompt
    )
      ctx.addIssue({
        code: "custom",
        path: ["prompt"],
        message: "Describe the image you want to create.",
      });
    if (value.kind === "IMAGE_EDIT" && !value.imageId)
      ctx.addIssue({
        code: "custom",
        path: ["imageId"],
        message: "Select an existing product image to edit.",
      });
  });
export const applyGenerationSchema = z.object({
  generationId: z.string().min(1).max(100),
  content: z.string().trim().max(20000).optional(),
});
export const imageResultSchema = z.object({
  url: z.url(),
  storageKey: z.string().min(1),
});
export const isImageGeneration = (kind: string) =>
  kind === "IMAGE_GENERATION" || kind === "IMAGE_EDIT";
export type GenerationInput = z.infer<typeof generationSchema>;
