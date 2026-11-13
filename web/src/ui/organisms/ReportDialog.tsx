import { useId, useState } from 'react';
import type { ReportReason } from '../../application/ports';
import { Button } from '../atoms/Button';
import { TextArea } from '../atoms/inputs';
import { Hint } from '../atoms/Text';
import { DialogShell, ErrorList } from './dialogs';

export const REPORT_REASONS: readonly { value: ReportReason; label: string }[] = [
  { value: 'official-copy', label: 'Copies official material' },
  { value: 'offensive', label: 'Offensive or inappropriate' },
  { value: 'spam', label: 'Spam' },
  { value: 'broken', label: 'Broken or unplayable' },
  { value: 'other', label: 'Other' },
];

const MAX = 1000;

export type ReportOutcome = { ok: true } | { ok: false; title: string; errors: string[] };

export interface ReportDialogProps {
  scenarioName: string;
  onSend(reason: ReportReason | null, details: string): Promise<ReportOutcome>;
  onClose(): void;
}

/** Report a published scenario to the site owner. */
export function ReportDialog({ scenarioName, onSend, onClose }: ReportDialogProps) {
  const ids = useId();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [state, setState] = useState<
    { kind: 'form'; error: ReportOutcome | null } | { kind: 'sending' } | { kind: 'sent' }
  >({ kind: 'form', error: null });
  const length = [...details].length;

  const send = async () => {
    setState({ kind: 'sending' });
    const r = await onSend(reason, details);
    setState(r.ok ? { kind: 'sent' } : { kind: 'form', error: r });
  };

  if (state.kind === 'sent') {
    return (
      <DialogShell
        title="Report sent"
        onClose={onClose}
        actions={
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        }
      >
        <p>Thanks. The site owner has been notified and will take a look.</p>
      </DialogShell>
    );
  }

  const error = state.kind === 'form' && state.error && !state.error.ok ? state.error : null;
  return (
    <DialogShell
      title="Report this scenario"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon="flag"
            disabled={state.kind === 'sending' || length > MAX}
            onClick={() => void send()}
          >
            {state.kind === 'sending' ? 'Sending…' : 'Send report'}
          </Button>
        </>
      }
    >
      <p className="mb-3">
        What’s wrong with <strong>{scenarioName}</strong>?
      </p>
      <fieldset className="mb-3" aria-required="true">
        <legend className="mb-1 text-xs text-muted">Reason (required)</legend>
        {REPORT_REASONS.map((r) => (
          <label
            key={r.value}
            className="flex cursor-pointer items-center gap-2 py-0.5 coarse:min-h-11 coarse:gap-3"
          >
            <input
              type="radio"
              name={`${ids}-reason`}
              value={r.value}
              checked={reason === r.value}
              onChange={() => {
                setReason(r.value);
                setState({ kind: 'form', error: null });
              }}
              className="size-4 accent-(--accent) coarse:size-5"
            />
            {r.label}
          </label>
        ))}
      </fieldset>
      <label className="mb-1 block text-xs text-muted" htmlFor={`${ids}-details`}>
        Details (optional)
      </label>
      <TextArea
        id={`${ids}-details`}
        rows={3}
        value={details}
        invalid={length > MAX}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="e.g. which official scenario it copies"
      />
      <Hint as="p" className="mt-1 mb-0 text-right" aria-live="polite">
        {length} / {MAX}
      </Hint>
      {error ? (
        <div role="alert" className="mt-2 text-danger">
          <ErrorList intro={error.title} errors={error.errors} />
        </div>
      ) : null}
    </DialogShell>
  );
}
