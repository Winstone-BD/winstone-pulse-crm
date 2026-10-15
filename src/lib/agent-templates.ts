// Buyer-check and call-prep templates adapted from AgentForge's sales workflows.
// Pure text: nothing is sent or saved. Known fields come from the lead's saved
// CRM record; anything not stored shows "তথ্য যাচাই প্রয়োজন". Lead-supplied text
// is screened with the same prompt guard used for AI.
import { sanitizeNotes } from "@/lib/prompt-guard";

export type TemplateId = "buyer_check" | "call_prep";

export type TemplateFacts = {
  name?: string | null;
  requirement?: string | null;
  area?: string | null;
  interest?: string | null;
  temperature?: string | null;
  grade?: string | null;
  customerResponse?: string | null;
  nextAction?: string | null;
  lastCallAt?: string | null;
  attempts?: number | null;
};

export const VERIFY = "তথ্য যাচাই প্রয়োজন";

function clean(value: string | null | undefined, max = 120) {
  const raw = (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const { flagged } = sanitizeNotes(raw, max);
  return { text: flagged ? "" : raw.replace(/[<>]/g, ""), flagged };
}

export function buildTemplate(id: TemplateId, facts: TemplateFacts) {
  const f = {
    name: clean(facts.name, 80), requirement: clean(facts.requirement), area: clean(facts.area),
    interest: clean(facts.interest, 60), response: clean(facts.customerResponse, 160), next: clean(facts.nextAction, 160),
  };
  const flagged = Object.values(f).some((v) => v.flagged);
  const known = (v: { text: string }) => v.text || VERIFY;
  const who = f.name.text || "গ্রাহক";
  const heat = facts.temperature || facts.grade
    ? `${(facts.temperature ?? "?").toUpperCase()}/${facts.grade ?? "?"} (CRM)` : VERIFY;
  const last = facts.lastCallAt
    ? new Date(facts.lastCallAt).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" }) : "এখনো কল হয়নি";

  const text =
    id === "buyer_check"
      ? [
          `ক্রেতা যাচাই — ${who}`,
          `প্রয়োজন: ${known(f.requirement)}`,
          `এলাকা: ${known(f.area)}`,
          `আগ্রহ: ${known(f.interest)}`,
          `CRM শ্রেণি: ${heat}`,
          `শেষ কল: ${last}${facts.attempts ? ` · মোট ${facts.attempts}টি চেষ্টা` : ""}`,
          `গ্রাহকের শেষ কথা: ${known(f.response)}`,
          `পরের কাজ (আগের রিপোর্ট): ${known(f.next)}`,
          "",
          `বাজেট (সর্বোচ্চ ৳): ${VERIFY}`,
          "ধরন (ফ্ল্যাট / জমি / কমার্শিয়াল / রিসোর্ট শেয়ার): " + VERIFY,
          `কবে কিনতে চান: ${VERIFY}`,
          `সিদ্ধান্ত কে নেবেন: ${VERIFY}`,
          `কিস্তি লাগবে? কত মাস: ${VERIFY}`,
          `প্রবাসী (NRB) কি না: ${VERIFY}`,
          "",
          "প্রস্তাবিত গ্রেড: A+ HOT | B Follow-up | C Low Intent (শুধু পরামর্শ — CRM গ্রেডই চূড়ান্ত)",
          "দাম, স্টক বা ছাড় যাচাই ছাড়া বলবেন না।",
        ].join("\n")
      : [
          `কল প্রস্তুতি — ${who}`,
          `প্রয়োজন: ${known(f.requirement)}`,
          "",
          "কলের উদ্দেশ্য: ",
          "",
          "শুরুর কথা:",
          `আসসালামু আলাইকুম, ${who}। Winstone Properties থেকে বলছি — দুই মিনিট সময় হবে?`,
          "",
          "জানার প্রশ্ন:",
          "১. কোন এলাকায় খুঁজছেন?",
          "২. আনুমানিক বাজেট কত?",
          "৩. কবের মধ্যে নিতে চান?",
          "৪. পরিবারের আর কে সিদ্ধান্তে আছেন?",
          "৫. সাইট ভিজিটে কবে আসতে পারবেন?",
          "",
          "সম্ভাব্য আপত্তি ও ভদ্র উত্তর:",
          "- দাম বেশি → যাচাই করা দাম ও কিস্তির সুবিধা জানিয়ে দেব।",
          "- এখন সময় নেই → আপনার সুবিধামতো সময়ে আবার ফোন করি?",
          "- আরও ভাবতে চাই → সাইট ভিজিটে নিজে দেখে সিদ্ধান্ত নিতে পারেন।",
          "",
          "কোনো দাম, ছাড় বা রিটার্নের নিশ্চয়তা দেবেন না।",
        ].join("\n");
  return { text, flagged };
}
