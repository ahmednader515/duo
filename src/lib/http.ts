import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { databaseErrorInfo } from "@/lib/database-error";
import { RequestBodyError } from "@/lib/request-body";
export class UploadTooLargeError extends Error {}
export async function readUploadForm(request: Request) {
  const max = 6 * 1024 * 1024;
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Upload body required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new UploadTooLargeError("Maximum upload size is 5 MB");
    }
    chunks.push(chunk.value);
  }
  return new Response(Buffer.concat(chunks), {
    headers: { "Content-Type": request.headers.get("Content-Type") || "" },
  }).formData();
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new Error("Invalid request origin");
}
export function apiError(error: unknown) {
  if (error instanceof RequestBodyError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  const databaseError = databaseErrorInfo(error);
  if (databaseError.missingSchema || databaseError.unavailable) {
    console.error("Duo database request failed:", {
      code: databaseError.code,
      databaseCode: databaseError.databaseCode,
    });
    return NextResponse.json(
      {
        error: databaseError.missingSchema
          ? "The database schema is not initialized or is out of date. Apply the Duo schema to the configured database before creating an account."
          : "The database is temporarily unavailable. Please try again shortly.",
      },
      { status: 503 },
    );
  }
  if (error instanceof UploadTooLargeError)
    return NextResponse.json({ error: error.message }, { status: 413 });
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
    return NextResponse.json(
      { error: "This email or SKU is already in use." },
      { status: 409 },
    );
  const message = error instanceof Error ? error.message : "Request failed";
  if (/Only workspace|not authorized|Invalid request origin/.test(message))
    return NextResponse.json({ error: message }, { status: 403 });
  if (/Too many/.test(message))
    return NextResponse.json({ error: message }, { status: 429 });
  if (/not configured/.test(message))
    return NextResponse.json({ error: message }, { status: 503 });
  console.error("Duo request failed:", {
    name: error instanceof Error ? error.name : "Unknown error",
    code: databaseError.code,
    databaseCode: databaseError.databaseCode,
  });
  return NextResponse.json(
    { error: "We couldn't complete this request. Please try again." },
    { status: 500 },
  );
}
