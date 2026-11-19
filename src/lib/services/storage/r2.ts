import "server-only";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
export const storageConfigured = Boolean(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET_NAME &&
  process.env.R2_PUBLIC_URL,
);
function client() {
  if (!storageConfigured) throw new Error("Image storage is not configured.");
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}
export function detectImage(
  bytes: Uint8Array,
): { mime: string; extension: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { mime: "image/jpeg", extension: "jpg" };
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    return { mime: "image/png", extension: "png" };
  if (
    Buffer.from(bytes.slice(0, 4)).toString() === "RIFF" &&
    Buffer.from(bytes.slice(8, 12)).toString() === "WEBP"
  )
    return { mime: "image/webp", extension: "webp" };
  return null;
}
export async function uploadImage(
  file: File,
  workspaceId: string,
  scope: string,
) {
  if (!file.size || file.size > 5 * 1024 * 1024)
    throw new Error("Images must be between 1 byte and 5 MB.");
  const body = Buffer.from(await file.arrayBuffer());
  const format = detectImage(body);
  if (!format || format.mime !== file.type)
    throw new Error("Upload a valid JPEG, PNG, or WebP image.");
  const key = `workspaces/${workspaceId}/${scope}/${randomUUID()}.${format.extension}`;
  await client().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: format.mime,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return {
    key,
    url: `${process.env.R2_PUBLIC_URL!.replace(/\/$/, "")}/${key}`,
  };
}
export async function deleteImage(key: string, workspaceId: string) {
  if (!key.startsWith(`workspaces/${workspaceId}/`) || key.includes(".."))
    throw new Error("Image not authorized");
  await client().send(
    new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }),
  );
}
export async function readImage(
  key: string,
  workspaceId: string,
): Promise<File> {
  if (!key.startsWith(`workspaces/${workspaceId}/`) || key.includes(".."))
    throw new Error("Image not authorized");
  const object = await client().send(
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }),
  );
  if (!object.Body || (object.ContentLength ?? 0) > 5 * 1024 * 1024)
    throw new Error("Image cannot be read or exceeds 5 MB.");
  const bytes = await object.Body.transformToByteArray();
  const format = detectImage(bytes);
  if (!format || bytes.byteLength > 5 * 1024 * 1024)
    throw new Error("Image format is not supported.");
  return new File([new Uint8Array(bytes)], `product.${format.extension}`, {
    type: format.mime,
  });
}
