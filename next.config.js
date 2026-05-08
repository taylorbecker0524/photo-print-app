/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  // Needed for Sharp image processing in API routes
  serverExternalPackages: ['sharp'],
}

module.exports = nextConfig
