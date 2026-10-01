import { createContext, createElement, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";

/**
 * Tiny localStorage-backed stores for the admin unlock token and the
 * "Operating as" agent. No accounts, no sign-in — state lives on the device.
 */

export const ADMIN_TOKEN_KEY = "winstone.admin.token";
export const OPERATOR_KEY = "winstone.operator.id";

const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = () => fn();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* private mode — ignore */
  }
  emit();
}

function useStoredValue(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
}

export function useAdminToken() {
  const override = useContext(AdminTokenOverride);
  const stored = useStoredValue(ADMIN_TOKEN_KEY);
  return override !== undefined ? override : stored;
}

export function setAdminToken(token: string | null) {
  write(ADMIN_TOKEN_KEY, token);
}

export function getAdminToken() {
  if (activeOverride !== undefined) return activeOverride;
  return read(ADMIN_TOKEN_KEY);
}

export function useOperatorId() {
  return useStoredValue(OPERATOR_KEY);
}

export function setOperatorId(id: string | null) {
  write(OPERATOR_KEY, id);
}

/** Coordinator Deck unlock (Gmail + Coordinator PIN). Deck-only — never HQ/IT. */
export const COORD_TOKEN_KEY = "winstone.coord.token";

export function setCoordToken(token: string | null) {
  write(COORD_TOKEN_KEY, token);
}

/** Token for Coordinator Deck calls: master/IT PIN token first, else the coordinator unlock. */
export function useDeckToken() {
  const admin = useStoredValue(ADMIN_TOKEN_KEY);
  const coord = useStoredValue(COORD_TOKEN_KEY);
  return admin ?? coord;
}

export function getDeckToken() {
  return read(ADMIN_TOKEN_KEY) ?? read(COORD_TOKEN_KEY);
}

/**
 * LeadHub Nexus has its own PIN session, stored separately so unlocking it
 * never overwrites the master/IT/HQ token (and vice versa).
 */
export const LEADHUB_TOKEN_KEY = "winstone.leadhub.token";

export function setLeadHubToken(token: string | null) {
  write(LEADHUB_TOKEN_KEY, token);
}

export function useLeadHubToken() {
  return useStoredValue(LEADHUB_TOKEN_KEY);
}

/** Inside LeadHub, admin-token readers transparently receive the LeadHub token. */
const AdminTokenOverride = createContext<string | null | undefined>(undefined);
let activeOverride: string | null | undefined;

export function LeadHubTokenScope({ token, children }: { token: string | null; children: ReactNode }) {
  useEffect(() => {
    activeOverride = token;
    return () => {
      activeOverride = undefined;
    };
  }, [token]);
  return createElement(AdminTokenOverride.Provider, { value: token }, children);
}
