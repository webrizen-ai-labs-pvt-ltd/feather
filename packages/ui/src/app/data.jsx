/** Tables, tabs, progress meters and pagination built on Untitled UI. */
import { useMemo, useState } from 'react';
import { PaginationCardMinimal } from '@uui/components/application/pagination/pagination';
import { Table, TableCard } from '@uui/components/application/table/table';
import { Tab, TabList, TabPanel, Tabs as UuiTabs } from '@uui/components/application/tabs/tabs';
import { ButtonGroup, ButtonGroupItem } from '@uui/components/base/button-group/button-group';
import { ProgressBarBase } from '@uui/components/base/progress-indicators/progress-indicators';
import { cx } from '@uui/utils/cx';
import { EmptyState } from './basics.jsx';

/**
 * Data table on Untitled UI's Table (React Aria: keyboard + screen-reader friendly).
 * columns = [{ key, header, render?(row), align?, sortable?, sortValue?(row), className? }]
 * Pass `title` (+ `subtitle`, `actions`, `badge`) to wrap it in a card with a header.
 */
export function DataTable({
  columns,
  rows,
  rowKey = (r) => r._id,
  onRowClick,
  empty = 'Nothing to show yet.',
  emptyIcon,
  dense,
  title,
  subtitle,
  actions,
  badge,
  footer,
  label,
  className,
}) {
  const [sort, setSort] = useState(null);
  const sorted = useMemo(() => {
    if (!sort || !rows) return rows ?? [];
    const col = columns.find((c) => c.key === sort.column);
    const get = col?.sortValue ?? ((r) => r[sort.column]);
    const dir = sort.direction === 'ascending' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x == null) return 1;
      if (y == null) return -1;
      return (x > y ? 1 : x < y ? -1 : 0) * dir;
    });
  }, [rows, sort, columns]);

  const size = dense ? 'sm' : 'md';
  const body = !rows?.length ? (
    <EmptyState title={empty} icon={emptyIcon} />
  ) : (
    <Table
      aria-label={label ?? title ?? 'Table'}
      size={size}
      sortDescriptor={sort ?? undefined}
      onSortChange={setSort}
      onRowAction={onRowClick ? (key) => onRowClick(rows.find((r) => String(rowKey(r)) === String(key))) : undefined}
    >
      <Table.Header>
        {columns.map((c, i) => (
          <Table.Head
            key={c.key}
            id={c.key}
            label={c.header}
            isRowHeader={i === 0}
            allowsSorting={Boolean(c.sortable)}
            className={cx(c.align === 'right' && '[&>div]:justify-end', size === 'sm' ? 'px-5' : 'px-6')}
          />
        ))}
      </Table.Header>
      <Table.Body items={sorted.map((r) => ({ ...r, __key: String(rowKey(r)) }))}>
        {(row) => (
          <Table.Row id={row.__key} className={cx(onRowClick && 'cursor-pointer')}>
            {columns.map((c) => (
              <Table.Cell key={c.key} className={cx('whitespace-nowrap tabular-nums', c.align === 'right' && 'text-right', c.className)}>
                {c.render ? c.render(row) : row[c.key]}
              </Table.Cell>
            ))}
          </Table.Row>
        )}
      </Table.Body>
    </Table>
  );

  if (!title) return <div className={className}>{body}</div>;
  return (
    <TableCard.Root size={size} className={className}>
      <TableCard.Header title={title} description={subtitle} badge={badge} contentTrailing={actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>} />
      {body}
      {footer}
    </TableCard.Root>
  );
}

/** Page-based pagination bar for a table card. */
export function Pager({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;
  return <PaginationCardMinimal page={page} total={pages} onPageChange={onChange} align="right" />;
}

/** Tabs. tabs = [{ label, content, count?, icon? }] */
export function Tabs({ tabs, selectedIndex, onChange, className, type = 'underline' }) {
  const [inner, setInner] = useState(0);
  const index = selectedIndex ?? inner;
  const keys = tabs.map((t, i) => `t${i}`);
  return (
    <UuiTabs
      className={className}
      selectedKey={keys[index]}
      onSelectionChange={(k) => {
        const i = keys.indexOf(String(k));
        setInner(i);
        onChange?.(i);
      }}
    >
      <TabList type={type} size="sm" className="overflow-x-auto scrollbar-hide">
        {tabs.map((t, i) => (
          <Tab key={keys[i]} id={keys[i]} label={t.label} badge={t.count !== undefined ? String(t.count) : undefined} icon={t.icon} />
        ))}
      </TabList>
      {tabs.map((t, i) => (
        <TabPanel key={keys[i]} id={keys[i]} className="pt-5">
          {t.content}
        </TabPanel>
      ))}
    </UuiTabs>
  );
}

const METER_COLOR = { brand: 'bg-fg-brand-primary', good: 'bg-fg-success-secondary', warn: 'bg-fg-warning-secondary', bad: 'bg-fg-error-secondary', gray: 'bg-fg-quaternary' };

/** Progress bar for a value against a maximum (credit used, shipment unloaded…). */
export function Meter({ value, max, tone = 'brand', className }) {
  const v = Math.min(Math.max(0, Number(value) || 0), max || 1);
  return <ProgressBarBase value={v} max={max || 1} className={className} progressClassName={METER_COLOR[tone]} />;
}

/** Segmented quick filter (Untitled UI button group). options = [{ value, label, icon? }] */
export function Segmented({ options, value, onChange, size = 'sm', className }) {
  return (
    <ButtonGroup
      size={size}
      className={cx('max-w-full overflow-x-auto scrollbar-hide', className)}
      selectedKeys={new Set([value])}
      disallowEmptySelection
      onSelectionChange={(keys) => {
        const [k] = [...keys];
        if (k !== undefined) onChange(String(k));
      }}
    >
      {options.map((o) => (
        <ButtonGroupItem key={o.value} id={o.value} iconLeading={o.icon}>
          {o.label}
        </ButtonGroupItem>
      ))}
    </ButtonGroup>
  );
}
