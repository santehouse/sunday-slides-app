import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/unit/setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // `server-only` throws unconditionally outside a Next.js server bundle (it only
      // no-ops via the "react-server" webpack/turbopack resolve condition) — swap in a
      // no-op stub so server-only modules (auth, data, r2, resend, openai, ...) are
      // importable from Vitest, which runs in plain Node/jsdom.
      "server-only": path.resolve(__dirname, "scripts/stubs/server-only-stub.ts"),
    },
  },
});
