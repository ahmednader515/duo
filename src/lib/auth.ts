import "server-only";
import { getServerSession, type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { compare } from "bcryptjs";
import { prisma, databaseConfigured } from "@/lib/prisma";
import { credentialsSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
if (process.env.AUTH_URL) process.env.NEXTAUTH_URL = process.env.AUTH_URL;
// NextAuth v4 is the stable Auth.js release. Credentials require JWT sessions.
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(input) {
        if (!databaseConfigured || !process.env.AUTH_SECRET) return null;
        const parsed = credentialsSchema.safeParse(input);
        if (!parsed.success) return null;
        await rateLimit(`login:${parsed.data.email}`);
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        // A valid dummy hash keeps unknown-user password checks comparable in cost.
        const valid = await compare(
          parsed.data.password,
          user?.passwordHash ??
            "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYQkeKAZHJm2hIBFqgQ1H3OT7r18Dtye",
        );
        if (!user || !valid || !user.passwordHash) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.sessionVersion = user.sessionVersion;
      }
      return token;
    },
    async session({ session, token }) {
      if (!token.sub || !databaseConfigured)
        return {
          ...session,
          user: { id: "" },
          expires: new Date(0).toISOString(),
        };
      const user = await prisma.user.findUnique({
        where: { id: token.sub },
        select: { sessionVersion: true, name: true, email: true, avatar: true },
      });
      if (!user || user.sessionVersion !== token.sessionVersion)
        return {
          ...session,
          user: { id: "" },
          expires: new Date(0).toISOString(),
        };
      session.user = {
        id: token.sub,
        name: user.name,
        email: user.email,
        image: user.avatar,
      };
      return session;
    },
  },
};
export async function auth() {
  if (!databaseConfigured || !process.env.AUTH_SECRET) return null;
  const session = await getServerSession(authOptions);
  return session?.user.id ? session : null;
}
