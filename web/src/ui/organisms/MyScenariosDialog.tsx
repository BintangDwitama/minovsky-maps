import { useState } from 'react';
import type { Publication } from '../../application/ports';
import { Button } from '../atoms/Button';
import { Hint } from '../atoms/Text';
import { DialogShell } from './dialogs';

export interface MyScenariosDialogProps {
  scenarios: readonly Publication[];
  shortLinkFor(id: string): string;
  onOpen(id: string): void;
  onEdit(id: string): void;
  onCopy(id: string): Promise<boolean>;
  onForget(id: string): void;
  onClose(): void;
}

/** Scenarios this browser can update (it holds their edit tokens). */
export function MyScenariosDialog({
  scenarios,
  shortLinkFor,
  onOpen,
  onEdit,
  onCopy,
  onForget,
  onClose,
}: MyScenariosDialogProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  return (
    <DialogShell
      title="My published scenarios"
      onClose={onClose}
      actions={
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <Hint as="p" className="mt-0">
        Stored in this browser only. To update a scenario from another device, open its private edit
        link there.
      </Hint>
      {scenarios.length === 0 ? (
        <p data-testid="my-scenarios-empty">Scenarios you publish from this browser appear here.</p>
      ) : (
        <ul className="grid gap-2" data-testid="my-scenarios">
          {scenarios.map((p) => {
            const link = shortLinkFor(p.id);
            return (
              <li key={p.id} className="bg-panel-2 p-2.5 chamfer-sm">
                <div className="font-semibold break-words">{p.name || 'Untitled scenario'}</div>
                <div className="mb-2 font-mono text-xs break-all text-muted">{link}</div>
                {confirming === p.id ? (
                  <div role="alert" className="text-ui">
                    <p className="mb-2">
                      Forget this scenario? You won’t be able to update it from this browser unless
                      you saved its private edit link. It stays online.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Button small onClick={() => setConfirming(null)}>
                        Keep it
                      </Button>
                      <Button
                        small
                        variant="danger"
                        onClick={() => {
                          setConfirming(null);
                          onForget(p.id);
                        }}
                      >
                        Forget
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    <Button small className="bg-panel" onClick={() => onOpen(p.id)}>
                      Open
                    </Button>
                    <Button small className="bg-panel" icon="edit" onClick={() => onEdit(p.id)}>
                      Edit
                    </Button>
                    <Button
                      small
                      className="bg-panel"
                      icon="link"
                      onClick={() => void onCopy(p.id).then((ok) => setCopied(ok ? p.id : null))}
                    >
                      {copied === p.id ? 'Copied' : 'Copy link'}
                    </Button>
                    <Button
                      small
                      variant="danger"
                      className="ml-auto bg-panel"
                      onClick={() => setConfirming(p.id)}
                      aria-label={`Forget ${p.name || 'this scenario'}`}
                    >
                      Forget
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </DialogShell>
  );
}
