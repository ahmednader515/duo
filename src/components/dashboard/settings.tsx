"use client";
import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { updateSettings } from "@/actions/settings";
import { sendImage } from "@/components/products/image-uploader";
import { Card } from "@/components/ui";
import { useLanguage } from "@/components/providers";
import { translate } from "@/lib/i18n";
function SettingsForm({
  kind,
  children,
  disabled = false,
}: {
  kind: "profile" | "workspace" | "password";
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const ar = useLanguage() === "ar";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setBusy(true);
        try {
          const result = await updateSettings(kind, form);
          if (result.error) throw new Error(result.error);
          toast.success(ar ? "تم حفظ التغييرات" : "Changes saved");
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Save failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      <button
        type="submit"
        className="btn btn-primary"
        disabled={busy || disabled}
      >
        {busy
          ? ar
            ? "جارٍ الحفظ…"
            : "Saving…"
          : ar
            ? "حفظ التغييرات"
            : "Save changes"}
      </button>
    </form>
  );
}
export function SettingsView({
  name,
  email,
  workspaceName,
  logo,
  storage,
  canWrite,
  preference,
}: {
  name: string;
  email: string;
  workspaceName: string;
  logo: string | null;
  storage: boolean;
  canWrite: boolean;
  preference: string;
}) {
  const ar = useLanguage() === "ar";
  const t = translate(ar ? "ar" : "en");
  const [uploading, setUploading] = useState(false);
  const router = useRouter();
  return (
    <div className="settings-grid">
      <Card>
        <h2>{t.profile}</h2>
        <SettingsForm kind="profile">
          <label>
            {ar ? "الاسم" : "Full name"}
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              defaultValue={name}
            />
          </label>
          <label>
            {ar ? "البريد الإلكتروني" : "Email"}
            <input disabled value={email} dir="ltr" />
          </label>
          <label>
            {t.language}
            <select name="language" defaultValue={preference}>
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </label>
        </SettingsForm>
      </Card>
      <Card>
        <h2>{t.business}</h2>
        <SettingsForm kind="workspace" disabled={!canWrite}>
          <label>
            {ar ? "اسم مساحة العمل" : "Workspace name"}
            <input
              name="name"
              defaultValue={workspaceName}
              required
              minLength={2}
              maxLength={100}
              disabled={!canWrite}
            />
          </label>
        </SettingsForm>
        <div style={{ marginTop: 24 }}>
          {logo && (
            <div
              className="product-thumb"
              style={{ width: 65, height: 65, marginBottom: 15 }}
            >
              <Image
                fill
                unoptimized
                src={logo}
                alt="Workspace logo"
                sizes="65px"
              />
            </div>
          )}
          <label>
            {ar ? "شعار المتجر" : "Workspace logo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={!storage || !canWrite || uploading}
              onChange={async (event) => {
                const input = event.currentTarget;
                const file = input.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  await sendImage(file, undefined, "logo");
                  toast.success(ar ? "تم تحديث الشعار" : "Logo updated");
                  router.refresh();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Upload failed");
                } finally {
                  setUploading(false);
                  input.value = "";
                }
              }}
            />
          </label>
          <p className="form-help">
            {!storage
              ? ar
                ? "أضف إعدادات R2 لتفعيل رفع الشعار."
                : "Configure R2 to enable logo uploads."
              : "JPEG, PNG, WebP · 5 MB"}
          </p>
          {!canWrite && (
            <p className="form-help">
              {ar
                ? "المالك أو المسؤول فقط يمكنه تعديل مساحة العمل."
                : "Only owners and admins can update workspace settings."}
            </p>
          )}
        </div>
      </Card>
      <Card>
        <h2>{t.account}</h2>
        <SettingsForm kind="password">
          <label>
            {ar ? "كلمة المرور الحالية" : "Current password"}
            <input
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              required
              maxLength={72}
            />
          </label>
          <label>
            {ar ? "كلمة المرور الجديدة" : "New password"}
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={72}
            />
            <small>
              {ar ? "12 حرفاً على الأقل." : "At least 12 characters."}
            </small>
          </label>
        </SettingsForm>
      </Card>
      <Card>
        <h2>{ar ? "مساحة تخص تجارتك" : "A workspace for your business"}</h2>
        <p className="muted">
          {ar
            ? "مساحة العمل تفصل منتجاتك وصورك ونشاط فريقك عن أي متجر آخر. يمكنك التنقل بين مساحات العمل المصرّح لك بالوصول إليها من القائمة الجانبية."
            : "Your workspace keeps products, images, and team activity separate from other businesses. Switch between workspaces you belong to using the sidebar."}
        </p>
        <p className="form-help">
          {ar
            ? "إدارة الأعضاء والدعوات ضمن التحديثات القادمة."
            : "Member management and invitations are planned for a future release."}
        </p>
      </Card>
    </div>
  );
}
