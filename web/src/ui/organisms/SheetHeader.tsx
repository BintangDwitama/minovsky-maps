import type { Scenario } from '../../domain/scenario';
import { Icon } from '../atoms/Icon';

export interface SheetHeaderProps {
  scenario: Scenario;
  /** Display name of the account that owns the published scenario (replaces the typed author). */
  verifiedAuthor?: string | null;
}

/** Title block of the scenario sheet. */
export function SheetHeader({ scenario, verifiedAuthor }: SheetHeaderProps) {
  const { name, author, description } = scenario.meta;
  return (
    <header className="min-w-0">
      <h1 className="text-[32px] leading-tight font-bold break-words font-stretch-condensed">
        {name}
      </h1>
      {verifiedAuthor ? (
        <p className="mt-0.5 flex items-center gap-1.5 text-muted" data-testid="sheet-author">
          <span>by {verifiedAuthor}</span>
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent print:text-text"
            title="Published by this account"
          >
            <Icon name="verified" />
            <span>verified owner</span>
          </span>
        </p>
      ) : author ? (
        <p className="mt-0.5 text-muted" data-testid="sheet-author">
          by {author}
        </p>
      ) : null}
      {description ? (
        <p className="mt-3 max-w-[70ch] leading-relaxed whitespace-pre-line">{description}</p>
      ) : null}
    </header>
  );
}
