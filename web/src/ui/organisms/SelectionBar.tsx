import { removeComponentCmd, rotateCarrierCmd } from '../../application/commands';
import { kindDef } from '../../domain/components/registry';
import { Button, IconButton } from '../atoms/Button';
import { useEditor, useServices, useUi } from '../hooks/editorContext';

const OWNER: Record<string, string> = { A: 'Side A', B: 'Side B', neutral: 'Neutral' };

/** Compact layout: quick actions for the selected component, above the tab bar. */
export function SelectionBar({ onDetails }: { onDetails(): void }) {
  const { session, ui } = useServices();
  const { scenario } = useEditor();
  const { selectedId } = useUi();
  const c = selectedId ? scenario.components.find((x) => x.id === selectedId) : undefined;
  if (!c) return null;
  const def = kindDef(c.kind);
  const label = 'label' in c && c.label ? c.label : null;

  return (
    <div
      className="flex items-center gap-1 border-b border-border bg-panel/95 px-2 py-1 shadow-[0_4px_12px_rgb(0_0_0/0.2)]"
      data-testid="selection-bar"
    >
      <span className="min-w-0 flex-1 truncate">
        <span className="font-semibold">{label ?? def.label}</span>
        <span className="text-xs text-muted">
          {' '}
          {label ? `${def.label}, ` : ''}
          {OWNER[c.owner]}
        </span>
      </span>
      {c.kind === 'carrier' ? (
        <IconButton
          icon="rotateCw"
          label="Rotate clockwise"
          onClick={() => {
            const r = session.execute(rotateCarrierCmd(c.id, 1));
            if (!r.ok) ui.flash(r.reason);
          }}
        />
      ) : null}
      <IconButton
        icon="trash"
        variant="danger"
        label={`Remove ${def.label.toLowerCase()}`}
        onClick={() => {
          session.execute(removeComponentCmd(c.id));
          ui.select(null);
        }}
      />
      <Button onClick={onDetails}>Details</Button>
    </div>
  );
}
