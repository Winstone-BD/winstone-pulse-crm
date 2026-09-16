# Winstone Connect UI/UX 2.0 — Precision Productivity Suite

## Goal
Existing production CRM-কে এক cohesive, Bengali-first **WINSTONE CONNECT — Tele-Sales Operating System** experience-এ উন্নত করা, যেখানে agent productivity, lead scanning এবং mobile usability অগ্রাধিকার পাবে। কোনো backend, database, role permission, API contract বা workflow বদলানো হবে না।

## Design Direction
- Palette: deep navy, restrained emerald, cool white
- Typography: Hind Siliguri-style Bengali headings + Noto Sans Bengali-style body
- Structure: compact collapsible desktop sidebar, slim top command bar, mobile bottom navigation
- Visual character: precise operations console; compact 6–8px corners, clear borders, low shadow, no gradients

## Implementation
1. **Design system and shared shell**
   - Semantic navy/emerald/cool-white tokens, typography, border and shadow rules update করা।
   - Existing role-filtered navigation-কে desktop compact sidebar ও mobile bottom navigation-এ present করা।
   - Existing logo, install, PIN, agent selector, sign-out, live/sync indicators এবং AI control অক্ষত রাখা।

2. **Agent Desk priority workspace**
   - Header, live KPI strip, daily-work panels এবং tabs-কে clearer operational hierarchy-তে সাজানো।
   - Existing components/data only; কোনো metric বা action invent করা হবে না।
   - Lead workspace-কে screen-এর primary area করা।

3. **Lead list and filters**
   - Existing period/category/status filters compact command bar-এ সাজানো।
   - Desktop table-এ stronger row hierarchy, persistent visible actions এবং clearer category/grade/date/status presentation।
   - Mobile cards-এ no horizontal scroll, stable action targets এবং full-screen existing dossier flow preserve করা।

4. **Responsive and accessibility pass**
   - Desktop, tablet এবং Android-size viewport-এ navigation, text fit, focus states, contrast ও touch targets যাচাই করা।
   - Reduced-motion support এবং existing PWA/offline indicators preserve করা।

5. **Regression verification**
   - Sign-in/role visibility, Agent Desk, lead filters, lead detail, call/WhatsApp controls, tabs, logout এবং key routes verify করা।
   - Existing tests run করা এবং browser checks-এ blank screen, overflow, broken actions বা invented metrics না থাকা নিশ্চিত করা।

## Technical Boundaries
- Changes limited to frontend presentation and safe component composition.
- No schema/migration, RLS/auth, server function, API, offline queue, call logging, report gate, follow-up logic, or Android native logic changes.
- Shared shell changes remain role-driven from the existing navigation definitions and session state.
