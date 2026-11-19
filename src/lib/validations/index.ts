import { z } from "zod";
export const passwordSchema = z
  .string()
  .min(12)
  .max(72)
  .refine(
    (v) => new TextEncoder().encode(v).length <= 72,
    "Password must be at most 72 UTF-8 bytes",
  );
export const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email().max(254))
    .transform((v) => v.toLowerCase()),
  password: passwordSchema,
});
export const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(100),
  workspace: z.string().trim().min(2).max(100),
});
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);
const money = z
  .string()
  .regex(
    /^\d{1,12}(\.\d{1,2})?$/,
    "Enter a valid amount with up to two decimal places",
  );
export const productSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    description: z.string().trim().max(20000),
    sku: optionalText(100),
    barcode: optionalText(100),
    categoryId: optionalText(100),
    price: money,
    compareAtPrice: z.union([money, z.literal("")]).transform((v) => v || null),
    currency: z.enum(["SAR", "USD", "AED", "EUR"]),
    stock: z.coerce.number().int().min(0).max(2147483647),
    weight: z
      .union([z.string().regex(/^\d{1,9}(\.\d{1,3})?$/), z.literal("")])
      .transform((v) => v || null),
    length: z.coerce.number().min(0).max(100000),
    width: z.coerce.number().min(0).max(100000),
    height: z.coerce.number().min(0).max(100000),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  })
  .refine(
    (v) => !v.compareAtPrice || Number(v.compareAtPrice) >= Number(v.price),
    {
      path: ["compareAtPrice"],
      message: "Compare-at price must be at least the price",
    },
  );
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  language: z.enum(["ar", "en"]),
});
export const workspaceSchema = z.object({
  name: z.string().trim().min(2).max(100),
});
