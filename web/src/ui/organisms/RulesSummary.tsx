import type { ReactNode } from 'react';
import type { Rules } from '../../domain/scenario';

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border py-1.5 last:border-b-0">
      <dt className="text-muted">{term}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  );
}

export function RulesSummary({ rules }: { rules: Rules }) {
  return (
    <dl>
      <Row term="Deployment">{rules.deployment === 'carriers' ? 'Carriers' : 'Bases'}</Row>
      <Row term="Squad size">{rules.squadSize}</Row>
      {rules.massProducedLimit !== undefined ? (
        <Row term="Mass-produced limit">{rules.massProducedLimit}</Row>
      ) : null}
      <Row term="Terrain setup">
        {rules.terrainSetup === 'free' ? 'Free: players place it' : 'Fixed: as shown'}
      </Row>
    </dl>
  );
}
