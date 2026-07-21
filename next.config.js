/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enables instrumentation.ts (startup env validation). Required in Next 14.x;
  // becomes the default in Next 15.
  experimental: {
    instrumentationHook: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
}

module.exports = nextConfig
