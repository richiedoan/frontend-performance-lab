'use client';
import { useTranslation } from '../i18n/useTranslation';
import Link from 'next/link';
import { LabFooter } from './LabFooter';
import { LanguageSelect } from '../i18n/LanguageSelect';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

const links = [
  ['/', 'Overview'],
  ['/reference', 'Reference'],
  ['/baseline', 'Baseline'],
  ['/optimized', 'Optimized'],
  ['/case-study', 'Case Study'],
] as const;
export function LabFrame({ children }: { children: ReactNode }) {
  const t = useTranslation();

  const pathname = usePathname();
  const menuRef = useRef<HTMLDialogElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  function closeMenu() {
    menuRef.current?.close();
    setMenuOpen(false);
  }
  useEffect(() => {
    const media = window.matchMedia('(min-width: 64.001rem)');
    const closeOnDesktop = () => {
      if (media.matches) menuRef.current?.close();
    };
    media.addEventListener('change', closeOnDesktop);
    return () => media.removeEventListener('change', closeOnDesktop);
  }, []);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches) return;
    const animation = contentRef.current?.animate(
      [
        { opacity: 0, translate: '0 10px' },
        { opacity: 1, translate: '0 0' },
      ],
      { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
    const stopMotion = () => {
      if (preference.matches) animation?.cancel();
    };
    preference.addEventListener('change', stopMotion);
    return () => {
      animation?.cancel();
      preference.removeEventListener('change', stopMotion);
    };
  }, [pathname]);
  const navigation = (
    <>
      <div className="lab-monogram" aria-hidden="true">
        {t('FL')}
        <span>.</span>
      </div>
      <strong>{t('Frontend Lab')}</strong>
      <p>{t('Explore. Compare. Understand.')}</p>
      <nav aria-label={t('Explore lab')}>
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            prefetch={false}
            onClick={closeMenu}
            aria-current={pathname === href ? 'page' : undefined}
          >
            {t.text(label)}
          </Link>
        ))}
      </nav>
      <LanguageSelect />
      <p className="lab-sidebar-note">
        {t('Live Market Explorer')}
        <br />
        {t('Deterministic data. Observable behavior.')}
      </p>
    </>
  );
  return (
    <>
      <div className="lab-layout">
        <header className="lab-mobile-header">
          <strong>{t('Frontend Lab')}</strong>
          <button
            type="button"
            aria-label={t('openMenu')}
            aria-expanded={menuOpen}
            aria-controls="lab-mobile-menu"
            onClick={() => {
              menuRef.current?.showModal();
              setMenuOpen(true);
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 8h16M4 16h16"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        <dialog
          ref={menuRef}
          id="lab-mobile-menu"
          className="lab-mobile-menu"
          aria-label={t('Explore lab')}
          onClose={() => setMenuOpen(false)}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            const box = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < box.left ||
              event.clientX > box.right ||
              event.clientY < box.top ||
              event.clientY > box.bottom
            )
              closeMenu();
          }}
        >
          <aside className="lab-sidebar">
            <button
              type="button"
              className="drawer-close"
              aria-label={t('closeMenu')}
              onClick={closeMenu}
            >
              <span aria-hidden="true">×</span>
            </button>
            {navigation}
          </aside>
        </dialog>
        <aside className="lab-sidebar lab-desktop-sidebar">{navigation}</aside>
        <div ref={contentRef} className="lab-content">
          {children}
        </div>
      </div>
      <LabFooter />
    </>
  );
}
