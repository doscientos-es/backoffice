import path from "node:path";
import type { NextConfig } from "next";

const usesLocalUi = process.env.DOSCIENTOS_UI_DEV_LINK === "true";
const localReactAliases = usesLocalUi
  ? {
    react: path.join(__dirname, "node_modules/react"),
    "react-dom": path.join(__dirname, "node_modules/react-dom"),
    "react-dom/client": path.join(__dirname, "node_modules/react-dom/client"),
    "react-dom/server": path.join(__dirname, "node_modules/react-dom/server"),
    "react/jsx-runtime": path.join(__dirname, "node_modules/react/jsx-runtime"),
    "react/jsx-dev-runtime": path.join(__dirname, "node_modules/react/jsx-dev-runtime"),
  }
  : undefined;

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  // Only the local junction needs transpilation and a wider watch root.
  // Production consumes the compiled package published to npm.
  transpilePackages: usesLocalUi ? ["@doscientos/ui"] : [],
  turbopack: {
    root: usesLocalUi ? path.resolve(__dirname, "../..") : __dirname,
    resolveAlias: localReactAliases,
  },
  // These packages use Node.js runtime APIs and bundled filesystem resources;
  // keep them external to avoid Turbopack resolving those resources at build time.
  serverExternalPackages: ["@doscientos/verifactu", "@react-pdf/renderer"],
  // `libxmljs2` resolves its platform-specific `xmljs.node` binding at runtime.
  // Include it explicitly so Vercel's output tracing retains the Linux binding
  // used by the AEAT XSD validation path.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/libxmljs2/**/*"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "hnzyllbksqvamqfubhri.supabase.co" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default config;
