import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { LabFooter } from './LabFooter';
import { TranslationProvider } from '../i18n/useTranslation';
import { LanguageSelect } from '../i18n/LanguageSelect';

it('credits the author and translates the AI assistance text', () => {
  render(
    <TranslationProvider>
      <LanguageSelect />
      <LabFooter />
    </TranslationProvider>,
  );
  expect(screen.getByRole('contentinfo')).toHaveTextContent(
    '© 2026 Richie Doan',
  );
  expect(screen.getByText('Built with AI assistance.')).toBeVisible();
  fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), {
    target: { value: 'vi' },
  });
  expect(screen.getByRole('contentinfo')).toHaveTextContent(
    'Được xây dựng với sự hỗ trợ của AI.',
  );
  expect(screen.getByRole('contentinfo')).toHaveTextContent(
    '© 2026 Richie Doan',
  );
});
