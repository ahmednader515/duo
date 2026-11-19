"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { removeProduct } from "@/actions/products";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useLanguage } from "@/components/providers";
export function DeleteProduct({ id, name }: { id: string; name: string }) {
  const ar = useLanguage() === "ar";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function remove() {
    setBusy(true);
    try {
      const result = await removeProduct(id);
      if (result.error) throw new Error(result.error);
      toast.success(ar ? "تم حذف المنتج" : "Product deleted");
      setOpen(false);
      router.push("/dashboard/products");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="icon-button"
        aria-label={`${ar ? "حذف" : "Delete"} ${name}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 size={15} />
      </button>
      {open && (
        <ConfirmDialog
          busy={busy}
          title={ar ? "حذف المنتج؟" : "Delete this product?"}
          description={
            ar
              ? `سيتم حذف «${name}» وصوره من مساحة عملك. لا يمكن التراجع عن هذه الخطوة.`
              : `“${name}” and its images will be permanently removed from this workspace.`
          }
          onClose={() => {
            if (!busy) setOpen(false);
          }}
          onConfirm={remove}
        />
      )}
    </>
  );
}
