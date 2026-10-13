import emblemAsset from "@/assets/winstone-emblem.png.asset.json";

/**
 * Canonical product lockup: round Winstone emblem + "WINSTONE PULSE" + descriptor.
 * Use everywhere the product name appears in a header so naming stays identical.
 */
export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <img
        src={emblemAsset.url}
        alt="Winstone logo"
        className="size-9 shrink-0 rounded-full object-cover"
      />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[13px] font-semibold tracking-[0.12em]">
          WINSTONE <span className="text-gold">PULSE</span>
        </span>
        {!compact && (
          <span className="hidden truncate text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground sm:block">
            The Premium Real Estate CRM
          </span>
        )}
      </span>
    </span>
  );
}
