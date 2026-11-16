import { useState } from 'react';
import type { Visibility } from '../../application/ports';
import { DEFAULT_VISIBILITY, VISIBILITY_LABEL } from '../../application/visibility';
import { Button } from '../atoms/Button';
import { TextInput } from '../atoms/inputs';
import { Hint } from '../atoms/Text';
import { FieldRow } from '../molecules/controls';
import { VisibilityPicker } from './VisibilityPicker';
import { DialogShell } from './dialogs';

export type SavePhase =
  | { kind: 'confirm' }
  | { kind: 'working'; slow: boolean }
  | { kind: 'done'; shortLink: string; visibility: Visibility | null };

export interface SaveOnlineDialogProps {
  mode: 'save' | 'update';
  name: string;
  phase: SavePhase;
  onConfirm(visibility: Visibility): void;
  /** Change who can see the saved scenario; resolves an error message or null. */
  onVisibilityChange(visibility: Visibility): Promise<string | null>;
  onCopy(link: string): Promise<boolean>;
  onClose(): void;
}

const linkNote: Record<Visibility, string> = {
  private: 'Only you can open this link. Choose who else can see it below.',
  link: 'Anyone you send this link to can open it. It always shows the latest version.',
  public: 'Anyone can open this link, and it is listed in Browse.',
};

/** "Save online": choose who can see it, save, then share or change it right there. */
export function SaveOnlineDialog({
  mode,
  name,
  phase,
  onConfirm,
  onVisibilityChange,
  onCopy,
  onClose,
}: SaveOnlineDialogProps) {
  const [choice, setChoice] = useState<Visibility>(DEFAULT_VISIBILITY);
  const [current, setCurrent] = useState<Visibility | null>(
    phase.kind === 'done' ? phase.visibility : null,
  );
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | string>('idle');
  const [copied, setCopied] = useState(false);
  const shown = current ?? (phase.kind === 'done' ? phase.visibility : null);

  const title =
    phase.kind === 'done'
      ? mode === 'save'
        ? 'Saved online'
        : 'Updated'
      : mode === 'save'
        ? 'Save online'
        : 'Updating…';

  const change = async (v: Visibility) => {
    const before = shown;
    setCurrent(v);
    setSaving('saving');
    const err = await onVisibilityChange(v);
    if (err) {
      setCurrent(before);
      setSaving(err);
    } else {
      setSaving('saved');
    }
  };

  const actions =
    phase.kind === 'confirm' ? (
      <>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="upload" onClick={() => onConfirm(choice)}>
          Save
        </Button>
      </>
    ) : phase.kind === 'working' ? (
      <Button variant="primary" disabled>
        {mode === 'save' ? 'Saving…' : 'Updating…'}
      </Button>
    ) : (
      <Button variant="primary" onClick={onClose}>
        Done
      </Button>
    );

  return (
    <DialogShell title={title} onClose={onClose} actions={actions}>
      {phase.kind === 'confirm' ? (
        <>
          <p className="mb-3">
            Save <strong>{name}</strong> to your account. You can keep updating it from any device.
          </p>
          <VisibilityPicker value={choice} onChange={setChoice} />
          <Hint as="p" className="mb-0">
            Your display name is shown as the author to anyone who can see it. Please share your own
            scenarios; refer to official ones by name rather than copying them.
          </Hint>
        </>
      ) : null}

      {phase.kind === 'working' ? (
        <p role="status">
          {phase.slow
            ? 'Waking up the server. Free hosting can take up to a minute after a quiet spell…'
            : mode === 'save'
              ? 'Saving…'
              : 'Saving the new version…'}
        </p>
      ) : null}

      {phase.kind === 'done' ? (
        <>
          <p className="mb-3" data-testid="save-done-note">
            {shown ? linkNote[shown] : 'Everyone who can see it now sees this version.'}
          </p>
          <FieldRow label="Link">
            <div className="flex gap-1.5">
              <TextInput
                readOnly
                aria-label="Link"
                value={phase.shortLink}
                className="font-mono text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                icon="link"
                onClick={() => void onCopy(phase.shortLink).then(setCopied)}
                aria-label="Copy link"
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </FieldRow>
          {shown ? (
            <>
              <VisibilityPicker
                value={shown}
                onChange={(v) => void change(v)}
                disabled={saving === 'saving'}
                compact
              />
              <p className="mt-1.5 mb-0 text-xs text-muted" role="status">
                {saving === 'saving'
                  ? 'Saving…'
                  : saving === 'saved'
                    ? `Saved: ${VISIBILITY_LABEL[shown]}.`
                    : saving !== 'idle'
                      ? saving
                      : 'You can change this any time in My scenarios.'}
              </p>
            </>
          ) : null}
        </>
      ) : null}
    </DialogShell>
  );
}
