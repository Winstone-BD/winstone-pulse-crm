# Winstone CRM — নথিপত্র / Documentation index

বাংলা UI-র CRM, SIM-first কলিং (এজেন্টের নিজের সিম + অ্যান্ড্রয়েড অ্যাপ)।

| ফাইল | কী আছে |
| --- | --- |
| [architecture.md](./architecture.md) | ফোল্ডার কাঠামো, কোন ফাইল কী করে, ডেটার পথ |
| [roles-and-permissions.md](./roles-and-permissions.md) | কোন ভূমিকা কী দেখে, কোন গেট কোথায় |
| [features.md](./features.md) | ফিচারভিত্তিক তালিকা — প্রতিটির ফাইল ও টেবিল |
| [integrations.md](./integrations.md) | বাইরের সংযোগের সত্যিকারের অবস্থা (চালু / বাকি) |
| [conventions.md](./conventions.md) | নামকরণ, ফোল্ডার ভাগ, নতুন কোড লেখার নিয়ম |
| [testing.md](./testing.md) | টেস্ট কী ঢাকা আছে, কী বাকি, কীভাবে চালাবেন |

## দ্রুত শুরু

```sh
bun install
bun run dev          # http://localhost:8080
bunx tsgo --noEmit   # টাইপ চেক
bunx vitest run      # টেস্ট
bun run build        # প্রোডাকশন বিল্ড
```
