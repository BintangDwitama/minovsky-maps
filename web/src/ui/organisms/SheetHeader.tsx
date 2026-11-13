import type { Scenario } from '../../domain/scenario';

/** Title block of the scenario sheet. */
export function SheetHeader({ scenario }: { scenario: Scenario }) {
  const { name, author, description } = scenario.meta;
  return (
    <header className="min-w-0">
      <h1 className="text-[32px] leading-tight font-bold break-words font-stretch-condensed">
        {name}
      </h1>
      {author ? <p className="mt-0.5 text-muted">by {author}</p> : null}
      {description ? (
        <p className="mt-3 max-w-[70ch] leading-relaxed whitespace-pre-line">{description}</p>
      ) : null}
    </header>
  );
}
