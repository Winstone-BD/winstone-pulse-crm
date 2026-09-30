/**
 * SINGLE ENTRY POINT FOR ROLE RULES (server side).
 *
 * The rules themselves still live in their original modules — this file changes
 * no behaviour. It exists so that anyone asking "who is allowed to do what?"
 * has one file to read instead of four, and so new code imports the gates from
 * one place.
 *
 * Where the rules actually live:
 *   - access.server.ts               → who the caller is (scope) + write gates
 *   - team-support-access.server.ts  → team support inbox (Sales Team Admin)
 *   - support-access.server.ts       → customer support desk staff
 *   - admin-gate.server.ts           → master / IT PIN tokens
 *   - lead-quota.ts                  → per-person daily quota + fair scoring
 *
 * Permission matrix (authoritative summary, see ROLE_SURFACES for the UI side):
 *
 *   scope         leads read   dispatch   quota edit   IT console   support inbox
 *   authority     whole floor  yes        yes          yes          yes
 *   coordinator   own only     no         no           no           yes
 *   agent         own only     no         no           no           own tickets
 *   sales_team_admin (agent + inbox owner)             no           yes
 *   none          nothing      no         no           no           no
 *
 * Two invariants that must never be relaxed:
 *   1. Being a support-inbox owner NEVER grants dispatch, quota, approval or IT
 *      powers — those key off `caller.scope` only.
 *   2. A read-only session (Executive HQ PIN, unapproved account) can read but
 *      never mutate; every mutation passes `requireWrite`.
 */

export type { Caller, Profile, Scope } from "@/lib/access.server";
export {
  HQ_READ_ONLY,
  canDispatch,
  requireAuthority,
  requireDispatch,
  requireWrite,
  resolveCaller,
} from "@/lib/access.server";

export type { SupportAccess } from "@/lib/team-support-access.server";
export {
  requireInboxManage,
  requireInboxRead,
  supportAccess,
  ticketSide,
} from "@/lib/team-support-access.server";

export {
  DEFAULT_DAILY_QUOTA,
  FIXED_DAILY_QUOTA,
  completionPercent,
  effectiveQuota,
  hasFixedQuota,
  quotaFor,
  ratioScore,
} from "@/lib/lead-quota";
