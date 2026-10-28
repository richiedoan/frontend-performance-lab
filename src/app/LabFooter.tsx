'use client';

import { useTranslation } from '../i18n/useTranslation';

export function LabFooter() {
  const t = useTranslation();
  return (
    <footer className="lab-footer">
      <div className="lab-footer-inner">
        <p>© 2026 Richie Doan</p>
        <p>{t('footerAiAssistance')}</p>
      </div>
    </footer>
  );
}
