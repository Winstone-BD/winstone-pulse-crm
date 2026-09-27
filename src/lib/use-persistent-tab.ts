import { useCallback, useState } from "react";

/**
 * Tab state that remembers the last opened tab in localStorage.
 * The stored value is validated against the allowed keys, so a stale or
 * foreign value can never select a non-existent tab.
 */
export function usePersistentTab<T extends string>(
  storageKey: string,
  allowed: readonly T[],
  fallback: T,
): [T, (next: T) => void] {
  const [tab, setTabState] = useState<T>(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved && (allowed as readonly string[]).includes(saved)) return saved as T;
    } catch {
      /* storage unavailable */
    }
    return fallback;
  });

  const setTab = useCallback(
    (next: T) => {
      setTabState(next);
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        /* storage unavailable */
      }
    },
    [storageKey],
  );

  return [tab, setTab];
}
