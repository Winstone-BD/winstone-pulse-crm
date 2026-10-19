import { setLang, useLang } from "@/lib/i18n";

/** Inline English / বাংলা switch (same saved choice as the header switch). */
export function LangToggle() {
  const lang = useLang();
  return (
    <div className="inline-flex rounded-md border bg-card p-0.5 text-xs" role="group" aria-label="Language">
      {(["en", "bn"] as const).map((l) => (
        <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
          className={`rounded px-2 py-1 ${lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
          {l === "en" ? "English" : "বাংলা"}
        </button>
      ))}
    </div>
  );
}
