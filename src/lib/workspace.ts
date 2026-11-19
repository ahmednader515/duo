import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export async function requireWorkspace(write = false) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: session.user.id },
    include: { workspace: true },
    orderBy: { id: "asc" },
  });
  const selected = (await cookies()).get("duo-workspace")?.value;
  const member =
    memberships.find((m) => m.workspaceId === selected) ?? memberships[0];
  if (!member)
    throw new Error("No workspace membership. Contact your workspace owner.");
  if (write && member.role === "MEMBER")
    throw new Error("Only workspace owners and admins can make changes.");
  return {
    userId: session.user.id,
    workspaceId: member.workspaceId,
    workspace: member.workspace,
    role: member.role,
    memberships,
  };
}
