"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/workspace";
import {
  profileSchema,
  workspaceSchema,
  passwordSchema,
} from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
export async function switchWorkspace(id: string) {
  const { userId } = await requireWorkspace();
  if (
    !(await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: id, userId } },
    }))
  )
    throw new Error("Workspace not authorized");
  (await cookies()).set("duo-workspace", id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  revalidatePath("/dashboard", "layout");
}
export async function updateSettings(
  kind: "profile" | "workspace" | "password",
  form: FormData,
) {
  const context = await requireWorkspace(kind === "workspace");
  try {
    if (kind === "profile") {
      const data = profileSchema.parse(Object.fromEntries(form));
      await prisma.user.update({ where: { id: context.userId }, data });
      (await cookies()).set("duo-language", data.language, {
        sameSite: "lax",
        path: "/",
        maxAge: 31536000,
      });
    } else if (kind === "workspace") {
      const data = workspaceSchema.parse(Object.fromEntries(form));
      await prisma.workspace.update({
        where: { id: context.workspaceId },
        data,
      });
    } else {
      await rateLimit(`password:${context.userId}`, 5);
      const data = z
        .object({
          currentPassword: z.string().max(72),
          password: passwordSchema,
        })
        .parse(Object.fromEntries(form));
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: context.userId },
      });
      if (
        !user.passwordHash ||
        !(await compare(data.currentPassword, user.passwordHash))
      )
        return { error: "Current password is incorrect." };
      await prisma.user.update({
        where: { id: context.userId },
        data: {
          passwordHash: await hash(data.password, 12),
          sessionVersion: { increment: 1 },
        },
      });
    }
    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof z.ZodError
          ? error.issues[0].message
          : "Could not update settings. Please try again.",
    };
  }
}
