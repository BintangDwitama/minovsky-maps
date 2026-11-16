import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiResult, OwnedScenario, Publication, Visibility } from '../../application/ports';
import { VISIBILITIES, VISIBILITY_LABEL } from '../../application/visibility';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { Select } from '../atoms/inputs';
import { VISIBILITY_ICON } from './VisibilityPicker';
import { ErrorList } from './dialogs';

interface Row {
  readonly id: string;
  readonly name: string;
  /** Account scenarios only. */
  readonly visibility?: Visibility;
}

export type MyScenariosSource =
  /** Signed in: the account's scenarios, from the server (same on every device). */
  | {
      kind: 'account';
      load(): Promise<ApiResult<OwnedScenario[]>>;
      onDelete(id: string): Promise<{ ok: true } | { ok: false; errors: string[] }>;
      onVisibility(
        id: string,
        v: Visibility,
      ): Promise<{ ok: true } | { ok: false; errors: string[] }>;
    }
  /** Signed out: legacy scenarios this browser holds edit tokens for. */
  | {
      kind: 'browser';
      scenarios: readonly Publication[];
      onForget(id: string): void;
    };

export interface MyScenariosListProps {
  source: MyScenariosSource;
  shortLinkFor(id: string): string;
  onOpen(id: string): void;
  onEdit(id: string): void;
  onCopy(id: string): Promise<boolean>;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; rows: readonly Row[] }
  | { kind: 'failed'; errors: string[] };

/** A list of saved scenarios: the account's (from the server) or this browser's legacy ones. */
export function MyScenariosList({
  source,
  shortLinkFor,
  onOpen,
  onEdit,
  onCopy,
}: MyScenariosListProps) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [confirming, setConfirming] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [deleteErrors, setDeleteErrors] = useState<string[] | null>(null);

  // the latest loader, so callers may pass a new function each render without reloading
  const loadRef = useRef(source.kind === 'account' ? source.load : null);
  loadRef.current = source.kind === 'account' ? source.load : null;
  const reload = useCallback(() => {
    const load = loadRef.current;
    if (!load) return;
    setState({ kind: 'loading' });
    void load().then((r) =>
      setState(r.ok ? { kind: 'ready', rows: r.value } : { kind: 'failed', errors: r.errors }),
    );
  }, []);
  useEffect(reload, [reload]);
  // the browser list comes straight from props (it changes when a token is forgotten)
  const view: LoadState =
    source.kind === 'browser' ? { kind: 'ready', rows: source.scenarios } : state;

  const account = source.kind === 'account';
  const setRowVisibility = (id: string, v: Visibility) =>
    setState((s) =>
      s.kind === 'ready'
        ? { ...s, rows: s.rows.map((x) => (x.id === id ? { ...x, visibility: v } : x)) }
        : s,
    );
  const changeVisibility = async (row: Row, v: Visibility) => {
    if (source.kind !== 'account' || !row.visibility) return;
    const before = row.visibility;
    setRowVisibility(row.id, v);
    const r = await source.onVisibility(row.id, v);
    if (r.ok) {
      setDeleteErrors(null);
    } else {
      setRowVisibility(row.id, before);
      setDeleteErrors(r.errors);
    }
  };
  const remove = async (id: string) => {
    setConfirming(null);
    if (source.kind === 'browser') {
      source.onForget(id);
      return;
    }
    const r = await source.onDelete(id);
    if (r.ok) {
      setDeleteErrors(null);
      setState((s) => (s.kind === 'ready' ? { ...s, rows: s.rows.filter((x) => x.id !== id) } : s));
    } else {
      setDeleteErrors(r.errors);
    }
  };

  return (
    <div data-testid="my-scenarios-section">
      {deleteErrors ? <ErrorList intro="Could not delete:" errors={deleteErrors} /> : null}

      {view.kind === 'loading' ? (
        <p role="status">Loading your scenarios…</p>
      ) : view.kind === 'failed' ? (
        <>
          <ErrorList intro="Could not load your scenarios:" errors={view.errors} />
          <Button small onClick={reload}>
            Try again
          </Button>
        </>
      ) : view.rows.length === 0 ? (
        <p data-testid="my-scenarios-empty">
          {account
            ? 'Scenarios you save online appear here.'
            : 'No scenarios from before accounts in this browser.'}
        </p>
      ) : (
        <ul className="grid gap-2" data-testid="my-scenarios">
          {view.rows.map((p) => {
            const link = shortLinkFor(p.id);
            const label = p.name || 'Untitled scenario';
            return (
              <li key={p.id} className="bg-panel-2 p-2.5 chamfer-sm">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 font-semibold break-words">{label}</div>
                  {p.visibility ? (
                    <span
                      className="inline-flex flex-none items-center gap-1 text-xs text-muted"
                      data-testid="visibility-badge"
                    >
                      <Icon name={VISIBILITY_ICON[p.visibility]} />
                      {VISIBILITY_LABEL[p.visibility]}
                    </span>
                  ) : null}
                </div>
                <div className="mb-2 font-mono text-xs break-all text-muted">{link}</div>
                {p.visibility ? (
                  <label className="mb-2 flex flex-wrap items-center gap-2 text-ui">
                    <span className="text-muted">Who can see it</span>
                    <Select
                      className="w-auto"
                      value={p.visibility}
                      aria-label={`Who can see ${label}`}
                      options={VISIBILITIES.map((v) => ({ value: v, label: VISIBILITY_LABEL[v] }))}
                      onValueChange={(v) => void changeVisibility(p, v)}
                    />
                  </label>
                ) : null}
                {confirming === p.id ? (
                  <div role="alert" className="text-ui">
                    <p className="mb-2">
                      {account
                        ? 'Delete this scenario? Its link will show “Scenario not found”. This can’t be undone.'
                        : 'Forget this scenario? You won’t be able to update it from this browser unless you saved its private edit link. It stays online.'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Button small onClick={() => setConfirming(null)}>
                        Keep it
                      </Button>
                      <Button small variant="danger" onClick={() => void remove(p.id)}>
                        {account ? 'Delete' : 'Forget'}
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
                      icon={account ? 'trash' : undefined}
                      className="ml-auto bg-panel"
                      onClick={() => setConfirming(p.id)}
                      aria-label={`${account ? 'Delete' : 'Forget'} ${label}`}
                    >
                      {account ? 'Delete' : 'Forget'}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
