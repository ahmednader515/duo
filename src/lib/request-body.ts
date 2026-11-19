export class RequestBodyError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
export async function readBoundedJson(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new RequestBodyError("Send a JSON request.", 415);
  if (Number(request.headers.get("content-length") || 0) > maxBytes)
    throw new RequestBodyError("Request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestBodyError("Request body is required.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new RequestBodyError("Request is too large.", 413);
    }
    chunks.push(chunk.value);
  }
  try {
    return JSON.parse(
      new TextDecoder().decode(Buffer.concat(chunks)),
    ) as unknown;
  } catch {
    throw new RequestBodyError("Invalid JSON request.", 400);
  }
}
