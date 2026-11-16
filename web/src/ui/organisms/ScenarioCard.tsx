import type { MouseEvent } from 'react';
import { boardSizeText, deploymentText } from '../../application/browse';
import type { BrowseItem } from '../../application/ports';
import { Icon } from '../atoms/Icon';
import { goToPath } from '../router';
import { BoardThumbnail } from './BoardThumbnail';

/** One public scenario in Browse: a link to its sheet. */
export function ScenarioCard({ item }: { item: BrowseItem }) {
  const href = `/s/${item.id}`;
  const open = (e: MouseEvent<HTMLAnchorElement>) => {
    // plain clicks stay in the app; new-tab clicks behave like any link
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    goToPath(href);
  };
  const facts = [boardSizeText(item), deploymentText(item.deployment)].filter(Boolean).join(' · ');
  return (
    <li className="min-w-0">
      <a
        href={href}
        onClick={open}
        className="group block h-full bg-panel chamfer focus-visible:shadow-[inset_0_0_0_2px_var(--accent)] focus-visible:outline-none"
        data-testid="scenario-card"
      >
        <BoardThumbnail doc={item.scenario} />
        <div className="p-3">
          <h2 className="text-head font-semibold break-words font-stretch-condensed group-hover:underline">
            {item.name || 'Untitled scenario'}
          </h2>
          {item.ownerName ? (
            <p className="flex items-center gap-1 text-ui text-muted">
              <span>by {item.ownerName}</span>
              <span className="text-accent" title="Verified owner">
                <Icon name="verified" title="verified owner" />
              </span>
            </p>
          ) : null}
          {facts ? <p className="mt-0.5 text-xs text-muted">{facts}</p> : null}
        </div>
      </a>
    </li>
  );
}
