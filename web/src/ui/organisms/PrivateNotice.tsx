import { useState } from 'react';
import type { Visibility } from '../../application/ports';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { VisibilityPicker } from './VisibilityPicker';

/**
 * Shown to the owner on the sheet of a private scenario: nobody else can open this page.
 * "Share…" reveals the visibility choice right here. Not printed.
 */
export function PrivateNotice({ onShare }: { onShare(v: Visibility): Promise<string | null> }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<Visibility>('private');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const change = async (v: Visibility) => {
    setValue(v);
    if (v === 'private') return;
    setBusy(true);
    const err = await onShare(v);
    setBusy(false);
    if (err) {
      setError(err);
      setValue('private');
    }
  };

  return (
    <div
      className="mb-4 bg-vent-soft p-3 shadow-[inset_4px_0_0_var(--vent)] chamfer-sm print:hidden"
      role="note"
      data-testid="private-notice"
    >
      <p className="flex flex-wrap items-center gap-2">
        <Icon name="lock" />
        <strong>Only you can see this.</strong>
        <span className="text-ui">Anyone else opening this link sees “Scenario not found”.</span>
        {open ? null : (
          <Button small icon="link" onClick={() => setOpen(true)}>
            Share…
          </Button>
        )}
      </p>
      {open ? (
        <div className="mt-3 max-w-md">
          <VisibilityPicker
            value={value}
            onChange={(v) => void change(v)}
            disabled={busy}
            compact
          />
          {error ? (
            <p className="mb-0 text-xs text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
