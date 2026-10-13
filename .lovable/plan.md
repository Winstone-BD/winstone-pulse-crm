# Winstone Pulse — simpler, enterprise-grade homepage

## Design direction
Use the supplied image as a **layout reference**, not a replacement homepage image. Retain the existing fonts, round emblem, WINSTONE PULSE name, “The Premium Real Estate CRM” descriptor and black/champagne-gold/warm-white palette.

## Proposed changes
- **Clearer first screen:** compact brand header; prominent Winstone Pulse title and descriptor; shorter supporting copy with more deliberate spacing. No header or hero sign-in buttons.
- **Unframed capability row:** Team, Pipeline and Calls presented as three concise icon-led items, rather than a boxed vertical stack. No invented lead counts, growth charts or sales figures.
- **Operational status:** a restrained, stable health indicator that reports only the actual public server health check. Do not imply that lead sync, calls or all services are verified by this check. Keep initial checking and unavailable states visible and understandable.
- **Workspace selection:** three equal-width Android, Web / iOS and Desktop choices on desktop, with existing device images, clearer labels and a distinct selected state. Stack comfortably on narrow phones instead of squeezing three cards into one row.
- **Entry flow:** preserve optional device selection and the single Get started action below the device choices. It reveals Executive HQ → Sales Agent → LeadHub Nexus → IT Console, followed by the existing IT-provisioned-agent notice.
- **Billing notice:** retain the existing real billing notice and its behavior; do not copy the reference’s example suspension warning or introduce payment changes.

## Explicit exclusions
No new fonts, forest green, building hero, decorative charts, fabricated metrics, public registration, new authentication paths, billing-rule changes, production-record edits or deployment.

## Technical implementation and validation
- Limit changes to homepage presentation and any necessary semantic CSS tokens. Preserve the current secure sign-in/PIN destinations, route metadata, account scope checks and billing components.
- Reuse existing device assets and Button controls; the uploaded reference itself will not be embedded.
- Check desktop, tablet and phone widths for overflow, text fit, selected states and keyboard focus.
- Exercise optional selection → Get started → existing portal controls in the browser, without submitting credentials or payment decisions.
- Run relevant homepage/public-registration tests and inspect preview diagnostics. Report exactly what was checked; authentication and payment approval are outside this visual pass.

## Separate known issue
The inspected package currently contains a direct build-tool dependency at 2.25.3 despite the locked 2.25.2 rule. Handle that existing pin drift separately from the visual design; no dependency changes have been made in this proposal.