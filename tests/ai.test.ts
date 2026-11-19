import { test } from "node:test";
import assert from "node:assert/strict";
import { readBoundedJson, RequestBodyError } from "../src/lib/request-body";
import {
  generationSchema,
  applyGenerationSchema,
} from "../src/lib/validations/ai";
import {
  estimateTextCost,
  estimateImageCost,
  parseTextResponse,
  providerFailure,
} from "../src/lib/services/ai/protocol";
const request = {
  requestId: crypto.randomUUID(),
  productId: "owned-product",
  kind: "DESCRIPTION",
  language: "ar",
  tone: "professional",
  prompt: "A travel bag",
  keywords: "travel",
};
test("AI JSON endpoints bound UTF-8 bodies even without Content-Length", async () => {
  const make = (body: string, type = "application/json") =>
    new Request("http://localhost/test", {
      method: "POST",
      headers: { "Content-Type": type },
      body,
    });
  assert.deepEqual(await readBoundedJson(make('{"text":"عربي"}'), 64), {
    text: "عربي",
  });
  await assert.rejects(
    readBoundedJson(make('{"text":"عربي"}'), 10),
    (error) => error instanceof RequestBodyError && error.status === 413,
  );
  await assert.rejects(
    readBoundedJson(make("not-json"), 64),
    (error) => error instanceof RequestBodyError && error.status === 400,
  );
  await assert.rejects(
    readBoundedJson(make("{}", "text/plain"), 64),
    (error) => error instanceof RequestBodyError && error.status === 415,
  );
});
test("AI requests validate bounded input and require a source image for edits", () => {
  assert.equal(generationSchema.safeParse(request).success, true);
  for (const patch of [
    { kind: "UNKNOWN" },
    { productId: "" },
    { language: "xx" },
    { tone: "unknown" },
    { prompt: "x".repeat(3001) },
    { kind: "IMAGE_EDIT" },
    { requestId: "invalid" },
  ])
    assert.equal(
      generationSchema.safeParse({ ...request, ...patch }).success,
      false,
    );
  assert.equal(
    generationSchema.safeParse({
      ...request,
      kind: "IMAGE_EDIT",
      imageId: "owned-image",
    }).success,
    true,
  );
  assert.equal(
    generationSchema.safeParse({
      ...request,
      kind: "IMAGE_GENERATION",
      prompt: "",
    }).success,
    false,
  );
  assert.equal(
    applyGenerationSchema.safeParse({
      generationId: "id",
      content: "x".repeat(20001),
    }).success,
    false,
  );
});
test("exhausted credits are distinguished from transient rate limits without exposing provider details", () => {
  for (const error of [
    { code: "credit_balance_exhausted", type: "insufficient_quota" },
    { code: "insufficient_quota" },
    { type: "insufficient_quota" },
    { code: "billing_hard_limit_reached" },
  ])
    assert.equal(providerFailure(429, { error }).code, "billing");
  assert.equal(
    providerFailure(429, { error: { code: "rate_limit_exceeded" } }).code,
    "rate_limit",
  );
  assert.equal(
    providerFailure(401, { error: { message: "secret-key" } }).message.includes(
      "secret-key",
    ),
    false,
  );
  assert.equal(providerFailure(403, {}).code, "model_access");
});
test("usage estimates respect text cache discounts and image token rates", () => {
  assert.equal(estimateTextCost(1000, 100, 200), "0.001310");
  assert.equal(estimateTextCost(1000, 100, 2000), "0.000550");
  assert.equal(estimateImageCost(100, 200, 1000), "0.032100");
});
test("structured output is extracted after reasoning items and incomplete responses are rejected", () => {
  const output = {
    model: "actual-model",
    status: "completed",
    output: [
      { type: "reasoning" },
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({ content: "A real parsed description" }),
          },
        ],
      },
    ],
    usage: {
      input_tokens: 100,
      output_tokens: 20,
      input_tokens_details: { cached_tokens: 0 },
    },
  };
  assert.equal(parseTextResponse(output).content, "A real parsed description");
  assert.equal(parseTextResponse(output).model, "actual-model");
  assert.throws(() => parseTextResponse({ ...output, status: "incomplete" }));
  assert.throws(() =>
    parseTextResponse({
      ...output,
      output: [{ type: "message", content: [{ type: "refusal" }] }],
    }),
  );
  assert.throws(() =>
    parseTextResponse({
      ...output,
      usage: { input_tokens: -1, output_tokens: 20 },
    }),
  );
});
