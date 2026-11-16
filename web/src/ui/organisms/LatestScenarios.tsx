import { type MouseEvent, useEffect, useState } from 'react';
import { EMPTY_BROWSE_QUERY } from '../../application/browse';
import type { BrowseItem, ScenarioBrowser } from '../../application/ports';
import { BROWSE_PATH, goToPath } from '../router';
import { ScenarioCard } from './ScenarioCard';

/**
 * The newest public scenarios, for the landing page. Shows nothing while loading, when the
 * server can't be reached, or when nothing is listed: never an empty or broken section.
 */
export function LatestScenarios({
  browser,
  count = 3,
}: {
  browser: ScenarioBrowser;
  count?: number;
}) {
  const [items, setItems] = useState<readonly BrowseItem[]>([]);

  useEffect(() => {
    let active = true;
    void browser.browse(EMPTY_BROWSE_QUERY, null).then((r) => {
      if (active && r.ok) setItems(r.value.items.slice(0, count));
    });
    return () => {
      active = false;
    };
  }, [browser, count]);

  if (items.length === 0) return null;
  const seeAll = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    goToPath(BROWSE_PATH);
  };
  return (
    <section aria-labelledby="latest-title" className="mt-12" data-testid="latest-scenarios">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 id="latest-title" className="text-[24px] font-bold font-stretch-condensed">
          Latest scenarios
        </h2>
        <a href={BROWSE_PATH} onClick={seeAll} className="font-semibold text-accent underline">
          See all scenarios
        </a>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-4">
        {items.map((it) => (
          <ScenarioCard key={it.id} item={it} />
        ))}
      </ul>
    </section>
  );
}
