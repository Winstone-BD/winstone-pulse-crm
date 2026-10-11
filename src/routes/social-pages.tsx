import { createFileRoute } from "@tanstack/react-router";
import { Globe } from "lucide-react";

import { AppShell } from "@/components/crm/AppShell";
import { RoleGate } from "@/components/crm/RoleGate";
import { SocialPagesAdmin } from "@/components/crm/social/SocialPagesAdmin";

export const Route = createFileRoute("/social-pages")({
  head: () => ({
    meta: [
      { title: "সোশ্যাল পেজ ও গ্রুপ — Winstone Pulse" },
      { name: "description", content: "HQ management of the Facebook pages and groups agents select when logging social media work." },
      { property: "og:title", content: "সোশ্যাল পেজ ও গ্রুপ — Winstone Pulse" },
      { property: "og:description", content: "HQ management of the Facebook pages and groups agents select when logging social media work." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SocialPagesPage,
});

function SocialPagesPage() {
  return (
    <AppShell>
      <RoleGate
        surface="hq"
        allow={["authority"]}
        icon={<Globe className="size-7" />}
        title="সোশ্যাল পেজ ও গ্রুপ"
        description="এজেন্টদের বেছে নেওয়ার পেজ ও গ্রুপের তালিকা শুধু HQ/IT পরিচালনা করে। মাস্টার পিন লাগবে।"
      >
        <SocialPagesAdmin />
      </RoleGate>
    </AppShell>
  );
}
