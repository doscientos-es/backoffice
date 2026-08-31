import path from 'node:path'

import type { NextConfig } from 'next'

const usesLocalUi = process.env.DOSCIENTOS_UI_DEV_LINK === 'true'
const localUiRoot = path.resolve(__dirname, '../../modules/ui')
const localUiAliases = {
  '@doscientos/ui': path.join(localUiRoot, 'src/index.ts'),
  '@doscientos/ui/styles.css': path.join(localUiRoot, 'src/styles.css'),
  react: path.join(__dirname, 'node_modules/react'),
  'react-dom': path.join(__dirname, 'node_modules/react-dom'),
  'react-dom/client': path.join(__dirname, 'node_modules/react-dom/client'),
  'react-dom/server': path.join(__dirname, 'node_modules/react-dom/server'),
  'react/jsx-runtime': path.join(__dirname, 'node_modules/react/jsx-runtime'),
  'react/jsx-dev-runtime': path.join(__dirname, 'node_modules/react/jsx-dev-runtime'),
}

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  // Development resolves UI source directly, while production uses npm.
  turbopack: {
    root: usesLocalUi ? path.resolve(__dirname, '../..') : __dirname,
    resolveAlias: usesLocalUi ? localUiAliases : undefined,
  },
  // These packages use Node.js runtime APIs and bundled filesystem resources;
  // keep them external to avoid Turbopack resolving those resources at build time.
  serverExternalPackages: ['@doscientos/verifactu', '@react-pdf/renderer'],
  // `libxmljs2` resolves its platform-specific `xmljs.node` binding at runtime.
  // Include it explicitly so Vercel's output tracing retains the Linux binding
  // used by the AEAT XSD validation path.
  outputFileTracingIncludes: {
    '/*': ['./node_modules/libxmljs2/**/*'],
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
