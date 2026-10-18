import { isOpenFollowUp } from "@/lib/follow-up-lifecycle";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";

import { myFollowUps } from "@/lib/call-reports.functions";
import { useAdminToken } from "@/lib/local-session";

/**
 * Follow-up alarm on the agent's own phone: 30 minutes before the scheduled
 * time, one notification per follow-up.
 *
 * Uses the phone's own notification tray through the browser (works in the
 * installed web app on Android). Fired ids are remembered in localStorage, so a
 * reload or a second open tab never repeats the same alarm.
 */
const FIRED_KEY = "winstone.followup.notified.v1";
const REMINDER_MINUTES = 30;

function firedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function remember(id: string) {
  const next = [...new Set([...firedIds(), id])].slice(-300);
  localStorage.setItem(FIRED_KEY, JSON.stringify(next));
}

/** True while the web dialler has a live call open (set by WebCallButton). */
function onActiveCall(): boolean {
  try {
    const raw = localStorage.getItem("winstone.web.call.v1");
    if (!raw) return false;
    const live = JSON.parse(raw) as { startedAt?: number };
    // A stale marker older than 2 hours never blocks reminders forever.
    return typeof live.startedAt === "number" && Date.now() - live.startedAt < 2 * 60 * 60_000;
  } catch {
    return false;
  }
}

/** Short alarm sound; silently skipped if the browser blocks audio. */
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.35, 0.7].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.2;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.2);
    });
    window.setTimeout(() => void ctx.close(), 1500);
  } catch {
    // no audio
  }
}

/** Ask once for permission; safe to call from a click handler. */
export async function askFollowUpNotifications(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

export function useFollowUpReminders(enabled: boolean) {
  const adminToken = useAdminToken();
  const fetchEvents = useServerFn(myFollowUps);

  const events = useQuery({
    queryKey: ["followup-reminders"],
    enabled,
    // A minute is enough resolution for a 30-minute warning.
    refetchInterval: 60_000,
    queryFn: () => {
      const from = new Date(Date.now() - 60 * 60_000).toISOString();
      const to = new Date(Date.now() + 6 * 60 * 60_000).toISOString();
      return fetchEvents({ data: { adminToken, fromIso: from, toIso: to } });
    },
  });

  useEffect(() => {
    if (!enabled || !events.data) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    const now = Date.now();
    const already = firedIds();
    // Agent is on a call right now: defer alarms (nothing is marked fired, so
    // the schedule rings once the call ends).
    if (onActiveCall()) return;

    for (const event of events.data) {
      if (!isOpenFollowUp(event.status)) continue;
      const at = new Date(event.scheduled_at).getTime();
      if (at < now - 5 * 60_000) {
        // Overdue: one quiet "OVERDUE" notice per follow-up, never repeated.
        const key = `${event.id}:overdue`;
        if (at < now - 15 * 60_000 && !already.includes(key)) {
          remember(key);
          try {
            new Notification("OVERDUE FOLLOW-UP — সময় পেরিয়ে গেছে", {
              body: `${event.customer_name ?? "ক্রেতা"} · ${event.phone_number ?? ""}`.trim(),
              tag: `followup-${event.id}-overdue`,
              icon: "/icons/icon-192.png",
            });
          } catch {
            // blocked; the calendar still shows it as overdue
          }
        }
        continue;
      }
      // Three alarms: 30 min before, 15 min before, and at the time itself.
      const stage = [0, 15, REMINDER_MINUTES].find(
        (mins) => now >= at - mins * 60_000 && !already.includes(`${event.id}:${mins}`),
      );
      if (stage === undefined) continue;
      // Mark every earlier stage too, so a late-opened tab rings once, not three times.
      for (const mins of [REMINDER_MINUTES, 15, 0]) if (mins >= stage) remember(`${event.id}:${mins}`);

      const clock = new Date(at).toLocaleTimeString("bn-BD", {
        timeZone: "Asia/Dhaka",
        hour: "2-digit",
        minute: "2-digit",
      });
      try {
        const note = new Notification(
          stage === 0 ? "এখনই ফলো-আপ কল করুন" : `ফলো-আপ ${stage} মিনিট পরে`,
          {
            body: `${event.customer_name ?? "ক্রেতা"} — ${clock} · ${event.phone_number ?? ""}`.trim(),
            tag: `followup-${event.id}-${stage}`,
            icon: "/icons/icon-192.png",
            badge: "/icons/favicon-32.png",
          },
        );
        note.onclick = () => {
          window.focus();
          note.close();
        };
        beep();
      } catch {
        // Notification blocked by the phone: the follow-up calendar still shows it.
      }
    }
  }, [enabled, events.data]);

  return { count: events.data?.length ?? 0 };
}
