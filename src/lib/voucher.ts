import { CRM_PLAN_NAME, usd } from "@/lib/maintenance-rules";

/** A saved payment receipt — created server-side when a payment is verified, reopenable any time. */
export type Voucher = {
  no: string;
  period: string;
  ref: string;
  baseCents: number;
  vatCents: number;
  totalCents: number;
  currency: string;
  verifiedBy: string;
  at: string; // Dhaka wall-clock label
};

export function voucherHtml(v: Voucher) {
  const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const rows: [string, string][] = [
    ["Voucher no.", v.no],
    ["Plan", CRM_PLAN_NAME],
    ["Billing period", v.period],
    ["Payment reference", v.ref],
    ["Base", usd(v.baseCents)],
    ["VAT (15%)", usd(v.vatCents)],
    ["Total paid", `${usd(v.totalCents)} ${v.currency}`],
    ["Status", "PAID — verified"],
    ["Verified by", v.verifiedBy],
    ["Verified at", `${v.at} (Asia/Dhaka)`],
  ];
  return `<!doctype html><meta charset="utf-8"><title>${esc(v.no)}</title><body style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:40px auto;color:#111"><h2>Payment receipt</h2><table style="width:100%;border-collapse:collapse">${rows.map(([k, val]) => `<tr><td style="padding:6px 0;color:#555">${k}</td><td style="text-align:right;font-weight:600">${esc(val)}</td></tr>`).join("")}</table><p style="margin-top:24px;font-size:12px;color:#666">Issued automatically when the payment was verified by the authorized architect.</p></body>`;
}

export function downloadVoucher(v: Voucher) {
  const url = URL.createObjectURL(new Blob([voucherHtml(v)], { type: "text/html" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${v.no}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printVoucher(v: Voucher) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(voucherHtml(v));
  w.document.close();
  w.print();
}
