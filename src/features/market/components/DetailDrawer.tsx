'use client';
import { useTranslation } from '../../../i18n/useTranslation';
import { MARKET_SELECTORS } from './market-selectors';

import Image from 'next/image';
import { useEffect, useId, useRef, type ComponentType } from 'react';
import type { MarketRecord } from '../data/market-record';

export function DetailDrawer({
  record,
  onClose,
  onRestoreFocus,
  Chart,
}: {
  record: MarketRecord | null;
  Chart: ComponentType<{ record: MarketRecord }>;
  onClose: () => void;
  onRestoreFocus?: () => void;
}) {
  const t = useTranslation();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const open = record !== null;
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog?.showModal();
    closeRef.current?.focus();
    return () => {
      dialog?.close();
      if (onRestoreFocus) onRestoreFocus();
      else if (
        previousFocus instanceof HTMLElement &&
        previousFocus.isConnected
      )
        previousFocus.focus();
      else
        document
          .querySelector<HTMLInputElement>('[data-testid="market-search"]')
          ?.focus();
    };
  }, [open, onRestoreFocus]);

  return (
    <dialog
      ref={dialogRef}
      className="market-drawer"
      data-testid={MARKET_SELECTORS.drawer}
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          onClose();
      }}
      onKeyDown={(event) => {
        // Close is the only interactive control in this read-only drawer.
        if (event.key === 'Tab') {
          event.preventDefault();
          closeRef.current?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <button
        ref={closeRef}
        className="drawer-close"
        aria-label={t('Close details')}
        title={t('Close details')}
        data-testid={MARKET_SELECTORS.close}
        type="button"
        onClick={onClose}
      >
        <span aria-hidden="true">×</span>
      </button>
      {record && (
        <>
          <h2 id={titleId}>{record.name}</h2>
          <Image
            className="market-image"
            src={record.image.src}
            alt={t('{name} icon', { name: record.name })}
            width={64}
            height={64}
            unoptimized
          />
          <dl className="market-detail-values">
            <dt>{t('Category')}</dt>
            <dd>{t.text(record.category)}</dd>
            <dt>{t('Status')}</dt>
            <dd>{t.text(record.status)}</dd>
            <dt>{t('Price')}</dt>
            <dd>
              $
              {record.price.toLocaleString(t.locale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
                useGrouping: false,
              })}
            </dd>
            <dt>{t('Change')}</dt>
            <dd>
              {record.change.toLocaleString(t.locale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
                useGrouping: false,
              })}
              %
            </dd>
            <dt>{t('Volume')}</dt>
            <dd>{record.volume.toLocaleString(t.locale)}</dd>
            <dt>{t('Updated')}</dt>
            <dd>
              <time dateTime={record.updatedAt}>{record.updatedAt}</time>
            </dd>
          </dl>
          <Chart record={record} />
        </>
      )}
    </dialog>
  );
}
