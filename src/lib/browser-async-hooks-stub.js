// Browser-safe stand-in for `node:async_hooks`.
//
// TanStack Start's storage-context module instantiates `new AsyncLocalStorage()`
// at module load in every environment. In the browser Vite externalises
// `node:async_hooks` to an empty warning proxy, so the constructor is undefined
// and the throw "AsyncLocalStorage is not a constructor" kills the
// server-function client before it can read the session — pages silently render
// signed out and no board or widget loads.
//
// The client never needs a real context: `getStartOptions()` reads
// `window.__TSS_START_OPTIONS__` on the client, so a no-op store is enough.
export class AsyncLocalStorage {
  getStore() {
    return undefined;
  }
  getStores() {
    return new Set();
  }
  run(_store, callback, ...args) {
    return callback(...args);
  }
  enterWith() {}
  exit() {}
  disable() {}
}

export default { AsyncLocalStorage };
