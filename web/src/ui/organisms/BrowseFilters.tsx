import { useEffect, useState } from 'react';
import { EMPTY_BROWSE_QUERY, isFiltered, MAX_SEARCH } from '../../application/browse';
import type { BrowseQuery, BrowseSize, BrowseSort } from '../../application/ports';
import { Button } from '../atoms/Button';
import { Checkbox, Select, TextInput } from '../atoms/inputs';
import { FieldRow } from '../molecules/controls';

type Opt<T extends string> = { value: T; label: string };

const SIZE_OPTIONS: readonly Opt<'' | BrowseSize>[] = [
  { value: '', label: 'Any size' },
  { value: 'standard', label: 'Standard 15 × 15' },
  { value: 'smaller', label: 'Smaller' },
  { value: 'larger', label: 'Larger' },
];
const DEPLOY_OPTIONS: readonly Opt<'' | 'bases' | 'carriers'>[] = [
  { value: '', label: 'Any deployment' },
  { value: 'bases', label: 'Bases' },
  { value: 'carriers', label: 'Carriers' },
];
const SQUAD_OPTIONS: readonly Opt<string>[] = [
  { value: '', label: 'Any squad size' },
  ...Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: `Squad of ${i + 1}` })),
];
const SORT_OPTIONS: readonly Opt<BrowseSort>[] = [
  { value: 'new', label: 'Newest' },
  { value: 'updated', label: 'Recently updated' },
];

export interface BrowseFiltersProps {
  query: BrowseQuery;
  onChange(q: BrowseQuery): void;
}

/** Search, filters and sort for Browse. Typing waits a moment before searching. */
export function BrowseFilters({ query, onChange }: BrowseFiltersProps) {
  const [text, setText] = useState(query.q);
  useEffect(() => setText(query.q), [query.q]);
  useEffect(() => {
    if (text === query.q) return;
    const t = setTimeout(() => onChange({ ...query, q: text }), 400);
    return () => clearTimeout(t);
  }, [text, query, onChange]);

  return (
    <form
      role="search"
      aria-label="Find scenarios"
      className="grid gap-x-3 gap-y-1 bg-panel p-3 chamfer sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]"
      onSubmit={(e) => {
        e.preventDefault();
        onChange({ ...query, q: text });
      }}
    >
      <FieldRow label="Search names, descriptions and authors" htmlFor="browse-q">
        <TextInput
          id="browse-q"
          type="search"
          maxLength={MAX_SEARCH}
          value={text}
          placeholder="e.g. mesa"
          onChange={(e) => setText(e.target.value)}
        />
      </FieldRow>
      <FieldRow label="Board size" htmlFor="browse-size">
        <Select
          id="browse-size"
          value={query.size ?? ''}
          options={SIZE_OPTIONS}
          onValueChange={(v) => onChange({ ...query, size: v || null })}
        />
      </FieldRow>
      <FieldRow label="Deployment" htmlFor="browse-deploy">
        <Select
          id="browse-deploy"
          value={query.deployment ?? ''}
          options={DEPLOY_OPTIONS}
          onValueChange={(v) => onChange({ ...query, deployment: v || null })}
        />
      </FieldRow>
      <FieldRow label="Squad size" htmlFor="browse-squad">
        <Select
          id="browse-squad"
          value={query.squad ? String(query.squad) : ''}
          options={SQUAD_OPTIONS}
          onValueChange={(v) => onChange({ ...query, squad: v ? Number(v) : null })}
        />
      </FieldRow>
      <FieldRow label="Sort" htmlFor="browse-sort">
        <Select
          id="browse-sort"
          value={query.sort}
          options={SORT_OPTIONS}
          onValueChange={(v) => onChange({ ...query, sort: v })}
        />
      </FieldRow>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-5">
        <Checkbox
          label="Has elevation"
          checked={query.elevation}
          onChange={(elevation) => onChange({ ...query, elevation })}
        />
        {isFiltered(query) ? (
          <Button small onClick={() => onChange(EMPTY_BROWSE_QUERY)}>
            Clear filters
          </Button>
        ) : null}
      </div>
    </form>
  );
}
