import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: { default: "MESHUKO'S S AND G FARM | Sheep & Goat Records", template: "%s | MESHUKO'S S AND G FARM" },
  description: 'Professional sheep and goat farm record keeping, daily stock reports, running livestock quantities and transfers.',
  applicationName: "MESHUKO'S S AND G FARM",
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg', apple: '/app-icon.png' },
  manifest: '/manifest.webmanifest',
  openGraph: { title: "MESHUKO'S S AND G FARM", description: 'Sheep & goat farm records, made clear.', type: 'website' }
};

export const viewport: Viewport = {
  themeColor: '#173c30',
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
