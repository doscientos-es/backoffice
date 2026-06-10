import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "tests/**/*.test.{ts,tsx}",
      "lib/**/*.test.{ts,tsx}",
      "components/**/*.test.{ts,tsx}",
      "app/**/*.test.{ts,tsx}",
    ],
    // Safety net for slow tests (e.g. file-upload tests allocating large buffers).
    // Per-test overrides take precedence when a specific test needs more time.
    testTimeout: 10_000,

    coverage: {
      provider: "v8",

      // Measure only lib/ – app/ and components/ are Next.js UI surfaces
      // that require a browser/server runtime and are covered by e2e tests.
      include: ["lib/**/*.{ts,tsx}"],

      exclude: [
        // ── Auto-generated ───────────────────────────────────────────────
        "lib/database.types.ts",

        // ── Framework wiring / config (no business logic) ────────────────
        "lib/env.ts",
        "lib/auth.ts",

        // ── Thin external-service clients (no logic to unit-test) ────────
        "lib/ai.ts",
        "lib/supabase/**",
        "lib/email/resend.ts",

        // ── React PDF component (visual, not logic) ───────────────────────
        "lib/invoices/invoice-pdf-document.tsx",

        // ── Scheduled / background jobs ───────────────────────────────────
        "lib/marketing-sync.ts",

        // ── Test files ────────────────────────────────────────────────────
        "lib/**/*.test.{ts,tsx}",
      ],

      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",

      // Color thresholds in the HTML report: <50 % → red, 50–80 % → yellow, ≥80 % → green
      watermarks: {
        statements: [50, 80],
        branches:   [50, 80],
        functions:  [50, 80],
        lines:      [50, 80],
      },

      // Uncomment to enforce minimum coverage and fail CI below these values:
      // thresholds: {
      //   lines:      60,
      //   functions:  60,
      //   branches:   55,
      //   statements: 60,
      // },
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Marker packages provided by the Next.js bundler at build time; map them
      // to a no-op so server-guarded modules can be imported in tests.
      "server-only": path.resolve(__dirname, "tests/stubs/empty-module.ts"),
      "client-only": path.resolve(__dirname, "tests/stubs/empty-module.ts"),
    },
  },
});
