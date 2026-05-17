import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://www.archiveyours.com', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://www.archiveyours.com/studio', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://www.archiveyours.com/login', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://www.archiveyours.com/orders', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ]
}
