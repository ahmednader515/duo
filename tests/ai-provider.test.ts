import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { GenerationRequest } from "../src/lib/services/ai/types";

// Uses Node's react-server condition so server-only modules can be tested without Next.
test(
  "OpenAI adapter sends real API contracts and handles structured text, image edits, and billing errors",
  { skip: !process.execArgv.includes("--conditions=react-server") },
  async () => {
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key-for-mocked-transport";
    const { aiService, AIProviderError } =
      await import("../src/lib/services/ai/index");
    const input: GenerationRequest = {
      workspaceId: "test-workspace",
      productId: "test-product",
      product: {
        name: "Ceramic mug",
        description: "White, one handle",
        category: null,
        price: "29.99",
        currency: "SAR",
        sku: null,
      },
      language: "ar",
      tone: "professional",
      prompt: "Describe only known facts",
      keywords: [],
    };
    let reply: unknown = {
      status: "completed",
      model: "gpt-6.1-terra",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                content: "Validated output from test transport",
              }),
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
    const calls: { url: string; body: unknown }[] = [];
    let status = 200;
    const fetchMock = mock.method(
      globalThis,
      "fetch",
      async (url: string | URL | Request, init?: RequestInit) => {
        assert.equal(
          new Headers(init?.headers).get("Authorization"),
          "Bearer test-key-for-mocked-transport",
        );
        calls.push({
          url: String(url),
          body:
            typeof init?.body === "string" ? JSON.parse(init.body) : init?.body,
        });
        return Response.json(reply, { status });
      },
    );
    try {
      for (const generate of [
        aiService.generateTitle,
        aiService.generateDescription,
        aiService.generateSEO,
      ]) {
        const result = await generate(input);
        assert.equal(result.content, "Validated output from test transport");
        assert.equal(result.inputTokens, 100);
      }
      const body = calls[0].body as Record<string, unknown>;
      assert.equal(body.store, false);
      assert.deepEqual(body.reasoning, { effort: "none" });
      assert.equal(
        (body.text as { format: { type: string } }).format.type,
        "json_schema",
      );
      reply = {
        data: [{ b64_json: "dGVzdC1vbmx5" }],
        usage: {
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
          input_tokens_details: { text_tokens: 80, image_tokens: 20 },
        },
      };
      assert.equal(
        (await aiService.generateImage(input)).imageBase64,
        "dGVzdC1vbmx5",
      );
      await aiService.editImage({
        ...input,
        image: new File([new Uint8Array([1, 2, 3])], "source.webp", {
          type: "image/webp",
        }),
      });
      assert.ok(calls[4].url.endsWith("images/edits"));
      assert.ok(calls[4].body instanceof FormData);
      assert.ok((calls[4].body as FormData).get("image[]") instanceof File);
      status = 429;
      reply = {
        error: {
          code: "credit_balance_exhausted",
          type: "insufficient_quota",
          message: "private provider details",
        },
      };
      await assert.rejects(
        aiService.generateTitle(input),
        (error) =>
          error instanceof AIProviderError &&
          error.code === "billing" &&
          !error.message.includes("private provider"),
      );
      status = 200;
      reply = { status: "incomplete" };
      await assert.rejects(
        aiService.generateTitle(input),
        (error) =>
          error instanceof AIProviderError && error.code === "invalid_output",
      );
    } finally {
      fetchMock.mock.restore();
      if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = originalKey;
    }
  },
);
