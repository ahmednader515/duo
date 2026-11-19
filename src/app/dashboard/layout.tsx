import { requireWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard/shell";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, workspaceId, memberships } = await requireWorkspace();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, email: true },
  });
  return (
    <DashboardShell
      workspaceId={workspaceId}
      memberships={memberships}
      name={user.name || "User"}
      email={user.email}
    >
      {children}
    </DashboardShell>
  );
}
