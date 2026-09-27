import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileUp, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { importLeads } from "@/lib/crm.functions";
import { parseCsv, toLeadRows, type CsvLeadRow } from "@/lib/csv-leads";
import { getAdminToken } from "@/lib/local-session";

export function CsvImportDialog() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CsvLeadRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const autoAssign = false;
  const queryClient = useQueryClient();
  const run = useServerFn(importLeads);

  const mutation = useMutation({
    mutationFn: () => run({ data: { adminToken: getAdminToken() ?? "", rows, autoAssign } }),
    onSuccess: (r) => {
      toast.success(`${r.eligibleNew} eligible new / নতুন লিড imported`, {
        description: `Incoming ${r.incoming} · worked/assigned ${r.excludedAlreadyWorkedOrAssigned} · duplicate/invalid ${r.excludedDuplicate}`,
      });
      void queryClient.invalidateQueries({ queryKey: ["crm-snapshot"] });
      setOpen(false);
      setRows([]);
      setFileName(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <FileUp className="size-4" /> Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import leads from CSV</DialogTitle>
          <DialogDescription>
            Columns: <code>name, phone, company, notes, outreach_en, outreach_bn</code>. Previously
            worked/assigned numbers are permanently excluded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const parsed = toLeadRows(parseCsv(await file.text()));
              setRows(parsed);
              setFileName(file.name);
              if (!parsed.length) toast.error("No valid rows found in that file");
            }}
          />
          {fileName && (
            <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
              <p className="font-medium">
                {fileName} · {rows.length} lead{rows.length === 1 ? "" : "s"} ready
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {rows.slice(0, 5).map((r, i) => (
                  <li key={i} className="truncate">
                    {r.name} · <span className="tabular">{r.phone_number}</span>
                    {r.company ? ` · ${r.company}` : ""}
                  </li>
                ))}
                {rows.length > 5 && <li>…and {rows.length - 5} more</li>}
              </ul>
            </div>
          )}
          <p className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground">সব ইমপোর্ট হেড লিড স্টোরে UNASSIGNED হিসেবে যায় — বণ্টন হয় Coordinator Deck-এর Distribution থেকে।</p>
          <Button
            className="w-full"
            disabled={!rows.length || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Import {rows.length || ""} leads
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
