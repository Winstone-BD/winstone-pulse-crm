# Push notifications — real-device test plan

Scope: support alerts sent via Firebase web push (`src/lib/web-push.ts`, `public/firebase-messaging-sw.js`, `src/lib/push.server.ts`).
Run on the published site (https://crm.winstonebd.com), never inside the preview frame.

## Devices
| # | Device | Browser |
|---|--------|---------|
| 1 | Android phone | Chrome (latest) |
| 2 | Android phone | Chrome, installed to home screen |
| 3 | iPhone (iOS 16.4+) | Safari, added to Home Screen (required for web push) |
| 4 | Windows / macOS desktop | Chrome or Edge |

## Setup (each device)
1. Sign in as a staff account that receives support alerts.
2. Tap "Enable support alerts" and accept the browser permission prompt.
3. Expected: "এই ব্রাউজারে সাপোর্ট অ্যালার্ট চালু হয়েছে". If "পুশ সার্ভিস এখনো সংযুক্ত নয়" appears, the push service is not connected — stop and report.

## Cases
| ID | State | Steps | Expected |
|----|-------|-------|----------|
| F1 | Foreground, CRM tab visible | Create a support escalation from another account | In-app unread badge updates; no duplicate system popup |
| F2 | Foreground, other tab active | Same | System notification appears within 30 s |
| B1 | Background, browser minimised | Same | System notification appears; tapping opens the CRM inbox |
| B2 | Browser fully closed (Android) | Same | Notification still arrives; tap opens CRM |
| B3 | Phone locked screen | Same | Notification shows on lock screen |
| B4 | iOS Home Screen app closed | Same | Notification arrives (iOS only for Home Screen apps) |
| D1 | Permission denied | Block notifications, retry enable | "ব্রাউজার সেটিংস থেকে নোটিফিকেশন অনুমতি দিন"; badge still works |
| D2 | Sign out | Sign out, trigger alert | No notification for the signed-out account |
| D3 | Offline → online | Airplane mode, trigger, reconnect | Delivered after reconnect, once only |

## Record per case
Device, browser version, time sent, time received, pass/fail, screenshot. Never put customer phone numbers in screenshots.

## Pass rule
All F/B cases pass on devices 1, 3 and 4; D cases pass on at least one device.

## What the automated test covers (and what it cannot)
`tests/push-flow.test.ts` (run: `bunx vitest run push-flow`) checks the flow after the move from `firebase` to `@firebase/app` + `@firebase/messaging`, with Firebase and the browser mocked:
- Not-configured, preview-frame, unsupported and denied branches return the right status and never register the worker early.
- Registration passes full config, including `messagingSenderId` from the app ID, to both the app and `/firebase-messaging-sw.js`.
- Server sends go through the connector gateway, stale tokens (404/400) are revoked, a repeated event key sends nothing, and a missing connection is skipped quietly.

Still needs a real device (cases above):
- The real permission prompt and the token Firebase issues (mocked in tests).
- The service worker: it still loads the compat scripts from gstatic 10.12.0, separate from the bundled modular packages — confirm it installs and shows background notifications (B1–B4).
- Foreground behaviour: the app has no `onMessage` handler, so a visible tab relies on the in-app badge (F1); confirm no duplicate popup.
- Tapping a notification opening the right page (`data.path`, default `/desk`).
- iOS Home Screen delivery, lock screen, offline-then-online delivery and sign-out (D2: tokens are not revoked on sign-out today — record what happens).
- Android app (Winstone Connect) tokens: only the server send path is tested.
