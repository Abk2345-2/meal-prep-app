import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'Nuskhaa',
  description: 'Never let anything go to waste.',
};

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <AuthProvider>
          <div className="flex-1">{children}</div>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-8 border-t border-slate-100 bg-white">
      <div className="mx-auto max-w-md px-4 py-6">
        {/* Brand */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-lg font-bold text-brand">Nuskhaa</span>
          <span className="text-xs text-slate-400">Never let anything go to waste.</span>
        </div>

        {/* Nav links */}
        <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium text-slate-600">
          <a href="/favorites" className="hover:text-brand transition-colors">Favorites</a>
          <a href="/shopping" className="hover:text-brand transition-colors">Shopping List</a>
          <a href="/reels" className="hover:text-brand transition-colors">Saved Reels</a>
        </div>

        {/* Links */}
        <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
          <a href="/about" className="hover:text-brand transition-colors">About</a>
          <a href="/privacy" className="hover:text-brand transition-colors">Privacy Policy</a>
          <a href="/terms" className="hover:text-brand transition-colors">Terms of Use</a>
          <a href="mailto:hello@nuskhaa.app" className="hover:text-brand transition-colors">Contact</a>
        </div>

        {/* Divider + copyright */}
        <p className="text-xs text-slate-400">
          © {year} Nuskhaa. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
