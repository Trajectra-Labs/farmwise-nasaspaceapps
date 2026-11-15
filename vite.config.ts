/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Aliases for other owners' modules. In this standalone Moen workstream they point to harness/
// stand-ins; at integration re-point them to src/contracts, src/ui, src/core, src/data/nasa (Ted),
// src/data/simulated (Abdullah). Moen's code never imports harness/ paths directly.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export const aliases = {
  "@fw/contracts": r("./harness/contracts/farmwise.ts"),
  "@fw/ui": r("./harness/ui/index.tsx"),
  "@fw/core": r("./harness/core/index.tsx"),
  "@fw/nasa": r("./harness/nasa/index.ts"),
  "@fw/simulated": r("./harness/simulated/index.ts"),
};
export default defineConfig({
  plugins: [react()],
  resolve: { alias: aliases },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/unit/**/*.test.{ts,tsx}"],
    css: false,
  },
});
