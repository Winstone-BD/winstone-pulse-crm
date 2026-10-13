// Bundles the support-inbox test entry, redirecting @tanstack/react-start and
// @/lib/local-session to browser-safe mocks. Run: bun tests/browser/build-support-inbox.ts
import { type BunPlugin } from "bun";

const mockPlugin: BunPlugin = {
  name: "support-inbox-mocks",
  setup(build) {
    build.onResolve({ filter: /^@tanstack\/react-start/ }, () => ({
      path: "/dev-server/tests/browser/support-inbox-mock-start.ts",
    }));
    build.onResolve({ filter: /^@\/lib\/local-session$/ }, () => ({
      path: "/dev-server/tests/browser/support-inbox-mock-session.ts",
    }));
    build.onResolve({ filter: /^@\/lib\/team-support\.functions$/ }, () => ({
      path: "/dev-server/tests/browser/support-inbox-mock-functions.ts",
    }));
    build.onResolve({ filter: /^@\/lib\/web-push$/ }, () => ({
      path: "/dev-server/tests/browser/support-inbox-mock-web-push.ts",
    }));
  },
};

const result = await Bun.build({
  entrypoints: ["tests/browser/support-inbox.entry.tsx"],
  plugins: [mockPlugin],
  define: { "process.env.NODE_ENV": '"production"' },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

await Bun.write("/tmp/support-inbox.js", await result.outputs[0].text());
