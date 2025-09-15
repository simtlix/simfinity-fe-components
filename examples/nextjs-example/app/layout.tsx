import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import EmotionRegistry from '@/lib/registry';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Simfinity Components - Next.js Example',
  description: 'Example Next.js app using simfinity-fe-components',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <EmotionRegistry>
          {children}
        </EmotionRegistry>
      </body>
    </html>
  );
}
