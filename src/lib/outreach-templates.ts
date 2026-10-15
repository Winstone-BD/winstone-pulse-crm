/** HQ-approved Bengali outreach templates, filled only with saved lead data. Shared by browser and server. */
export type OutreachCtx = { name: string; project?: string | null; agentName?: string | null };

export const OUTREACH_TEMPLATES: { key: string; label: string; build: (c: OutreachCtx) => string }[] = [
  {
    key: "brochure", label: "ব্রোশিওর",
    build: (c) => `আসসালামু আলাইকুম ${c.name}, উইনস্টোন থেকে বলছি${c.agentName ? ` (${c.agentName})` : ""}। আপনার আগ্রহ অনুযায়ী ${c.project ? `"${c.project}" প্রজেক্টের` : "আমাদের প্রজেক্টের"} ব্রোশিওর পাঠাচ্ছি। কোনো প্রশ্ন থাকলে জানাবেন।`,
  },
  {
    key: "visit_invite", label: "সাইট ভিজিট আমন্ত্রণ",
    build: (c) => `আসসালামু আলাইকুম ${c.name}, ${c.project ? `"${c.project}"` : "আমাদের প্রজেক্ট"} সরেজমিনে দেখতে আপনাকে সাইট ভিজিটে আমন্ত্রণ জানাচ্ছি। আপনার সুবিধামতো দিন ও সময় জানালে আমরা ব্যবস্থা করব। — উইনস্টোন`,
  },
  {
    key: "price_sheet", label: "মূল্য তালিকা",
    build: (c) => `আসসালামু আলাইকুম ${c.name}, ${c.project ? `"${c.project}" প্রজেক্টের` : "প্রজেক্টের"} হালনাগাদ মূল্য তালিকা সংযুক্ত করছি। বিস্তারিত জানতে কল করুন। — উইনস্টোন`,
  },
  {
    key: "callback", label: "কলব্যাক নিশ্চিতকরণ",
    build: (c) => `আসসালামু আলাইকুম ${c.name}, আপনার সাথে কথা বলার জন্য ধন্যবাদ। আমাদের আলোচনা অনুযায়ী আমি আবার আপনাকে কল করব। — উইনস্টোন${c.agentName ? `, ${c.agentName}` : ""}`,
  },
];

