/**
 * Browser-safe description of what each role sees. Documentation + navigation
 * reference only: no gate here grants anything. Server gates live in
 * rbac.server.ts and are the only thing that actually enforces access.
 */

export type RoleKey = "authority" | "coordinator" | "agent" | "sales_team_admin" | "guest";

export type RoleSurface = {
  /** Bengali label shown to people. */
  label: string;
  /** Routes this role is meant to reach from the navigation. */
  routes: string[];
  /** Extra powers beyond ordinary desk work. */
  powers: string[];
};

export const ROLE_SURFACES: Record<RoleKey, RoleSurface> = {
  authority: {
    label: "কর্তৃপক্ষ (HQ / আইটি)",
    routes: ["/", "/hq", "/reports", "/system"],
    powers: [
      "পুরো ফ্লোরের ডেটা দেখা",
      "লিড বিতরণ ও পুনঃবিতরণ",
      "কোটা ও সিস্টেম সেটিং",
      "অ্যাকাউন্ট অনুমোদন",
      "সার্ভিস বিল যাচাই ও পেআউট",
    ],
  },
  coordinator: {
    label: "কোঅর্ডিনেটর",
    routes: ["/", "/desk", "/dispatch", "/reports"],
    powers: ["পুরো ফ্লোরের ডেটা দেখা", "লিড বিতরণ", "সাপোর্ট ইনবক্স"],
  },
  agent: {
    label: "এজেন্ট",
    routes: ["/", "/desk", "/coach", "/reports"],
    powers: ["নিজের লিড ও কল", "নিজের রিপোর্ট", "নিজের সাপোর্ট অনুরোধ"],
  },
  sales_team_admin: {
    label: "সেল টিম অ্যাডমিন",
    routes: ["/", "/desk", "/coach", "/reports"],
    powers: [
      "এজেন্টের সব কাজ (দৈনিক কোটা ১৫)",
      "টিম সাপোর্ট ইনবক্স — পড়া, উত্তর, গুরুত্ব বদল",
    ],
  },
  guest: {
    label: "সাইন-ইন করা হয়নি",
    routes: ["/", "/docs", "/help"],
    powers: [],
  },
};

/** Roles that may open the shared team-support inbox. */
export const INBOX_ROLES: RoleKey[] = ["authority", "coordinator", "sales_team_admin"];

/** Roles that may dispatch leads. Support-inbox access never implies this. */
export const DISPATCH_ROLES: RoleKey[] = ["authority", "coordinator"];
