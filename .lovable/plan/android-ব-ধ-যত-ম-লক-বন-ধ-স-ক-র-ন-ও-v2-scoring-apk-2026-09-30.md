# Android বাধ্যতামূলক বন্ধ-স্ক্রিন ও V2 scoring APK

## লক্ষ্য
- Winstone Connect Android অ্যাপে সব agent-এর জন্য CRM সাময়িক বন্ধের non-dismissible full-screen notice দেখানো।
- Connected call report-এ web-এর একই locked ৬টি Yes/No প্রশ্ন দেখানো এবং 0–90 score ও Cold/Warm/Hot স্বয়ংক্রিয়ভাবে দেখানো।
- Agent যেন Hot/Warm/Cold manually পরিবর্তন করতে না পারে; server একই answers থেকে আবার score/category হিসাব করবে।

## কাজের ধাপ
1. **একটি shared maintenance status**
   - Web-এর বর্তমান 30 September 2026, 11:30 AM Asia/Dhaka activation rule-কে server endpoint-এ প্রকাশ করা।
   - Android startup/resume ও periodic refresh-এ status আনবে এবং locally last-known active state রাখবে।
   - Active হলে sign-in, desk, call এবং report screen-এর ওপর একই Bengali notice থাকবে; close/back দিয়ে সরানো যাবে না।
   - Internet না থাকলেও active state ভুলভাবে খুলবে না। IT পরে server status inactive করলেই APK update ছাড়া notice সরবে।

2. **Android six-question evaluation**
   - Connected report থেকে manual Hot/Warm/Cold selector সরানো।
   - Locked point values: 15, 15, 10, 20, 20, 10।
   - Bands: 0–20 Cold, 21–50 Warm, 51–90 Hot।
   - ছয়টি উত্তর সম্পূর্ণ না হলে submit বন্ধ থাকবে; live score/category read-only থাকবে।
   - Existing Grade, outcome, notes এবং optional follow-up workflow অপরিবর্তিত থাকবে। Non-connected calls-এ প্রশ্ন দেখাবে না।

3. **Data integrity**
   - Android online ও offline report payload-এ `evaluation_answers` পাঠানো।
   - Server raw answers থেকে authoritative score/category/priority/next action হিসাব করবে; client value বিশ্বাস করবে না।
   - Existing reports/history retroactively rescore করা হবে না।

4. **Release and verification**
   - Pure Kotlin scoring tests ও web/server regression tests যোগ করা।
   - Android unit tests, web tests, typecheck এবং build যাচাই করা।
   - Android version বাড়িয়ে signed release APK তৈরি করা, download asset/release metadata আপডেট করা এবং বাধ্যতামূলক update হিসেবে প্রস্তুত করা।
   - APK/UI বাস্তব device call test সম্ভব না হলে সেই সীমাবদ্ধতা স্পষ্টভাবে জানানো।

## Technical details
- Existing `ReportSheet`, `WinstoneApi.reportPayload`, WorkManager replay এবং `/api/public/agent/report` contract reuse করা হবে।
- Maintenance control একটি ছোট authenticated-device/public-safe status response হবে; কোনো customer বা agent data প্রকাশ করবে না।
- Existing authentication, role permissions, lead workflow, report gate ও offline idempotency বদলানো হবে না।
