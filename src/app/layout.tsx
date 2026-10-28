import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../styles/market.css';
import { TranslationProvider } from '../i18n/useTranslation';
import { LabFrame } from './LabFrame';

export const metadata: Metadata = {
  title: 'Frontend Performance Lab',
  description: 'A lab for comparing frontend performance.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TranslationProvider>
          <LabFrame>{children}</LabFrame>
        </TranslationProvider>
      </body>
    </html>
  );
}
