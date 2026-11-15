import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Node >= 25 exposes a global `localStorage` that is undefined/inert without --localstorage-file,
// shadowing jsdom's. Install an in-memory Storage when the global one is unusable.
function storageWorks(): boolean {
  try { const s = globalThis.localStorage; s.setItem("__fw", "1"); s.removeItem("__fw"); return true; } catch { return false; }
}
if (!storageWorks()) {
  const mem = new Map<string, string>();
  const storage: Storage = {
    get length() { return mem.size; },
    clear: () => mem.clear(),
    getItem: (k) => (mem.has(k) ? mem.get(k)! : null),
    key: (i) => [...mem.keys()][i] ?? null,
    removeItem: (k) => { mem.delete(k); },
    setItem: (k, v) => { mem.set(k, String(v)); },
  };
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true, writable: true });
  if (typeof window !== "undefined") Object.defineProperty(window, "localStorage", { value: storage, configurable: true, writable: true });
}
afterEach(() => { cleanup(); localStorage.clear(); document.body.style.overflow = ""; });
// Recharts' ResponsiveContainer needs ResizeObserver in jsdom.
class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver ??= RO;
