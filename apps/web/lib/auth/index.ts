import type { OrgRole } from "@prisma/client";
import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db/prisma";

const roleRank: OrgRole[] = ["MEMBER", "ADMIN", "OWNER"];

export function hasMinRole(role: OrgRole, min: OrgRole): boolean {
  return roleRank.indexOf(role) >= roleRank.indexOf(min);
}

export function assertOrgInToken(
  memberships: { orgId: string; role: OrgRole }[] | undefined,
  orgId: string
): { orgId: string; role: OrgRole } {
  const m = memberships?.find((x) => x.orgId === orgId);
  if (!m) throw new Error("Forbidden: org not in session");
  return m;
}

export function assertRole(
  memberships: { orgId: string; role: OrgRole }[] | undefined,
  orgId: string,
  min: OrgRole
): void {
  const m = assertOrgInToken(memberships, orgId);
  if (!hasMinRole(m.role, min)) throw new Error("Forbidden: insufficient role");
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  // On Vercel/preview domains, trust forwarded host headers to avoid
  // "Server configuration" auth errors when NEXTAUTH_URL is not exact.
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            memberships: { include: { org: true } },
          },
        });
        if (!user?.passwordHash) return null;
        const ok = await compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          memberships: user.memberships.map((m) => ({
            orgId: m.orgId,
            role: m.role,
          })),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
        token.memberships = user.memberships;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.email = (token.email as string) ?? "";
        session.user.name = token.name as string | null | undefined;
        session.user.memberships = (token.memberships as { orgId: string; role: OrgRole }[]) ?? [];
      }
      return session;
    },
  },
  // Support both legacy NEXTAUTH_SECRET and AUTH_SECRET naming.
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
};
