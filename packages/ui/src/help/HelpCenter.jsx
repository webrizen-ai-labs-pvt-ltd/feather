import { ChevronDown, SearchLg } from '@untitledui/icons';
import { useEffect, useMemo, useState } from 'react';
import { Button as AriaButton, Disclosure, DisclosurePanel, Heading, Link as AriaLink } from 'react-aria-components';
import { useLocation } from 'react-router';
import { Input } from '@uui/components/base/input/input';
import { cx } from '@uui/utils/cx';
import { EmptyState } from '../app/basics.jsx';
import { HELP_GROUPS, sectionsFor } from './content.jsx';

/**
 * The in-app user guide. Shows only the sections for the person's role.
 * @param {{ role?: string, groupOrder: string[], intro?: any }} props
 */
export function HelpCenter({ role, groupOrder, intro }) {
  const location = useLocation();
  const target = decodeURIComponent(location.hash.slice(1));
  const [query, setQuery] = useState('');
  const sections = useMemo(() => sectionsFor(role), [role]);

  const q = query.trim().toLowerCase();
  const visible = q ? sections.filter((s) => `${s.title} ${s.keywords} ${HELP_GROUPS[s.group]}`.toLowerCase().includes(q)) : sections;
  const groups = groupOrder.map((g) => ({ key: g, label: HELP_GROUPS[g], items: visible.filter((s) => s.group === g) })).filter((g) => g.items.length);

  // Jump to the section named in the link (/help#load-truck).
  useEffect(() => {
    if (!target) return;
    const el = document.getElementById(`help-${target}`);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [target]);

  return (
    <div className="lg:grid lg:grid-cols-[15rem_1fr] lg:gap-10">
      <nav aria-label="Guide contents" className="hidden lg:block">
        <div className="sticky top-24 space-y-5 text-sm">
          {groups.map((g) => (
            <div key={g.key}>
              <p className="mb-1.5 px-2 text-xs font-semibold tracking-wide text-quaternary uppercase">{g.label}</p>
              <ul className="space-y-0.5">
                {g.items.map((s) => (
                  <li key={s.id}>
                    <AriaLink
                      href={`#${s.id}`}
                      className={cx(
                        'block rounded-md px-2 py-1.5 font-medium outline-focus-ring focus-visible:outline-2',
                        target === s.id ? 'bg-secondary text-primary' : 'text-tertiary hover:bg-primary_hover hover:text-secondary',
                      )}
                    >
                      {s.title}
                    </AriaLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="min-w-0">
        {intro}
        <Input size="md" icon={SearchLg} placeholder="Search: PIN, bags, offline, payment…" value={query} onChange={setQuery} aria-label="Search the guide" className="mb-6" />

        {!groups.length && <EmptyState title="Nothing found">Try a simpler word, like "truck", "bags" or "PIN".</EmptyState>}

        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`help-group-${g.key}`}>
              <h2 id={`help-group-${g.key}`} className="mb-3 text-xs font-semibold tracking-wide text-quaternary uppercase">
                {g.label}
              </h2>
              <div className="space-y-3">
                {g.items.map((s) => (
                  <Disclosure
                    // Remount when the link target or search changes so the right sections open.
                    key={`${s.id}:${target === s.id}:${Boolean(q)}`}
                    id={`help-${s.id}`}
                    defaultExpanded={target === s.id || Boolean(q)}
                    className="group scroll-mt-24 rounded-xl bg-primary shadow-xs ring-1 ring-secondary"
                  >
                    <Heading className="m-0">
                      <AriaButton slot="trigger" className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-5 py-4 text-left outline-focus-ring focus-visible:outline-2">
                        <span className="text-md font-semibold text-primary">{s.title}</span>
                        <ChevronDown className="size-5 shrink-0 text-fg-quaternary transition group-data-[expanded]:rotate-180" aria-hidden />
                      </AriaButton>
                    </Heading>
                    <DisclosurePanel className="border-t border-secondary px-5 pt-4 pb-5 text-md">{s.body}</DisclosurePanel>
                  </Disclosure>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
