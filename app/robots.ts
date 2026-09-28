import { MetadataRoute } from 'next'

// Without this file the site had no /robots.txt at all — the URL 404'd.
//
// A missing robots.txt does not block crawling (an absent file means "crawl
// everything"), but it is the one place every crawler looks first, and it is
// where the sitemap is meant to be advertised. Google finds the sitemap from
// Search Console too; Bing and everything else find it here or not at all.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Nothing here is secret — these are simply pages with no business in
        // an index. A crawler spending its budget on a checkout form is
        // budget not spent on the pages meant to rank.
        disallow: ['/api/', '/checkout', '/orders/'],
      },
    ],
    sitemap: 'https://www.archiveyours.com/sitemap.xml',
  }
}
