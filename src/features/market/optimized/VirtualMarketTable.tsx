'use client';
import { useTranslation } from '../../../i18n/useTranslation';
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { KeyboardEvent, Ref, ReactNode } from 'react';
import { VirtualMarketExpansion } from './VirtualMarketExpansion';
import { TableVirtuoso } from 'react-virtuoso';
import type { TableComponents, TableVirtuosoHandle } from 'react-virtuoso';
import { MarketRowCells, TableHeaderRow } from '../components/MarketTable';
import type { MarketTableProps } from '../components/MarketTable';
import type { MarketRecord } from '../data/market-record';
import { MARKET_SELECTORS as ids } from '../components/market-selectors';

const mobileQuery = '(max-width: 48rem)';
function subscribeMobile(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia(mobileQuery);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
function getMobileSnapshot() {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia(mobileQuery).matches
  );
}
function getServerSnapshot() {
  return false;
}
export const LARGE_LIST_OVERSCAN_PX = 176;
export interface VirtualMarketTableHandle {
  focusRecord: (id: string) => void;
}
interface Entry {
  striped: boolean;
  record: MarketRecord;
  expanded: boolean;
  kind: 'record' | 'expansion';
  index: number;
}
interface TableContext {
  placeholder?: ReactNode;
  loading?: boolean;
  count: number;
}
const components: TableComponents<Entry, TableContext> = {
  EmptyPlaceholder: ({ context }) => (
    <tr className="market-placeholder-row">
      <td colSpan={7}>{context?.placeholder}</td>
    </tr>
  ),
  Table: ({ context, children, ...props }) => {
    const t = useTranslation();
    return (
      <table
        {...props}
        aria-label={t('Market records')}
        className="market-table"
        data-testid={context?.placeholder ? undefined : ids.table}
        aria-busy={context?.loading}
        aria-rowcount={(context?.count ?? 0) + 1}
      >
        {children}
      </table>
    );
  },
  TableRow: ({ item, children, ...props }) => {
    // Context is for component configuration, never a DOM attribute.
    const { context, ...rowProps } = props;
    void context;
    return (
      <tr
        {...rowProps}
        className={
          item.kind === 'record' ? 'market-row' : 'market-expansion-row'
        }
        data-striped={item.striped}
        data-expanded={item.expanded}
        aria-rowindex={item.index + 2}
        id={
          item.kind === 'expansion'
            ? `virtual-expanded-${item.record.id}`
            : undefined
        }
        data-testid={
          item.kind === 'record' ? ids.row : ids.expanded(item.record.id)
        }
        data-market-id={item.kind === 'record' ? item.record.id : undefined}
      >
        {children}
      </tr>
    );
  },
};

export function VirtualMarketTable({
  placeholder,
  loading,
  records,
  sort,
  onSort,
  onSelect,
  expansion,
  resetKey,
  ref,
}: MarketTableProps & {
  resetKey: string;
  ref?: Ref<VirtualMarketTableHandle>;
}) {
  const t = useTranslation();

  const mobile = useSyncExternalStore(
    subscribeMobile,
    getMobileSnapshot,
    getServerSnapshot,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const handle = useRef<TableVirtuosoHandle>(null);
  const scrollRef = useRef<HTMLElement | null>(null);
  const focusedId = useRef<string | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const frame = useRef<number | null>(null);
  const scrollFrame = useRef<number | null>(null);
  const entries: Entry[] = [];
  for (const [recordIndex, record] of records.entries()) {
    const striped = recordIndex % 2 === 1;
    const expanded = expansion?.expandedIds.includes(record.id) ?? false;
    entries.push({
      record,
      striped,
      expanded,
      kind: 'record',
      index: entries.length,
    });
    if (expanded)
      entries.push({
        record,
        striped,
        expanded,
        kind: 'expansion',
        index: entries.length,
      });
  }
  function finishFocus() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (!pendingFocus.current) {
        // itemsRendered can fire before React removes the old row. Inspect after commit.
        if (focusedId.current && document.activeElement === document.body)
          scrollRef.current?.focus({ preventScroll: true });
        return;
      }
      const button = scrollRef.current?.querySelector<HTMLButtonElement>(
        `[data-testid="${pendingFocus.current}"]`,
      );
      if (button) {
        button.focus();
        pendingFocus.current = null;
      }
    });
  }
  function moveFocus(id: string, action: 'expand' | 'detail') {
    const index = entries.findIndex(
      (entry) => entry.kind === 'record' && entry.record.id === id,
    );
    if (index < 0) {
      document
        .querySelector<HTMLInputElement>('[data-testid="market-search"]')
        ?.focus();
      return;
    }
    focusedId.current = id;
    pendingFocus.current = ids[action](id);
    // Defer until the drawer cleanup and Virtuoso's data update have committed.
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      handle.current?.scrollIntoView({ index, done: finishFocus });
      finishFocus();
    });
  }
  useImperativeHandle(ref, () => ({
    focusRecord: (id) => moveFocus(id, 'detail'),
  }));
  useEffect(() => {
    handle.current?.scrollTo({ top: 0 });
  }, [resetKey]);
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (scrollFrame.current !== null)
        cancelAnimationFrame(scrollFrame.current);
    },
    [],
  );
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (!(event.target instanceof HTMLElement)) return;
    const row = event.target.closest('[data-market-id]');
    const id =
      row?.getAttribute('data-market-id') ??
      (event.target === scrollRef.current ? focusedId.current : null);
    const index = records.findIndex((record) => record.id === id);
    if (index < 0) return;
    const detail =
      event.target.dataset.testid === ids.detail(records[index].id);
    let next: number | undefined;
    let action: 'expand' | 'detail' = detail ? 'detail' : 'expand';
    if (event.key === 'ArrowDown') next = index + 1;
    if (event.key === 'ArrowUp') next = index - 1;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = records.length - 1;
    if (event.key === 'Tab' && !event.shiftKey && detail) {
      next = index + 1;
      action = expansion ? 'expand' : 'detail';
    }
    if (event.key === 'Tab' && event.shiftKey && (!detail || !expansion)) {
      next = index - 1;
      action = 'detail';
    }
    if (next !== undefined && next >= 0 && next < records.length) {
      event.preventDefault();
      moveFocus(records[next].id, action);
    }
  }
  return (
    <div ref={containerRef} tabIndex={-1}>
      <TableVirtuoso<Entry, TableContext>
        ref={handle}
        useWindowScroll={mobile}
        data={entries}
        context={{ count: entries.length, placeholder, loading }}
        components={components}
        className="market-table-scroll virtual-market-scroll"
        style={mobile ? undefined : { height: 'min(560px, 70vh)' }}
        data-window-scroll={mobile}
        data-testid="market-virtual-scroll"
        data-overscan-px={mobile ? 600 : LARGE_LIST_OVERSCAN_PX}
        role="region"
        aria-label={t('Market records')}
        tabIndex={0}
        scrollerRef={(element) => {
          scrollRef.current =
            element instanceof HTMLElement ? element : containerRef.current;
        }}
        computeItemKey={(_, entry) => `${entry.record.id}:${entry.kind}`}
        defaultItemHeight={mobile ? undefined : 88}
        increaseViewportBy={{
          top: mobile ? 600 : LARGE_LIST_OVERSCAN_PX,
          bottom: mobile ? 600 : LARGE_LIST_OVERSCAN_PX,
        }}
        onKeyDown={keyboard}
        onFocusCapture={(event) => {
          const row = event.target.closest('[data-market-id]');
          if (row) focusedId.current = row.getAttribute('data-market-id');
        }}
        itemsRendered={finishFocus}
        fixedHeaderContent={() => (
          <TableHeaderRow sort={sort} onSort={onSort} />
        )}
        itemContent={(_, entry) =>
          entry.kind === 'expansion' ? (
            <VirtualMarketExpansion record={entry.record} />
          ) : (
            <MarketRowCells
              record={entry.record}
              expanded={entry.expanded}
              onSelect={onSelect}
              onToggle={expansion?.onToggle}
              expansionId={
                entry.expanded
                  ? `virtual-expanded-${entry.record.id}`
                  : undefined
              }
            />
          )
        }
      />
    </div>
  );
}
