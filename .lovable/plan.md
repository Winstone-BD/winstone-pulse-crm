# LeadHub Nexus একীভূত করার পরিকল্পনা

## লক্ষ্য
Coordinator account ও আলাদা Coordinator tab সরিয়ে LeadHub Nexus-কে একমাত্র master lead database ও assignment workspace করা। শুধু HQ/IT নিরাপদ LeadHub PIN দিয়ে এটি খুলতে পারবে।

## যা বদলাবে
1. Home ও sign-in থেকে Coordinator account/create-account অপশন সরানো হবে।
2. মূল navigation-এ “Coordinator Deck” বদলে “LeadHub Nexus” হবে; পুরোনো `/dispatch` ঠিকানা নিরাপদভাবে LeadHub-এ পাঠাবে, যাতে পুরোনো bookmark ভাঙে না।
3. এক LeadHub page-এর সহজ sections থাকবে:
   - Overview
   - Import Leads
   - Canonical Lead Database
   - Assign by Agent + Quantity
   - Distribution History / Quality
4. সব manual/CSV/Excel import একই master pool-এ UNASSIGNED অবস্থায় যাবে। কোনো import সরাসরি agent queue-তে যাবে না।
5. Quantity দিলে server oldest eligible unassigned canonical leads বাছবে; duplicate, invalid, previously worked বা already assigned lead বাদ দেবে; daily 50 quota ও existing allocations অক্ষুণ্ণ থাকবে।
6. LeadHub access server-side HQ/IT authority + dedicated PIN দ্বারা enforce হবে। পুরোনো Coordinator session/account দিয়ে read, import বা assignment করা যাবে না। PIN UI/source/log/API response-এ প্রকাশ হবে না।
7. বর্তমান Bangladesh phone normalization, canonical phone identity, duplicate prevention, source/reference/history এবং audit trail অক্ষুণ্ণ থাকবে। কোনো lead hard-delete বা historical V1 rescore হবে না।
8. UI copy-তে Head Lead Store/Coordinator terminology বদলে “LeadHub Nexus” ও “Canonical Lead Database” করা হবে।

## যাচাই
- HQ/IT + সঠিক PIN: LeadHub খুলবে, import preview ও quantity assignment কাজ করবে।
- Agent/পুরোনো Coordinator/ভুল PIN: server action-সহ access প্রত্যাখ্যাত হবে।
- একই import বা assignment পুনরায় চালালে duplicate allocation হবে না।
- typecheck, full tests, security/RLS checks, production build এবং desktop/mobile LeadHub preview যাচাই করা হবে।

## সীমা
এই ধাপে নতুন অনুমানভিত্তিক AI score তৈরি হবে না। LeadHub কেবল সংরক্ষিত facts, existing V2 answers/history ও verified signals ব্যবহার করবে; fabricated enrichment হবে না।
