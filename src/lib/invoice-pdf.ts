/**
 * Printable invoice sheet for the monthly ৳4,000 service bill.
 *
 * Purely presentational: it renders the invoice data the panel already holds
 * into a standalone print window, so the browser's own "Save as PDF" produces
 * a clean Bengali invoice without embedding fonts by hand. No billing state is
 * read or written here.
 */

export type PrintableInvoice = {
  period: string;
  amountBdt: number;
  status: string;
  dueAt: string;
  graceUntil: string;
  paidAt: string | null;
  verifiedAt: string | null;
  verifiedByLabel: string | null;
  paymentRef: string | null;
  paymentMethod: string | null;
  serviceActiveUntil: string | null;
  systemShareBdt: number;
  architectShareBdt: number;
  payoutStatus: string;
  payoutRef: string | null;
  note: string | null;
};

export type PrintableArchitect = {
  name: string;
  bank: string;
  branch: string;
  currency: string;
  accountLast4: string | null;
} | null;

const STATUS_LABEL: Record<string, string> = {
  due: "বকেয়া",
  verifying: "যাচাই চলছে",
  paid: "পরিশোধিত",
  overdue: "মেয়াদোত্তীর্ণ",
  failed: "ব্যর্থ",
};

const PAYOUT_LABEL: Record<string, string> = {
  pending: "অপেক্ষমাণ",
  processing: "চলছে",
  paid: "পরিশোধিত",
  failed: "ব্যর্থ",
};

function dhaka(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("bn-BD", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function taka(amount: number): string {
  return `৳${amount.toLocaleString("bn-BD")}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(label: string, value: string): string {
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
}

export function openInvoicePdf(invoice: PrintableInvoice, architect: PrintableArchitect) {
  const title = `Winstone-Service-Invoice-${invoice.period}`;
  const rows = [
    row("পিরিয়ড", invoice.period),
    row("পরিমাণ", taka(invoice.amountBdt)),
    row("স্ট্যাটাস", STATUS_LABEL[invoice.status] ?? invoice.status),
    row("মেয়াদ (Due)", dhaka(invoice.dueAt)),
    row("গ্রেস শেষ", dhaka(invoice.graceUntil)),
    row("পরিশোধের সময়", dhaka(invoice.paidAt)),
    row("যাচাই", `${dhaka(invoice.verifiedAt)}${invoice.verifiedByLabel ? ` · ${invoice.verifiedByLabel}` : ""}`),
    row("পেমেন্ট রেফারেন্স", invoice.paymentRef ?? "—"),
    row("মাধ্যম", invoice.paymentMethod ?? "—"),
    row("সার্ভিস অ্যাক্টিভ-আনটিল", dhaka(invoice.serviceActiveUntil)),
    row(
      "ভাগ",
      `${taka(invoice.systemShareBdt)} সিস্টেম + ${taka(invoice.architectShareBdt)} আর্কিটেক্ট`,
    ),
    row(
      "পেআউট",
      `${PAYOUT_LABEL[invoice.payoutStatus] ?? invoice.payoutStatus}${invoice.payoutRef ? ` · ${invoice.payoutRef}` : ""}`,
    ),
    invoice.note ? row("নোট", invoice.note) : "",
    architect
      ? row(
          "পেআউট গ্রাহক",
          `${architect.name} · ${architect.bank} · ${architect.branch} · ${architect.currency} · অ্যাকাউন্ট শেষ ৪ সংখ্যা ${architect.accountLast4 ?? "—"}`,
        )
      : "",
  ].join("");

  const html = `<!doctype html>
<html lang="bn"><head><meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700&display=swap" rel="stylesheet" />
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: "Noto Sans Bengali", system-ui, sans-serif; color: #14120e; margin: 0; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #14120e; padding-bottom: 12px; }
  h1 { font-size: 20px; margin: 0; }
  .muted { color: #6b6455; font-size: 12px; margin: 4px 0 0; }
  .amount { font-size: 26px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 13px; }
  th, td { border-bottom: 1px solid #e4ded0; padding: 8px 6px; text-align: left; vertical-align: top; }
  th { width: 40%; color: #6b6455; font-weight: 600; }
  footer { margin-top: 22px; font-size: 11px; color: #6b6455; line-height: 1.6; }
</style></head>
<body>
  <div class="head">
    <div>
      <h1>Winstone Pulse — মাসিক সার্ভিস ইনভয়েস</h1>
      <p class="muted">পিরিয়ড ${escapeHtml(invoice.period)} · স্ট্যাটাস ${escapeHtml(STATUS_LABEL[invoice.status] ?? invoice.status)}</p>
    </div>
    <div class="amount">${escapeHtml(taka(invoice.amountBdt))}</div>
  </div>
  <table><tbody>${rows}</tbody></table>
  <footer>
    কার্ড, CVV, OTP বা পাসওয়ার্ড কোথাও সংরক্ষণ করা হয় না। আর্কিটেক্ট অ্যাকাউন্টের শেষ ৪ সংখ্যাই দেখানো হয়।<br />
    তৈরি: ${escapeHtml(dhaka(new Date().toISOString()))} (ঢাকা সময়)
  </footer>
  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.focus(); window.print(); }, 350);
    });
  </script>
</body></html>`;

  const win = window.open("", "_blank", "width=880,height=1000");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
