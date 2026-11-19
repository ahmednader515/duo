import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { prisma, databaseConfigured } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { assertSameOrigin, apiError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!databaseConfigured || !process.env.AUTH_SECRET)
      throw new Error(
        "Authentication is not configured. Set up the database and AUTH_SECRET.",
      );
    const result = registerSchema.safeParse(await request.json());
    if (!result.success)
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    const { name, email, password, workspace } = result.data;
    await rateLimit(`register:${email}`, 3);
    const passwordHash = await hash(password, 12);
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, passwordHash },
      });
      const business = await tx.workspace.create({
        data: {
          name: workspace,
          slug: `store-${randomUUID()}`,
          ownerId: user.id,
          members: { create: { userId: user.id, role: "OWNER" } },
        },
      });
      await tx.activityLog.create({
        data: {
          workspaceId: business.id,
          userId: user.id,
          action: "WORKSPACE_CREATED",
        },
      });
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
