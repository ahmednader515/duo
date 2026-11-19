import { requireWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";
import { storageConfigured } from "@/lib/services/storage/r2";
import { SettingsView } from "@/components/dashboard/settings";
export default async function Page() {
  const { userId, workspace, role } = await requireWorkspace();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, email: true, language: true },
  });
  return (
    <SettingsView
      name={user.name || ""}
      email={user.email}
      preference={user.language}
      workspaceName={workspace.name}
      logo={workspace.logo}
      storage={storageConfigured}
      canWrite={role !== "MEMBER"}
    />
  );
}
