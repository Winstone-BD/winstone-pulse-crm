# টেস্ট / Testing

```sh
bunx vitest run       # সব টেস্ট (শুধু tests/ ফোল্ডার স্ক্যান হয়)
bunx tsgo --noEmit    # টাইপ চেক
bun run build         # প্রোডাকশন বিল্ড
```

**গুরুত্বপূর্ণ:** টেস্ট ফাইল অবশ্যই `tests/`-এ রাখতে হবে — `src/**/__tests__` স্ক্যান হয় না।

## এখন যা ঢাকা আছে

| ফাইল | কী যাচাই করে |
| --- | --- |
| `admin-gate.test.ts` | PIN টোকেন, ভূমিকা গেট |
| `rbac-matrix.test.ts` | কোন ভূমিকা কী দেখে; ইনবক্স ≠ বিতরণ; কোটা ১৫/২৫ |
| `lead-ownership.test.ts` | এজেন্ট শুধু নিজের লিড |
| `lead-quota.test.ts` | কোটা, effective quota, completion % |
| `call-report-rules.test.ts` | পোস্ট-কল রিপোর্টের বাধ্যবাধকতা |
| `classification-review*.test.ts` | AI বনাম এজেন্টের শ্রেণিবিন্যাস অমিল |
| `shift-and-import.test.ts` | শিফট সারসংক্ষেপ, লিড ইম্পোর্ট গণনা |
| `service-billing-alerts.test.ts` | due / overdue ধাপ, একবারই অ্যালার্ট |
| `team-support-shared.test.ts` | সাপোর্ট লেবেল, গুরুত্বের ক্রম, বাছাই |
| `top-performer.test.ts` | সেরা পারফর্মার র‍্যাঙ্কিং, টাই-ব্রেক |
| `rls.test.ts` | লাইভ ডেটাবেজে RLS (২৫টি যাচাই) |

## এখনো বাকি

- ফোনের পুশ পাঠানোর পথ — Firebase সংযুক্ত না হওয়া পর্যন্ত শুধু `skipped` পথ যাচাইযোগ্য।
- ইমেইল টেমপ্লেট রেন্ডার — DNS যাচাই শেষ হলে।
- রিপোর্ট ও HQ পাতার UI — কম্পোনেন্টে ভাগ হওয়ার পর কম্পোনেন্ট-স্তরের টেস্ট যোগ করা যাবে।
- অ্যান্ড্রয়েড রেকর্ডিং → Drive → ট্রান্সক্রিপ্ট (আসল ফোন ছাড়া যাচাই সম্ভব নয়)।
