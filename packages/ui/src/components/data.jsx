import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import clsx from 'clsx';
import { EmptyState } from './basics.jsx';

/**
 * @param {{ columns: {key:string, header:string, render?:(row)=>any, align?:'right'|'left', className?:string}[], rows: any[] }} props
 */
export function DataTable({ columns, rows, rowKey = (r) => r._id, onRowClick, empty = 'Nothing to show yet.', dense }) {
  if (!rows?.length) return <EmptyState title={empty} />;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-ink-100 text-sm">
        <thead className="bg-ink-50">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={clsx('whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-500 first:pl-4 last:pr-4', c.align === 'right' ? 'text-right' : 'text-left')}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100 bg-white">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={clsx(onRowClick && 'cursor-pointer hover:bg-brand-50/50')}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={clsx(
                    'tabular whitespace-nowrap px-3 text-ink-800 first:pl-4 last:pr-4',
                    dense ? 'py-2' : 'py-3',
                    c.align === 'right' && 'text-right',
                    c.className,
                  )}
                >
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tabs built on Headless UI. tabs = [{ label, content, count? }] */
export function Tabs({ tabs, selectedIndex, onChange, className }) {
  return (
    <TabGroup selectedIndex={selectedIndex} onChange={onChange} className={className}>
      <TabList className="flex gap-1 overflow-x-auto border-b border-ink-200">
        {tabs.map((t) => (
          <Tab
            key={t.label}
            className="-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm font-semibold text-ink-500 hover:text-ink-800 focus:outline-none data-selected:border-brand-600 data-selected:text-brand-700"
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 rounded-full bg-ink-100 px-1.5 py-0.5 text-xs text-ink-600">{t.count}</span>}
          </Tab>
        ))}
      </TabList>
      <TabPanels className="pt-4">
        {tabs.map((t) => (
          <TabPanel key={t.label} className="focus:outline-none">
            {t.content}
          </TabPanel>
        ))}
      </TabPanels>
    </TabGroup>
  );
}

/** Horizontal bar for a value vs. a maximum (e.g. credit used). */
export function Meter({ value, max, tone = 'brand', className }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const color = { brand: 'bg-brand-500', good: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-red-500' }[tone];
  return (
    <div className={clsx('h-2 w-full overflow-hidden rounded-full bg-ink-100', className)} role="meter" aria-valuenow={value} aria-valuemax={max}>
      <div className={clsx('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}
