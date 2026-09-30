import type { ReactNode } from "react";

import type { DocSection } from "@/lib/handover-docs";

export function DocPage({ kicker, title, meta, pdf, children, sections }: {
  kicker: string; title: string; meta: string; pdf: string; children?: ReactNode; sections: DocSection[];
}) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 print:py-0">
      <header className="border-b border-border pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{kicker}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{meta}</p>
        <a href={pdf} download className="mt-3 inline-block text-sm font-semibold text-primary hover:underline print:hidden">Download PDF</a>
      </header>
      {children}
      {sections.map((s) => (
        <section key={s.id} className="mt-7 break-inside-avoid">
          <h2 className="text-lg font-bold">{s.title}</h2>
          {s.body.map((p, i) => <p key={i} className="mt-2 text-sm leading-relaxed">{p}</p>)}
          {s.table ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead><tr>{(s.table[0] ?? []).map((h) => <th key={h} className="border border-border bg-muted p-2 text-left">{h}</th>)}</tr></thead>
                <tbody>{s.table.slice(1).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border border-border p-2 align-top">{c}</td>)}</tr>)}</tbody>
              </table>
            </div>
          ) : null}
        </section>
      ))}
    </main>
  );
}
