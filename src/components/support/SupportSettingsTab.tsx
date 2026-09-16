import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminToken } from "@/lib/local-session";
import { loadSupportSettings, updateSupportSettings } from "@/lib/support-admin.functions";

export function SupportSettingsTab() {
  const adminToken = useAdminToken();
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ["support", "settings", adminToken],
    queryFn: () => loadSupportSettings({ data: { adminToken } }),
  });

  const update = useMutation({
    mutationFn: (patch: Parameters<typeof updateSupportSettings>[0] extends never ? never : Record<string, unknown>) =>
      updateSupportSettings({ data: { adminToken, ...patch } as never }),
    onSuccess: () => {
      toast.success("Settings saved");
      void queryClient.invalidateQueries({ queryKey: ["support", "settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (settings.isLoading) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Loading…
      </p>
    );
  }
  if (settings.isError) {
    return (
      <p className="text-sm text-destructive">
        {settings.error instanceof Error ? settings.error.message : "Unavailable"}
      </p>
    );
  }

  const { settings: current, canEdit } = settings.data!;

  return (
    <div className="max-w-xl space-y-3">
      {!canEdit && (
        <p className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
          These settings are read-only for your session. A support admin can change them.
        </p>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">AI assistant</p>
        <label className="mt-3 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={current.ai_enabled}
            disabled={!canEdit || update.isPending}
            onChange={(event) => update.mutate({ ai_enabled: event.target.checked })}
          />
          Let the assistant answer new conversations
        </label>
        <label className="mt-3 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={current.auto_escalate_on_low_confidence}
            disabled={!canEdit || update.isPending}
            onChange={(event) =>
              update.mutate({ auto_escalate_on_low_confidence: event.target.checked })
            }
          />
          Hand over to a person when confidence is below the threshold
        </label>
        <div className="mt-3 space-y-1">
          <Label htmlFor="threshold" className="text-xs">
            Confidence threshold ({Math.round(current.ai_confidence_threshold * 100)}%)
          </Label>
          <input
            id="threshold"
            type="range"
            min={20}
            max={95}
            step={5}
            className="w-full"
            defaultValue={Math.round(current.ai_confidence_threshold * 100)}
            disabled={!canEdit || update.isPending}
            onMouseUp={(event) =>
              update.mutate({
                ai_confidence_threshold: Number((event.target as HTMLInputElement).value) / 100,
              })
            }
          />
        </div>
        <div className="mt-3 space-y-1">
          <Label htmlFor="persona" className="text-xs">
            Assistant name shown to customers
          </Label>
          <Input
            id="persona"
            defaultValue={current.ai_persona}
            disabled={!canEdit || update.isPending}
            onBlur={(event) => {
              if (event.target.value.trim() !== current.ai_persona) {
                update.mutate({ ai_persona: event.target.value.trim() });
              }
            }}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Service targets</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="sla-first" className="text-xs">
              First response (minutes)
            </Label>
            <Input
              id="sla-first"
              type="number"
              min={5}
              defaultValue={current.sla_first_response_minutes}
              disabled={!canEdit || update.isPending}
              onBlur={(event) =>
                update.mutate({ sla_first_response_minutes: Number(event.target.value) })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sla-resolve" className="text-xs">
              Resolution (minutes)
            </Label>
            <Input
              id="sla-resolve"
              type="number"
              min={30}
              defaultValue={current.sla_resolution_minutes}
              disabled={!canEdit || update.isPending}
              onBlur={(event) =>
                update.mutate({ sla_resolution_minutes: Number(event.target.value) })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
