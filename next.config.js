// ══════════════════════════════════════════════════════════════
//  EduDesk OnPrem — Next.js Config
//  CloudTitans © 2026
// ══════════════════════════════════════════════════════════════

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_MODE: 'onprem',
  },
  // Keep ldapts and its deps (tr46, whatwg-url) out of the Turbopack bundle —
  // they use dynamic JSON requires that Turbopack can't resolve at build time.
  serverExternalPackages: ['ldapts', 'whatwg-url', 'tr46'],
  // Never emit source maps in onprem build — they would expose source code in the public repo
  productionBrowserSourceMaps: false,
}

module.exports = nextConfig
