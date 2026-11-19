import { test } from "node:test";
import assert from "node:assert/strict";
import { productSchema, registerSchema } from "../src/lib/validations/index";
const product = {
  name: "Travel bag",
  description: "Leather bag",
  sku: "",
  barcode: "",
  categoryId: "",
  price: "159.99",
  compareAtPrice: "",
  currency: "SAR",
  stock: "5",
  weight: "",
  length: "0",
  width: "0",
  height: "0",
  status: "DRAFT",
};
test("product validation preserves exact decimal money and nullable identifiers", () => {
  const parsed = productSchema.parse(product);
  assert.equal(parsed.price, "159.99");
  assert.equal(parsed.stock, 5);
  assert.equal(parsed.categoryId, null);
  assert.equal(parsed.sku, null);
});
test("product rejects negative stock and monetary rounding ambiguities", () => {
  for (const patch of [
    { stock: "-1" },
    { stock: "1.5" },
    { price: "1.999" },
    { price: "Infinity" },
    { price: "-5" },
    { compareAtPrice: "100.00" },
    { weight: "-2" },
    { currency: "XXX" },
    { status: "PUBLISHED" },
  ])
    assert.equal(
      productSchema.safeParse({ ...product, ...patch }).success,
      false,
    );
});
test("registration normalizes email and requires strong length", () => {
  const input = {
    name: "Ahmed",
    workspace: "My store",
    email: "AHMED@example.com",
    password: "long-password-123",
  };
  assert.equal(registerSchema.parse(input).email, "ahmed@example.com");
  assert.equal(
    registerSchema.safeParse({ ...input, password: "short" }).success,
    false,
  );
  assert.equal(
    registerSchema.safeParse({ ...input, password: "x".repeat(73) }).success,
    false,
  );
  assert.equal(
    registerSchema.safeParse({ ...input, password: "ع".repeat(40) }).success,
    false,
  );
  assert.equal(
    registerSchema.parse({ ...input, email: "  AHMED@example.com  " }).email,
    "ahmed@example.com",
  );
});
