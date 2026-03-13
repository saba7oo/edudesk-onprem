// ══════════════════════════════════════════════════════════════
//  EduDesk OnPrem — Next.js Config
//  CloudTitans © 2026
//
//  Used by publish-onprem.sh during the onprem build.
//  Replaces next.config.js in the temp build directory.
// ══════════════════════════════════════════════════════════════

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Mark this as an onprem build — used by instrumentation.ts
  // and middleware.onprem.ts to activate license enforcement
  env: {
    NEXT_PUBLIC_MODE: 'onprem',
  },

  // instrumentation.ts is enabled by default in Next.js 15+
  // no experimental flag needed
}

module.exports = nextConfig
