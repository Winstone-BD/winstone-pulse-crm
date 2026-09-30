# Daily 9:05 Briefing Lock

## কী তৈরি হবে
- প্রতিদিন Asia/Dhaka তারিখ অনুযায়ী Agent-এর জন্য বাধ্যতামূলক briefing acknowledgement থাকবে।
- Agent Desk ও Android app খুললে acknowledgement বাকি থাকলে non-dismissible popup দেখাবে।
- Agent নোটিশ পড়ে “বুঝেছি — কল শুরু করব” চাপলে সেই দিন ও policy version-এর acknowledgement সংরক্ষিত হবে।
- acknowledgement না হওয়া পর্যন্ত web ও Android-এর call-start server থেকে প্রত্যাখ্যাত হবে।
- নোটিশের বাইরে ক্লিক, back button, refresh, app restart বা সরাসরি API call করে gate bypass করা যাবে না।

## নিয়ম
- Gate প্রতিদিন 9:05 AM Asia/Dhaka থেকে কার্যকর হবে এবং পরের business date-এ নতুন acknowledgement চাইবে।
- Policy version বদলালে একই দিনেও আবার acknowledgement চাইবে।
- Friday-তে নতুন lead distribution হয় না; তবে existing work/call access-এর briefing gate একইভাবে প্রযোজ্য থাকবে।
- HQ, IT ও Coordinator flow অপরিবর্তিত থাকবে; এটি Agent-only।
- বর্তমান mandatory post-call report lock ও accountability lock অপরিবর্তিত থাকবে।

## Technical details
- Server-owned policy/status helper এবং immutable per-agent/date/version acknowledgement table যোগ হবে, server-only writes ও strict access control সহ।
- Authenticated web server functions এবং device-authenticated Android endpoint একই helper ব্যবহার করবে।
- সব outbound call-start entry point-এ acknowledgement check pending-report check-এর আগে চলবে।
- Web Agent Desk ও Android dashboard server status load করে blocking popup দেখাবে; network/status failure হলে call start fail-closed থাকবে।
- Dhaka boundary, 9:04/9:05 transition, daily reset, policy-version reset, agent isolation এবং authorization tests যোগ হবে।

## যাচাই
- Full web regression tests ও typecheck।
- Android unit tests/build।
- Preview-তে Agent Desk popup এবং acknowledgement-এর পর call gate state যাচাই।
