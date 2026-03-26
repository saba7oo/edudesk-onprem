// ══════════════════════════════════════════════════════════════
//  EduDesk OnPrem — Next.js Config
//  CloudTitans © 2026
// ══════════════════════════════════════════════════════════════

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_MODE: 'onprem',
  },
  // Disable Turbopack for on-prem builds — use stable Webpack instead.
  // Turbopack has a known async-module deps bug in Next.js 16.x that
  // causes TypeError: Cannot read properties of undefined (reading 'map')
  // on server startup.
  experimental: {
    turbopack: false,
  },
}

module.exports = nextConfig
