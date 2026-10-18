import { Link } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
import { useT } from "@/lib/i18n";

export function SafeWorkflowGuide() {
  const t = useT();
  const steps = [
    { bn: "এজেন্ট নিজের অ্যাকাউন্টে ঢুকবেন; HQ/IT দেখা অন্য এজেন্টের সেশন নয়। PIN, পাসওয়ার্ড বা সেশন কাউকে পাঠাবেন না।", en: "The agent signs into their own account. HQ/IT access is not an agent session. Never share a PIN, password or session." },
    { bn: "নিজের বরাদ্দকৃত লিড, প্রকৃত কল ও সম্মত কাজ বেছে নিন। ব্রিফিং ও দৈনিক অবদান সত্য তথ্য দিয়ে জমা দিন; পরীক্ষার তথ্য বানাবেন না।", en: "Use an owned lead, a real call and an agreed action. Complete briefing and contribution truthfully; never invent test data." },
    { bn: "আসল কলের রিপোর্ট একবার জমা দিয়ে আবার খুলুন: পরিচয়, সময়, উত্তর ও পরবর্তী কাজ মিলিয়ে দেখুন। ডুপ্লিকেট রিপোর্ট নয়।", en: "Submit the real report once and reopen it: compare its ID, time, answers and next action. Do not create a duplicate report." },
    { bn: "সম্মত follow-up-এ কারণসহ সম্পন্ন/পুনঃনির্ধারণ করুন। পুরোনো ইতিহাস ও নতুন linked কাজ দেখুন; সম্পন্ন করলে লিড বন্ধ হবে না।", en: "Complete or reschedule the agreed follow-up with a reason. Verify original history and linked replacement; completing a task must not close the lead." },
    { bn: "ফল লিখুন: Employee ID, সময়, রিপোর্ট/follow-up ID, আগে-পরে অবস্থা, PASS/FAIL/BLOCKED ও কারণ। গ্রাহকের অডিও বা গোপন তথ্য প্রকাশ নয়।", en: "Record employee ID, time, report/follow-up IDs, before/after states, PASS/FAIL/BLOCKED and reason. Do not expose customer audio or secrets." },
  ];
  return <details className="border-y border-border py-4">
    <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><ClipboardCheck className="size-4" />{t({ bn: "নিরাপদ এজেন্ট পরীক্ষা ও রেকর্ডিং উদ্ধার", en: "Safe agent checks & recording recovery" })}</summary>
    <div className="mt-3 space-y-3 text-sm">
      <p className="text-muted-foreground">{t({ bn: "আগে ফোনের রেকর্ডার থেকে একই কলের আসল ফাইল উদ্ধার ও অনুমোদিত আপলোড করুন। অ্যালার্ট বন্ধ সমাধান নয়। অডিও ছাড়া analysis/Drive রিট্রাই নয়; আসল Drive ফাইল পরীক্ষা ছাড়া ব্যাকআপ নিশ্চিত নয়।", en: "Recover the same call’s real file from the phone and use authorized upload first. Dismissing an alert is not a repair. No analysis/Drive retry without audio; verify the actual Drive file." })}</p>
      <ol className="list-decimal space-y-2 pl-5">{steps.map((step, i) => <li key={i}>{t(step)}</li>)}</ol>
      <p className="text-warning">{t({ bn: "পূর্ণ লাইভ রিপোর্ট/follow-up পরীক্ষা এখনও BLOCKED: প্রকৃত এজেন্ট সেশন ও অনুমোদিত সত্য ইনপুট দরকার। শুধু দেখা বা স্বয়ংক্রিয় পরীক্ষা জমার প্রমাণ নয়।", en: "Full live report/follow-up submission remains BLOCKED pending a real agent session and authorized truthful input. Read-only and automated checks do not prove submission." })}</p>
      <div className="flex flex-wrap gap-4"><Link to="/desk" search={{ s: "reports" }} className="underline">{t({ bn: "আমার রিপোর্ট", en: "My reports" })}</Link><Link to="/desk" search={{ s: "calendar" }} className="underline">{t({ bn: "ফলো-আপ", en: "Follow-ups" })}</Link><Link to="/leadhub" className="underline">LeadHub Nexus</Link></div>
    </div>
  </details>;
}