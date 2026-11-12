import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_BOARD_SIZE, isValidBoardSize, MAX_BOARD_SIZE, MIN_BOARD_SIZE } from '../../domain/scenario';
import { Button } from '../atoms/Button';
import { NumberInput } from '../atoms/inputs';
import { FieldRow } from '../molecules/controls';

interface DialogShellProps {
  title: string;
  children: ReactNode;
  actions: ReactNode;
  onClose(): void;
}

function DialogShell({ title, children, actions, onClose }: DialogShellProps) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, button.btn--primary, button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <h2 id={titleId}>{title}</h2>
        <div className="dialog__body">{children}</div>
        <div className="dialog__actions">{actions}</div>
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
        <p className="field__hint" style={{ marginTop: 0 }}>
          Flat-top hexes, first column up. The standard Gundam Assemble board is 15 × 15.
        </p>
        <div className="grid-2">
          <FieldRow label="Columns (width)" htmlFor="size-w" error={wErr}>
            <NumberInput id="size-w" min={MIN_BOARD_SIZE} max={MAX_BOARD_SIZE} allowEmpty value={width} invalid={!!wErr} onValueChange={setWidth} />
          </FieldRow>
          <FieldRow label="Rows (height)" htmlFor="size-h" error={hErr}>
            <NumberInput id="size-h" min={MIN_BOARD_SIZE} max={MAX_BOARD_SIZE} allowEmpty value={height} invalid={!!hErr} onValueChange={setHeight} />
          </FieldRow>
        </div>
        <button type="submit" hidden />
      </form>
    </DialogShell>
  );
}

export function ErrorList({ intro, errors }: { intro: string; errors: readonly string[] }) {
  return (
    <>
      <p style={{ margin: 0 }}>{intro}</p>
      <ul>
        {errors.slice(0, 50).map((e, i) => (
          <li key={i}>{e}</li>
        ))}
        {errors.length > 50 ? <li>…and {errors.length - 50} more</li> : null}
      </ul>
    </>
  );
}
