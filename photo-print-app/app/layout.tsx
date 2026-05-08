import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Photo Print Studio — Print Your Memories',
  description: 'Upload your photos, add date and location stamps, and we print and ship them straight to your door.',
  openGraph: {
    title: 'Photo Print Studio',
    description: 'Premium photo prints, shipped to your door.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-stone-50 text-stone-900 min-h-screen">
        <nav className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <a href="/" className="font-display text-xl font-semibold tracking-tight">
              Print<span className="text-brand-600">Studio</span>
            </a>
            <a
              href="/orders"
              className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
            >
              Track my order
            </a>
          </div>
        </nav>
        <main>{children}</main>
        <footer className="border-t border-stone-200 mt-24 py-10 text-center text-xs text-stone-400">
          © {new Date().getFullYear()} PrintStudio · All prints are fulfilled by our print partners ·{' '}
          <a href="mailto:hello@yourprintshop.com" className="hover:text-stone-600">Contact us</a>
        </footer>
      </body>
    </html>
  )
}
