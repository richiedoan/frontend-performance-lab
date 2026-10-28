'use client';

import { useId } from 'react';
import { useLanguage, useTranslation } from './useTranslation';

export function LanguageSelect() {
  const { language, setLanguage } = useLanguage();
  const t = useTranslation();
  const id = useId();
  return (
    <div className="overview-language">
      <label htmlFor={id}>{t('language')}</label>
      <select
        id={id}
        value={language}
        onChange={(event) => {
          if (event.target.value === 'en' || event.target.value === 'vi')
            setLanguage(event.target.value);
        }}
      >
        <option value="en" lang="en">
          English
        </option>
        <option value="vi" lang="vi">
          Tiếng Việt
        </option>
      </select>
    </div>
  );
}
