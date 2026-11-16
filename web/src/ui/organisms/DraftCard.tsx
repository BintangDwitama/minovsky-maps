import { useState } from 'react';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';

export interface DraftCardProps {
  name: string;
  /** e.g. "edited 2 hours ago" */
  edited: string;
  onContinue(): void;
  onDiscard(): void;
}

/** The editor's unsaved draft in this browser: continue it, or throw it away (after asking). */
export function DraftCard({ name, edited, onContinue, onDiscard }: DraftCardProps) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="bg-panel-2 p-3 chamfer-sm" data-testid="draft-card">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Icon name="edit" />
        <span className="font-semibold break-words">{name || 'Untitled scenario'}</span>
        <span className="text-xs text-muted">Unsaved draft, {edited}</span>
      </div>
      {confirming ? (
        <div role="alert" className="text-ui">
          <p className="mb-2">
            Discard this draft? Its changes are lost unless you saved it to a file or online.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Button small onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button
              small
              variant="danger"
              onClick={() => {
                setConfirming(false);
                onDiscard();
              }}
            >
              Discard
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <Button variant="primary" icon="edit" onClick={onContinue}>
            Continue editing
          </Button>
          <Button variant="danger" icon="trash" onClick={() => setConfirming(true)}>
            Discard
          </Button>
        </div>
      )}
    </div>
  );
}
