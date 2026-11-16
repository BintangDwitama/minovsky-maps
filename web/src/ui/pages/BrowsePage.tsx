import { useCallback, useEffect, useRef, useState } from 'react';
import {
  browseSearch,
  EMPTY_BROWSE_QUERY,
  isFiltered,
  parseBrowseQuery,
} from '../../application/browse';
import type { BrowseItem, BrowseQuery } from '../../application/ports';
import { HttpScenarioBrowser } from '../../infrastructure/httpScenarioBrowser';
import { Button } from '../atoms/Button';
import { BrowseFilters } from '../organisms/BrowseFilters';
import { ErrorList } from '../organisms/dialogs';
import { ScenarioCard } from '../organisms/ScenarioCard';
import { BROWSE_PATH, navigate } from '../router';
import { SheetLayout } from '../templates/SheetLayout';

type Load =
  { kind: 'loading'; slow: boolean } | { kind: 'ready' } | { kind: 'failed'; errors: string[] };

/** `/browse`: public scenarios, searchable and filterable; the query lives in the address. */
export function BrowsePage() {
  const [browser] = useState(() => new HttpScenarioBrowser());
  const [query, setQuery] = useState<BrowseQuery>(() => parseBrowseQuery(location.search));
  const [items, setItems] = useState<readonly BrowseItem[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [load, setLoad] = useState<Load>({ kind: 'loading', slow: false });
  const [more, setMore] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    document.title = 'Browse scenarios – Minovsky Maps';
  }, []);

  // first page whenever the query changes (older answers are ignored)
  const fetchFirst = useCallback(
    (q: BrowseQuery) => {
      const n = ++request.current;
      setLoad({ kind: 'loading', slow: false });
      void browser
        .browse(q, null, {
          onSlow: () => n === request.current && setLoad({ kind: 'loading', slow: true }),
        })
        .then((r) => {
          if (n !== request.current) return;
          if (!r.ok) {
            setLoad({ kind: 'failed', errors: r.errors });
            return;
          }
          setItems(r.value.items);
          setNext(r.value.next);
          setLoad({ kind: 'ready' });
        });
    },
    [browser],
  );
  useEffect(() => fetchFirst(query), [fetchFirst, query]);

  const change = useCallback((q: BrowseQuery) => {
    history.replaceState(history.state, '', `${BROWSE_PATH}${browseSearch(q)}`);
    setQuery(q);
  }, []);

  const loadMore = async () => {
    if (!next) return;
    setMore(true);
    const n = request.current;
    const r = await browser.browse(query, next);
    setMore(false);
    if (n !== request.current) return;
    if (!r.ok) {
      setLoad({ kind: 'failed', errors: r.errors });
      return;
    }
    setItems((old) => [...old, ...r.value.items.filter((it) => !old.some((o) => o.id === it.id))]);
    setNext(r.value.next);
  };

  return (
    <SheetLayout
      actions={
        <Button variant="frame" icon="new" onClick={() => navigate('#/')}>
          Open the editor
        </Button>
      }
    >
      <h1 className="mb-1 text-[32px] leading-tight font-bold font-stretch-condensed">
        Browse scenarios
      </h1>
      <p className="mb-4 text-muted">
        Scenarios players chose to share with everyone. Save yours online and choose “Everyone” to
        list it here.
      </p>
      <BrowseFilters query={query} onChange={change} />

      <section aria-label="Results" aria-busy={load.kind === 'loading'} className="mt-5">
        {load.kind === 'loading' ? (
          <p role="status" data-testid="browse-loading">
            {load.slow
              ? 'Waking up the server. Free hosting can take up to a minute after a quiet spell…'
              : 'Loading scenarios…'}
          </p>
        ) : load.kind === 'failed' ? (
          <div role="alert">
            <ErrorList intro="Scenarios could not be loaded:" errors={load.errors} />
            <Button className="mt-2" icon="rotateCw" onClick={() => fetchFirst(query)}>
              Try again
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div data-testid="browse-empty">
            <p className="mb-2">
              {isFiltered(query)
                ? 'No scenarios match these filters.'
                : 'No scenarios are listed yet. Be the first: save one online and choose “Everyone”.'}
            </p>
            {isFiltered(query) ? (
              <Button onClick={() => change(EMPTY_BROWSE_QUERY)}>Clear filters</Button>
            ) : null}
          </div>
        ) : (
          <>
            <ul
              className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-4"
              data-testid="browse-results"
            >
              {items.map((it) => (
                <ScenarioCard key={it.id} item={it} />
              ))}
            </ul>
            {next ? (
              <div className="mt-5 flex justify-center">
                <Button onClick={() => void loadMore()} disabled={more}>
                  {more ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </SheetLayout>
  );
}
