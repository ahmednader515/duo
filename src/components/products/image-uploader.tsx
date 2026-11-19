"use client";
import { useState } from "react";
import Image from "next/image";
import { UploadCloud, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useLanguage } from "@/components/providers";
export type ImageItem = { id: string; url: string };
export async function sendImage(file: File, productId?: string, kind?: string) {
  const form = new FormData();
  form.set("file", file);
  if (productId) form.set("productId", productId);
  if (kind) form.set("kind", kind);
  const response = await fetch("/api/uploads", { method: "POST", body: form });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}
export function ImageUploader({
  productId,
  images,
  configured,
  disabled = false,
}: {
  productId: string;
  images: ImageItem[];
  configured: boolean;
  disabled?: boolean;
}) {
  const ar = useLanguage() === "ar";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    setBusy(true);
    try {
      for (const file of files) await sendImage(file, productId);
      toast.success(ar ? "تم رفع الصور" : "Images uploaded");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      input.value = "";
    }
  }
  async function remove() {
    setBusy(true);
    try {
      const response = await fetch("/api/uploads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleting }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setDeleting(null);
      toast.success(ar ? "تم حذف الصورة" : "Image deleted");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <label className="upload-zone">
        <UploadCloud size={27} />
        <span>
          {busy
            ? ar
              ? "جارٍ الرفع…"
              : "Uploading…"
            : ar
              ? "أضف صور منتجك"
              : "Add your product images"}
        </span>
        <small>JPEG, PNG, WebP · 5 MB / image</small>
        <input
          disabled={!configured || busy || disabled}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={upload}
        />
      </label>
      {!configured && (
        <p className="form-help">
          {ar
            ? "رفع الصور غير متاح حتى إعداد Cloudflare R2."
            : "Image uploads are unavailable until Cloudflare R2 is configured."}
        </p>
      )}
      <div className="image-grid">
        {images.map((image) => (
          <div className="image-tile" key={image.id}>
            <Image
              src={image.url}
              alt={ar ? "صورة المنتج" : "Product image"}
              fill
              unoptimized
              sizes="(max-width: 760px) 40vw, 200px"
            />
            {!disabled && (
              <button
                type="button"
                aria-label="Delete image"
                onClick={() => setDeleting(image.id)}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      {deleting && (
        <ConfirmDialog
          title={ar ? "حذف الصورة؟" : "Delete image?"}
          description={
            ar
              ? "سيتم حذف الصورة من التخزين بشكل دائم."
              : "This image will be permanently removed from storage."
          }
          busy={busy}
          onConfirm={remove}
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
