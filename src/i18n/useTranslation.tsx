'use client';

import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { en } from './languages/en';
import { vi } from './languages/vi';
import { enUi, viUi } from './languages/ui';

export type TranslationKey = keyof typeof en | keyof typeof enUi;
export type Language = 'en' | 'vi';
const dictionaries = { en: { ...en, ...enUi }, vi: { ...vi, ...viUi } };
const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
} | null>(null);

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('TranslationProvider is required');
  return context;
}

export function useTranslation() {
  // Standalone presentation components use English when rendered outside the app shell.
  const language = useContext(LanguageContext)?.language ?? 'en';
  return useMemo(() => {
    const dictionary = dictionaries[language];
    const format = (
      key: TranslationKey,
      values: Record<string, string | number> = {},
    ) =>
      dictionary[key].replace(/\{(\w+)\}/g, (match, name: string) =>
        values[name] === undefined ? match : String(values[name]),
      );
    // API and evidence copy stays in its source language when no translation is known.
    const text = (source: string): string => {
      if (Object.hasOwn(dictionary, source))
        return dictionary[source as TranslationKey];
      const patterns: [RegExp, TranslationKey, string[]][] = [
        [
          /^Unable to load markets \(HTTP (\d+)\)\. Check the dataset parameters and retry\.$/,
          'Unable to load markets (HTTP {status}). Check the dataset parameters and retry.',
          ['status'],
        ],
        [/^Unknown parameter: (.+)$/, 'Unknown parameter: {key}', ['key']],
        [/^Duplicate parameter: (.+)$/, 'Duplicate parameter: {key}', ['key']],
        [
          /^scenario must be one of: (.+)$/,
          'scenario must be one of: {scenarios}',
          ['scenarios'],
        ],
        [
          /^(.+) must be an integer between (.+) and (.+)$/,
          '{key} must be an integer between {min} and {max}',
          ['key', 'min', 'max'],
        ],
        [
          /^(.+) must be a finite number between (.+) and (.+)$/,
          '{key} must be a finite number between {min} and {max}',
          ['key', 'min', 'max'],
        ],
        [
          /^Market request failed \((\d+)\)$/,
          'Market request failed ({status})',
          ['status'],
        ],
      ];
      for (const [pattern, key, names] of patterns) {
        const match = source.match(pattern);
        if (match)
          return format(
            key,
            Object.fromEntries(
              names.map((name, index) => [name, match[index + 1]]),
            ),
          );
      }
      return source;
    };
    return Object.assign(format, {
      text,
      locale: language === 'vi' ? 'vi-VN' : 'en-US',
    });
  }, [language]);
}
