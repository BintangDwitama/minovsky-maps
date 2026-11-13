import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  DEFAULT_BOARD_SIZE,
  isValidBoardSize,
  MAX_BOARD_SIZE,
  MIN_BOARD_SIZE,
} from '../../domain/scenario';
import { Button } from '../atoms/Button';
import { NumberInput, TextInput } from '../atoms/inputs';
import { Hint } from '../atoms/Text';
import { FieldRow } from '../molecules/controls';

export interface DialogShellProps {
  title: string;
  children: ReactNode;
  actions: ReactNode;
  onClose(): void;
}

/** Modal frame shared by all dialogs: navy title band, body, actions; Escape and backdrop close it. */
export function DialogShell({ title, children, actions, onClose }: DialogShellProps) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current
      ?.querySelector<HTMLElement>('input, button[data-variant="primary"], button')
      ?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-10 grid place-items-center bg-black/45"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* drop-shadow sits on a wrapper: the chamfer clip would cut a box-shadow off */}
      <div className="drop-shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
        <div
          className="max-h-[calc(100vh-32px)] w-[min(440px,calc(100vw-32px))] overflow-auto bg-panel chamfer"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          ref={ref}
        >
          <h2
            id={titleId}
            className="border-b-2 border-vent bg-frame px-4.5 py-2.5 text-title font-bold text-frame-ink font-stretch-condensed"
          >
            {title}
          </h2>
          <div className="p-4.5">
            <div className="mb-4">{children}</div>
            <div className="flex justify-end gap-2">{actions}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string | null;
  danger?: boolean;
  onConfirm(): void;
  onCancel(): void;
}

export function ConfirmDialog({
  title,
  children,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <DialogShell
      title={title}
      onClose={onCancel}
      actions={
        <>
          {cancelLabel ? <Button onClick={onCancel}>{cancelLabel}</Button> : null}
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </DialogShell>
  );
}

export interface BoardSizeDialogProps {
  mode: 'new' | 'resize';
  initial?: { width: number; height: number };
  onSubmit(size: { width: number; height: number }): void;
  onCancel(): void;
}

/** New scenario (default 15×15) or resize. Width and height must be 1–40. */
export function NewScenarioDialog({ mode, initial, onSubmit, onCancel }: BoardSizeDialogProps) {
  const [width, setWidth] = useState<number | null>(initial?.width ?? DEFAULT_BOARD_SIZE);
  const [height, setHeight] = useState<number | null>(initial?.height ?? DEFAULT_BOARD_SIZE);
  const range = `Must be between ${MIN_BOARD_SIZE} and ${MAX_BOARD_SIZE}.`;
  const wErr = width === null || !isValidBoardSize(width) ? range : null;
  const hErr = height === null || !isValidBoardSize(height) ? range : null;
  const valid = !wErr && !hErr;
  const submit = () => valid && onSubmit({ width: width!, height: height! });

  return (
    <DialogShell
      title={mode === 'new' ? 'New scenario' : 'Resize board'}
      onClose={onCancel}
      actions={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={submit}>
            {mode === 'new' ? 'Create' : 'Resize'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Hint as="p" className="mt-0">
          Flat-top hexes, first column up. The standard Gundam Assemble board is 15 × 15.
        </Hint>
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Columns (width)" htmlFor="size-w" error={wErr}>
            <NumberInput
              id="size-w"
              min={MIN_BOARD_SIZE}
              max={MAX_BOARD_SIZE}
              allowEmpty
              value={width}
              invalid={!!wErr}
              onValueChange={setWidth}
            />
          </FieldRow>
          <FieldRow label="Rows (height)" htmlFor="size-h" error={hErr}>
            <NumberInput
              id="size-h"
              min={MIN_BOARD_SIZE}
              max={MAX_BOARD_SIZE}
              allowEmpty
              value={height}
              invalid={!!hErr}
              onValueChange={setHeight}
            />
          </FieldRow>
        </div>
        <button type="submit" hidden />
      </form>
    </DialogShell>
  );
}

/** A dialog shown while a request runs, e.g. opening a published scenario. */
export function BusyDialog({
  title,
  slow,
  onCancel,
}: {
  title: string;
  slow: boolean;
  onCancel(): void;
}) {
  return (
    <DialogShell
      title={title}
      onClose={onCancel}
      actions={<Button onClick={onCancel}>Cancel</Button>}
    >
      <p role="status">
        {slow
          ? 'Waking up the server. Free hosting can take up to a minute after a quiet spell…'
          : 'Loading…'}
      </p>
    </DialogShell>
  );
}

export type PublishPhase =
  | { kind: 'confirm' }
  | { kind: 'working'; slow: boolean }
  | { kind: 'done'; shortLink: string; editLink: string | null; copied: boolean };

export interface PublishDialogProps {
  mode: 'publish' | 'update';
  name: string;
  phase: PublishPhase;
  onConfirm(): void;
  onClose(): void;
}

const linkField = (label: string, value: string) => (
  <FieldRow label={label}>
    <TextInput
      readOnly
      aria-label={label}
      value={value}
      className="font-mono text-xs"
      onFocus={(e) => e.currentTarget.select()}
    />
  </FieldRow>
);

/** Publish (first time, with a visibility note) or Update, then show the short link. */
export function PublishDialog({ mode, name, phase, onConfirm, onClose }: PublishDialogProps) {
  const title =
    phase.kind === 'done'
      ? mode === 'publish'
        ? 'Published'
        : 'Updated'
      : mode === 'publish'
        ? 'Publish scenario'
        : 'Updating…';

  const actions =
    phase.kind === 'confirm' ? (
      <>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="upload" onClick={onConfirm}>
          Publish
        </Button>
      </>
    ) : phase.kind === 'working' ? (
      <Button variant="primary" disabled>
        {mode === 'publish' ? 'Publishing…' : 'Updating…'}
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
          <p>
            Publish <strong>{name}</strong> and get a short link you can keep updating.
          </p>
          <Hint as="p" className="mb-0">
            Anyone with the link can see this scenario, including the author name. Please publish
            your own scenarios; refer to official ones by name rather than copying them.
          </Hint>
        </>
      ) : null}

      {phase.kind === 'working' ? (
        <p role="status">
          {phase.slow
            ? 'Waking up the server. Free hosting can take up to a minute after a quiet spell…'
            : mode === 'publish'
              ? 'Publishing…'
              : 'Saving the new version…'}
        </p>
      ) : null}

      {phase.kind === 'done' ? (
        <>
          <p className="mb-3">
            {phase.copied ? 'Short link copied. ' : ''}
            {mode === 'publish'
              ? 'Share this link; it will always show the latest version.'
              : 'Everyone with the link now sees this version.'}
          </p>
          {linkField('Short link', phase.shortLink)}
          {phase.editLink ? (
            <>
              {linkField('Private edit link', phase.editLink)}
              <Hint as="p" className="mt-0 mb-0 text-warning-text">
                Keep the edit link private: it lets anyone update this scenario. This browser
                remembers it; save it somewhere to edit from another device.
              </Hint>
            </>
          ) : null}
        </>
      ) : null}
    </DialogShell>
  );
}

export function ErrorList({ intro, errors }: { intro: string; errors: readonly string[] }) {
  return (
    <>
      <p>{intro}</p>
      {errors.length > 0 ? (
        <ul className="mt-1.5 max-h-60 list-disc overflow-auto pl-4.5">
          {errors.slice(0, 50).map((e, i) => (
            <li key={i}>{e}</li>
          ))}
          {errors.length > 50 ? <li>…and {errors.length - 50} more</li> : null}
        </ul>
      ) : null}
    </>
  );
}

export interface ShareLinkDialogProps {
  link: string;
  /** Whether the link already went to the clipboard. */
  copied: boolean;
  long: boolean;
  /** Self-contained share link, or a short link to a published scenario. */
  storedIn?: 'link' | 'server';
  onClose(): void;
}

/** Shows a share link: confirms the copy, or offers it for manual copying. */
export function ShareLinkDialog({
  link,
  copied,
  long,
  storedIn = 'link',
  onClose,
}: ShareLinkDialogProps) {
  return (
    <DialogShell
      title={copied ? 'Link copied' : 'Copy this link'}
      onClose={onClose}
      actions={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <p>
        {copied
          ? 'Anyone with this link can view the scenario and edit their own copy.'
          : 'Your browser blocked the clipboard. Select the link and copy it:'}
      </p>
      <TextInput
        readOnly
        aria-label="Share link"
        value={link}
        className="mt-2 font-mono text-xs"
        onFocus={(e) => e.currentTarget.select()}
      />
      <Hint as="p" className="mb-0">
        {storedIn === 'link'
          ? 'The scenario is stored in the link itself; nothing is uploaded.'
          : 'This link always shows the latest published version.'}
      </Hint>
      {long ? (
        <Hint as="p" className="mb-0 text-warning-text">
          This link is {link.length.toLocaleString()} characters long and may not fit in one chat
          message. You can share the saved .json file instead.
        </Hint>
      ) : null}
    </DialogShell>
  );
}
