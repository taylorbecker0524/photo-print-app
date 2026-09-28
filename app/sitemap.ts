import { MetadataRoute } from 'next'

const BASE = 'https://www.archiveyours.com'

// Every page worth indexing, not just the ones in the main flow.
//
// The FAQ and the policy pages were missing, and they are the pages that carry
// the brand name in prose — which is exactly what a search for "Archive Yours"
// needs to match against. Checkout and individual order pages are deliberately
// absent: they are private, and robots.ts blocks them.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return [
    { url: BASE, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/studio`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/archive`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/faq`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/reorder`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/login`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/refund-shipping`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
