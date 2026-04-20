import type { OrgRole } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      memberships: { orgId: string; role: OrgRole }[];
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    memberships: { orgId: string; role: OrgRole }[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    memberships?: { orgId: string; role: OrgRole }[];
  }
}
