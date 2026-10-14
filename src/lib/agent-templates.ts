// Buyer-check and call-prep templates adapted from AgentForge's sales workflows.
// Pure text: nothing is sent or saved. Lead-supplied text is screened with the
// same prompt guard used for AI, so pasted instructions are flagged, not trusted.
import { sanitizeNotes } from "@/lib/prompt-guard";

export type TemplateId = "buyer_check" | "call_prep";

export type TemplateFacts = { name?: string | null; requirement?: string | null };

const VERIFY = "তথ্য যাচাই প্রয়োজন";

function clean(value: string | null | undefined, max = 80) {
  const raw = (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const { flagged } = sanitizeNotes(raw, max);
  return { text: flagged ? "" : raw.replace(/[<>]/g, ""), flagged };
}

export function buildTemplate(id: TemplateId, facts: TemplateFacts) {
  const name = clean(facts.name);
  const req = clean(facts.requirement, 120);
  const who = name.text || "গ্রাহক";
  const need = req.text || VERIFY;
  const text =
    id === "buyer_check"
      ? [
          `ক্রেতা যাচাই — ${who}`,
          `প্রয়োজন: ${need}`,
          "",
          `১. বাজেট (সর্বোচ্চ ৳): ${VERIFY}`,
          "২. পছন্দের এলাকা / প্রকল্প: ",
          "৩. ধরন: ফ্ল্যাট / জমি / কমার্শিয়াল / রিসোর্ট শেয়ার",
          "৪. কবে কিনতে চান (সময়সীমা): ",
          "৫. সিদ্ধান্ত কে নেবেন: ",
          "৬. কিস্তি লাগবে? কত মাস: ",
          "৭. প্রবাসী (NRB) কি না: ",
          "",
          "জানা বাকি — পরের কলে জিজ্ঞেস করুন:",
          "- ",
          "",
          "প্রস্তাবিত গ্রেড: A+ HOT | B Follow-up | C Low Intent (শুধু পরামর্শ — CRM গ্রেডই চূড়ান্ত)",
          "দাম, স্টক বা ছাড় যাচাই ছাড়া বলবেন না।",
        ].join("\n")
      : [
          `কল প্রস্তুতি — ${who}`,
          `প্রয়োজন: ${need}`,
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
  return { text, flagged: name.flagged || req.flagged };
}
