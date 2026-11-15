// Node ≥ 25 exposes an experimental global `localStorage` that is undefined without --localstorage-file,
// which shadows jsdom's and breaks tests/setup.ts (`localStorage.clear()` in afterEach). These logic tests
// do not use storage; this in-memory stand-in only keeps the shared setup hook from throwing.
// Proper fix belongs in tests/setup.ts or vite.config.ts (not owned by src/logic/agronomy).
const g = globalThis as unknown as { localStorage?: Storage };
if (!g.localStorage) {
  const m = new Map<string, string>();
  const store: Storage = {
    get length() { return m.size; },
    clear: () => m.clear(), getItem: (k) => m.get(k) ?? null, key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => { m.delete(k); }, setItem: (k, v) => { m.set(k, String(v)); },
  };
  Object.defineProperty(globalThis, "localStorage", { value: store, configurable: true, writable: true });
}
export {};
