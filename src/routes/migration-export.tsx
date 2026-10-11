import { createFileRoute } from "@tanstack/react-router";
import { zipSync, strToU8 } from "fflate";
import { Download, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/crm/AppShell";
import { RoleGate } from "@/components/crm/RoleGate";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getAdminToken } from "@/lib/local-session";
import {
  EXPORT_TABLES,
  SOURCE_PROJECT_ID,
  TARGET_PROJECT_ID,
  exportTableChunk,
  getExportCounts,
} from "@/lib/migration-export.functions";

export const Route = createFileRoute("/migration-export")({
  head: () => ({
    meta: [
      { title: "Migration Export Center — Winstone Pulse" },
      { name: "description", content: "Read-only CRM1 → CRM2 data export bundle for IT." },
      { property: "og:title", content: "Migration Export Center — Winstone Pulse" },
      { property: "og:description", content: "Read-only migration bundle with manifest and checksums." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <RoleGate
        allow={["authority"]}
        icon={<ShieldAlert className="size-7" />}
        title="Migration Export Center"
        description="IT Console PIN required. Read-only export."
      >
        <ExportCenter />
      </RoleGate>
    </AppShell>
  );
}

function toCsv(rows: Array<Record<string, unknown>>) {
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const raw = typeof v === "object" ? JSON.stringify(v) : String(v);
    // Neutralize spreadsheet formulas planted in user-entered text.
    const s = /^[=+\-@\t\r]/.test(raw) && !/^-?\d+(\.\d+)?$/.test(raw) ? `'${raw}` : raw;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}

async function sha256(bytes: Uint8Array) {
  const buf = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function ExportCenter() {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [current, setCurrent] = useState("");
  const [counts, setCounts] = useState<Record<string, number | null> | null>(null);

  async function run() {
    setRunning(true);
    setDone(0);
    try {
      const adminToken = getAdminToken();
      const { counts: c, exportedAt } = await getExportCounts({ data: { adminToken } });
      setCounts(c);
      const files: Record<string, Uint8Array> = {};
      const manifest: Array<Record<string, unknown>> = [];
      for (const table of EXPORT_TABLES) {
        setCurrent(table);
        if (c[table] === null) {
          manifest.push({ table, status: "unavailable" });
          setDone((d) => d + 1);
          continue;
        }
        let afterCursor: string | null = null;
        let part = 0;
        let total = 0;
        const chunks: Array<Record<string, unknown>> = [];
        do {
          const raw = await exportTableChunk({ data: { adminToken, table, afterCursor } });
          const res = {
            rows: JSON.parse(raw.rowsJson) as Array<Record<string, unknown>>,
            nextAfterCursor: raw.nextAfterCursor,
          };
          part += 1;
          total += res.rows.length;
          const base = `data/${table}/${table}.part${String(part).padStart(4, "0")}`;
          const json = strToU8(JSON.stringify(res.rows));
          const csv = strToU8(toCsv(res.rows));
          files[`${base}.json`] = json;
          files[`${base}.csv`] = csv;
          chunks.push({
            part,
            rows: res.rows.length,
            json: `${base}.json`,
            json_sha256: await sha256(json),
            csv: `${base}.csv`,
            csv_sha256: await sha256(csv),
          });
          afterCursor = res.nextAfterCursor;
        } while (afterCursor);
        manifest.push({ table, status: "ok", source_count: c[table], exported_rows: total, chunks });
        setDone((d) => d + 1);
      }
      files["manifest.json"] = strToU8(
        JSON.stringify(
          {
            kind: "winstone-crm-migration-bundle",
            mode: "READ_ONLY_EXPORT",
            source_project_id: SOURCE_PROJECT_ID,
            target_project_id: TARGET_PROJECT_ID,
            export_started_at: exportedAt,
            export_finished_at: new Date().toISOString(),
            notes: [
              "UUIDs, timestamps and enum values are exported verbatim.",
              "Credential-like fields (pin_hash, tokens, secrets, ciphers) are redacted or omitted.",
              "Audio files are not included; storage_path / audio_url metadata is preserved.",
              "Rows are ordered by primary key; checksums are SHA-256 of each chunk file.",
            ],
            tables: manifest,
          },
          null,
          2,
        ),
      );
      const zip = zipSync(files, { level: 6 });
      const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `winstone-crm1-migration-${exportedAt.slice(0, 19).replace(/[:T]/g, "-")}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Migration bundle downloaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
      setCurrent("");
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm">
        <p className="font-semibold text-destructive">READ-ONLY MIGRATION EXPORT</p>
        <p className="mt-1 text-muted-foreground">
          This only reads data. Nothing in CRM1 is changed, deleted or disabled. Passwords, PIN
          hashes and tokens are never exported. Every export is recorded in the audit log.
        </p>
      </section>
      <section className="rounded-2xl border border-border/60 bg-card/60 p-4 sm:p-5">
        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Source (CRM1)</dt><dd className="font-mono break-all">{SOURCE_PROJECT_ID}</dd></div>
          <div><dt className="text-muted-foreground">Target (CRM2)</dt><dd className="font-mono break-all">{TARGET_PROJECT_ID}</dd></div>
        </dl>
        <Button className="mt-4" onClick={run} disabled={running}>
          <Download className="mr-2 size-4" />
          {running ? `Exporting ${current}…` : "Build migration ZIP"}
        </Button>
        {running || done ? (
          <Progress className="mt-3" value={(done / EXPORT_TABLES.length) * 100} />
        ) : null}
      </section>
      {counts ? (
        <section className="rounded-2xl border border-border/60 bg-card/60 p-4">
          <h3 className="mb-2 text-sm font-semibold">Source row counts</h3>
          <ul className="grid gap-1 text-xs sm:grid-cols-3">
            {EXPORT_TABLES.map((t) => (
              <li key={t} className="flex justify-between gap-2 rounded bg-background/40 px-2 py-1">
                <span className="font-mono">{t}</span>
                <span className="tabular-nums">{counts[t] ?? "n/a"}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
