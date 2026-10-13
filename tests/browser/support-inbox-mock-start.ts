// Mock of @tanstack/react-start for the support-inbox browser test.
// useServerFn returns the server fn itself; the mocked createServerFn chain
// produces a function that throws while window.__fail is set, and returns a
// valid empty inbox payload otherwise.
declare global {
  interface Window {
    __fail: boolean;
  }
}

type Handler = (args: { data?: unknown }) => Promise<unknown>;

function respond(): Promise<unknown> {
  if (window.__fail) return Promise.reject(new Error("unavailable"));
  return Promise.resolve({ allowed: true, tickets: [], replies: [] });
}

function chain(): { method: () => typeof self; inputValidator: () => typeof self; handler: (fn: Handler) => Handler } {
  const self = {
    method: () => self,
    inputValidator: () => self,
    handler: (_fn: Handler): Handler => () => respond(),
  };
  return self;
}

export function createServerFn() {
  return chain();
}

export function useServerFn<T>(fn: T): T {
  return fn;
}
