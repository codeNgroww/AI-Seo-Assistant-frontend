import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI SEO Assistant | Space42 Arena Admin',
  description: 'Admin-only AI SEO Assistant prototype featuring PII redaction, Mock LLM generation, and Human-in-the-Loop approval workflows.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-['Plus_Jakarta_Sans',sans-serif] bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
