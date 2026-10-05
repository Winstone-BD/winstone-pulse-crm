import { auth, defineMcp } from "@lovable.dev/mcp-js";

import listPublicPropertyFacts from "./tools/list-public-property-facts";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "winstone-public-property-catalog",
  title: "Winstone Public Property Catalog",
  version: "0.1.0",
  instructions:
    "Read-only verified public project and property facts. This server never exposes leads, customer contacts, calls, recordings, reports, staff data, or payment data.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listPublicPropertyFacts],
});
