import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "*.test.{ts,tsx}",
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

        // ── Type-only modules (no runtime statements to cover) ───────────
        "lib/**/types.ts",

        // ── Framework wiring / config (no business logic) ────────────────
        "lib/env.ts",
        "lib/auth.ts",

        // ── Data-access layers: Supabase query builders. These assert
        //    mock call shapes only; they belong to integration/e2e suites.
        "lib/**/queries.ts",

        // ── External-service clients & integrations (network I/O) ────────
        "lib/ai.ts",
        "lib/supabase/**",
        "lib/integrations/**",
        "lib/email/resend.ts",
        "lib/email/render.ts",

        // ── Client-side React hooks needing a DOM/render + network harness ─
        //    (use-form-dirty is pure and remains covered.)
        "lib/hooks/use-action-form.ts",
        "lib/hooks/use-autosave.ts",
        "lib/hooks/use-github-handle.ts",

        // ── React PDF component (visual, not logic) ───────────────────────
        "lib/invoices/invoice-pdf-document.tsx",

        // ── Scheduled / background jobs ───────────────────────────────────
        "lib/marketing-sync.ts",

        // ── Test files ────────────────────────────────────────────────────
        "lib/**/*.test.{ts,tsx}",
      ],

      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",

      // Color thresholds in the HTML report: <50 % → red, 50–80 % → yellow, ≥80 % → green
      watermarks: {
        statements: [50, 80],
        branches: [50, 80],
        functions: [50, 80],
        lines: [50, 80],
      },

      // Enforced minimums – CI fails below 80 % global on every metric.
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
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
