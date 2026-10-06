import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Senior Assistant',
  description: 'Voice-first AI assistant for elderly Thai users',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: true,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="bg-senior-bg text-senior-text antialiased">{children}</body>
    </html>
  );
}
