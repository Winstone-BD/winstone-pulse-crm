import { AlertTriangle, Clock, FileDown, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { CRM_CLOSURE_START_MS, isCrmClosureActive } from "@/lib/service-interruption";

/** Global, non-dismissible interruption notice for the home page and every CRM workspace. */
export function TemporaryClosureNotice() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const update = () => setActive(isCrmClosureActive());
    update();

    const remaining = CRM_CLOSURE_START_MS - Date.now();
    if (remaining <= 0) return;

    const timer = window.setTimeout(update, remaining);
    return () => window.clearTimeout(timer);
  }, []);

  if (!active) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="temporary-closure-title"
      className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto bg-background/95 p-3 backdrop-blur-sm sm:p-6"
    >
      <section className="my-auto w-full max-w-xl overflow-hidden rounded-lg border border-destructive/40 bg-card shadow-lg">
        <header className="border-b border-destructive/25 bg-destructive/10 px-4 py-4 sm:px-6">
          <p className="flex items-center gap-2 text-xs font-bold text-destructive">
            <ShieldAlert className="size-4" aria-hidden="true" /> IT / MANAGEMENT
          </p>
          <h1 id="temporary-closure-title" className="mt-2 text-xl font-bold sm:text-2xl">
            জরুরি নোটিশ — CRM সাময়িকভাবে বন্ধ
          </h1>
        </header>

        <div className="space-y-4 px-4 py-5 text-sm leading-7 sm:px-6 sm:text-base">
          <p>
            সকলকে জানানো যাচ্ছে যে, বর্তমানে CRM-এর ongoing development ও system update-এর কাজ
            চলছে। উন্নয়ন কাজের অংশ হিসেবে প্রতিটি Agent-এর individual report আলাদাভাবে PDF হিসেবে
            download করার সুবিধা যুক্ত করা হচ্ছে।
          </p>

          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-3">
            <FileDown className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="font-semibold">
              এই কাজ সম্পন্ন করার জন্য CRM আপাতত সাময়িকভাবে বন্ধ রাখা হয়েছে।
            </p>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/10 p-3">
            <Clock className="mt-1 size-5 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <p className="font-bold">CRM বন্ধ থাকবে (সাময়িকভাবে)</p>
              <p className="mt-1 text-sm">
                যারা বর্তমানে CRM ব্যবহার করছেন, তাদের অনুরোধ করা হচ্ছে আপাতত CRM ব্যবহার না করার
                জন্য। সাময়িক অসুবিধার জন্য আমরা আন্তরিকভাবে দুঃখিত।
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 font-semibold">
            <AlertTriangle className="mt-1 size-5 shrink-0 text-destructive" aria-hidden="true" />
            <p>
              System পুনরায় active করা হলে সবাইকে জানিয়ে দেওয়া হবে। আমাদের পক্ষ থেকে confirmation
              না পাওয়া পর্যন্ত CRM ব্যবহার শুরু করবেন না।
            </p>
          </div>

          <p>ধন্যবাদ সবাইকে সহযোগিতা করার জন্য।</p>
          <p className="border-t border-border pt-3 text-right font-bold">— IT / Management</p>
        </div>
      </section>
    </div>
  );
}