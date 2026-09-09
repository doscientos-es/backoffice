import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  // These packages use Node.js runtime APIs and bundled filesystem resources;
  // keep them external to avoid Turbopack resolving those resources at build time.
  // pdfjs-dist: the bundled chunk breaks at module evaluation on Vercel
  // (500 on /internal-docs/[id]); requiring it from node_modules works.
  serverExternalPackages: ['@doscientos/verifactu', '@react-pdf/renderer', 'pdfjs-dist'],
  // `libxmljs2` resolves its platform-specific `xmljs.node` binding at runtime.
  // Include it explicitly so Vercel's output tracing retains the Linux binding
  // used by the AEAT XSD validation path.
  // `pdfjs-dist` (externalized above) lazily loads `pdf.worker.mjs` when parsing
  // PDFs; static tracing only follows `pdf.mjs`, so ship the whole legacy build.
  outputFileTracingIncludes: {
    '/*': ['./node_modules/libxmljs2/**/*', './node_modules/pdfjs-dist/legacy/build/**/*'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'hnzyllbksqvamqfubhri.supabase.co' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}

export default config
