# Smart Top 3 performance board

## What will change
- Replace the single-winner block with a responsive Top 3 podium-style board inspired by the supplied black-and-gold reference.
- Rank only active approved agents from today’s real call reports and follow-up activity; keep the 5:30 PM Dhaka reveal rule.
- Show each ranked agent’s name, rank, score, concise evidence for the rank, their main performance gap, and one short practical improvement.
- Include other active agents below the Top 3 with their real score, strongest metric, gap, and short next step, without exposing customer data.
- Keep an honest empty state when there is insufficient activity and preserve the existing pre-reveal team summary.

## Technical details
- Extend the existing daily performer response with the ranked list and deterministic per-agent reason/gap/advice fields.
- Keep the current scoring weights and database reads unchanged; no schema, auth, role, or workflow changes.
- Rebuild the card using the existing black/gold/accent theme tokens and mobile-safe layouts.
- Add focused scoring/content tests, then run typecheck, full tests, production build, and desktop/mobile preview checks.
