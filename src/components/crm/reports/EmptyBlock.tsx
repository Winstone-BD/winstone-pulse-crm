import { CircleSlash, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Shared empty state used by charts, breakdown cards and the agent table. */
export function EmptyBlock({
  title,
  hint,
  onReset,
  compact = false,
}: {
  title: string;
  hint: string;
  onReset?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`mt-3 rounded-xl border border-dashed border-border text-center ${
        compact ? "p-4" : "p-6 sm:p-8"
      }`}
    >
      <CircleSlash className="mx-auto size-5 text-muted-foreground" />
      <p className="mt-2 text-sm font-medium">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      {onReset && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onReset}>
          <RotateCcw className="size-4" /> Adjust filters
        </Button>
      )}
    </div>
  );
}
