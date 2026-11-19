import { z } from "zod";
export const TEXT_MODEL = "gpt-6.1-terra";
export const IMAGE_MODEL = "gpt-image-2.6-flare";
export function providerFailure(status: number, value: unknown) {
  const body =
    value && typeof value === "object" && "error" in value ? value.error : null;
  const error =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const code = typeof error.code === "string" ? error.code : "unknown";
  const type = typeof error.type === "string" ? error.type : "unknown";
  if (
    type === "insufficient_quota" ||
    [
      "insufficient_quota",
      "credit_balance_exhausted",
      "billing_hard_limit_reached",
      "billing_not_active",
    ].includes(code)
  )
    return {
      code: "billing",
      message:
        "Your OpenAI project has no available credits. Add API credits or update the project billing limit.",
      status: 429,
    };
  if (status === 401)
    return {
      code: "invalid_key",
      message:
        "The OpenAI API key is invalid or expired. Update the server configuration.",
      status: 503,
    };
  if (status === 403 || code === "model_not_found")
    return {
      code: "model_access",
      message:
        "This OpenAI project cannot access the selected model. Check model access and organization verification.",
      status: 503,
    };
  if (status === 429)
    return {
      code: "rate_limit",
      message:
        "OpenAI is receiving too many requests. Please try again shortly.",
      status: 429,
    };
  if (
    [
      "content_policy_violation",
      "moderation_blocked",
      "image_generation_user_error",
    ].includes(code)
  )
    return {
      code: "content_policy",
      message:
        "OpenAI could not fulfill this request. Please revise the prompt.",
      status: 400,
    };
  return {
    code: "provider_error",
    message: "OpenAI could not complete this generation. Please try again.",
    status: 502,
  };
}
const tokens = z.number().int().nonnegative();
export const textResponseSchema = z.object({
  model: z.string(),
  status: z.string(),
  output: z.array(
    z.object({
      type: z.string(),
      content: z
        .array(z.object({ type: z.string(), text: z.string().optional() }))
        .optional(),
    }),
  ),
  usage: z.object({
    input_tokens: tokens,
    output_tokens: tokens,
    input_tokens_details: z
      .object({ cached_tokens: tokens.optional() })
      .optional(),
  }),
});
export const imageResponseSchema = z.object({
  data: z
    .array(
      z.object({
        b64_json: z
          .string()
          .min(1)
          .max(8 * 1024 * 1024),
      }),
    )
    .min(1)
    .max(1),
  usage: z.object({
    input_tokens: tokens,
    output_tokens: tokens,
    total_tokens: tokens,
    input_tokens_details: z.object({
      text_tokens: tokens,
      image_tokens: tokens,
    }),
  }),
});
// USD estimates from published standard token rates, checked 2026-11-18.
// Estimates are not invoices; image inputs are conservatively treated as uncached.
export function estimateTextCost(input: number, output: number, cached = 0) {
  const cache = Math.min(input, Math.max(cached, 0));
  return ((input - cache + cache * 0.05 + output * 5) / 1_000_000).toFixed(6);
}
export function estimateImageCost(
  textInput: number,
  imageInput: number,
  output: number,
) {
  return ((textInput * 5 + imageInput * 8 + output * 30) / 1_000_000).toFixed(
    6,
  );
}
export function parseTextResponse(value: unknown) {
  const response = textResponseSchema.parse(value);
  if (response.status !== "completed") throw new Error("Generation incomplete");
  const text = response.output
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text || "")
    .join("");
  const result = z
    .object({ content: z.string().trim().min(1).max(20000) })
    .parse(JSON.parse(text));
  return {
    content: result.content,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    estimatedCost: estimateTextCost(
      response.usage.input_tokens,
      response.usage.output_tokens,
      response.usage.input_tokens_details?.cached_tokens,
    ),
  };
}
