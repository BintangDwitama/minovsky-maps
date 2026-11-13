import {
  removeComponentCmd,
  rotateCarrierCmd,
  updateComponentCmd,
} from '../../application/commands';
import type { ComponentPatch } from '../../domain/operations';
import { kindDef } from '../../domain/components/registry';
import { axialToOffset, DIRECTION_NAMES, toDirection } from '../../domain/hex';
import { Button } from '../atoms/Button';
import { Select, TextArea, TextInput } from '../atoms/inputs';
import { Hint } from '../atoms/Text';
import { FieldRow, OwnerToggle } from '../molecules/controls';
import { PanelSection } from '../molecules/PanelSection';
import { useEditor, useServices, useTransactionalField, useUi } from '../hooks/editorContext';

/** Properties of the selected component; every field is editable here. */
export function ScenarioInspector() {
  const { session, ui } = useServices();
  const { scenario } = useEditor();
  const { selectedId } = useUi();
  const txLabel = useTransactionalField('Edit component');
  const c = selectedId ? scenario.components.find((x) => x.id === selectedId) : undefined;

  if (!c) {
    return (
      <PanelSection title="Selection" muted>
        Select a component on the board to edit it.
      </PanelSection>
    );
  }

  const def = kindDef(c.kind);
  const { col, row } = axialToOffset(c.hex);
  const update = (patch: ComponentPatch) => {
    const r = session.execute(updateComponentCmd(c.id, patch));
    if (!r.ok) ui.flash(r.reason);
  };
  const rotate = (steps: number) => {
    const r = session.execute(rotateCarrierCmd(c.id, steps));
    if (!r.ok) ui.flash(r.reason);
  };

  return (
    <PanelSection
      title={
        <>
          {def.label}
          <Hint className="font-normal font-stretch-normal">
            {c.kind === 'carrier' ? 'middle ' : ''}hex {col}, {row}
          </Hint>
        </>
      }
    >
      <FieldRow label="Owner">
        <OwnerToggle
          value={c.owner}
          allowed={def.allowedOwners}
          onChange={(owner) => update({ owner })}
        />
      </FieldRow>

      {c.kind === 'carrier' ? (
        <FieldRow label={`Facing: ${DIRECTION_NAMES[toDirection(c.facing)]}`}>
          <div className="flex items-center gap-1.5">
            <Button
              small
              icon="rotateCcw"
              onClick={() => rotate(-1)}
              title="Rotate counter-clockwise (Shift+R)"
            >
              Rotate left
            </Button>
            <Button small icon="rotateCw" onClick={() => rotate(1)} title="Rotate clockwise (R)">
              Rotate right
            </Button>
          </div>
        </FieldRow>
      ) : null}

      {c.kind === 'upgrade' ? (
        <FieldRow label="Upgrade type">
          <Select
            value={c.upgradeType}
            options={[
              { value: 'shield', label: 'Shield' },
              { value: 'speed', label: 'Speed' },
              { value: 'strength', label: 'Strength' },
            ]}
            onValueChange={(upgradeType) => update({ upgradeType })}
          />
        </FieldRow>
      ) : null}

      {c.kind === 'objective' ? (
        <>
          <FieldRow
            label="Objective type"
            hint="Controllable: contested from adjacent hexes. Carryable: picked up by a unit."
          >
            <Select
              value={c.objectiveType}
              options={[
                { value: 'controllable', label: 'Controllable' },
                { value: 'carryable', label: 'Carryable' },
              ]}
              onValueChange={(objectiveType) => update({ objectiveType })}
            />
          </FieldRow>
          <FieldRow label="Label (optional)" htmlFor="insp-label">
            <TextInput
              id="insp-label"
              maxLength={60}
              value={c.label ?? ''}
              {...txLabel}
              onChange={(e) => update({ label: e.target.value })}
            />
          </FieldRow>
        </>
      ) : null}

      {c.kind === 'token' || c.kind === 'structure' ? (
        <>
          <FieldRow
            label="Label"
            htmlFor="insp-label"
            error={c.label.trim() ? null : 'A label is required.'}
          >
            <TextInput
              id="insp-label"
              maxLength={60}
              value={c.label}
              invalid={!c.label.trim()}
              {...txLabel}
              onChange={(e) => update({ label: e.target.value })}
            />
          </FieldRow>
          <FieldRow label="Rules note (optional)" htmlFor="insp-note">
            <TextArea
              id="insp-note"
              maxLength={500}
              rows={3}
              value={c.note ?? ''}
              {...txLabel}
              onChange={(e) => update({ note: e.target.value })}
            />
          </FieldRow>
        </>
      ) : null}

      <Button
        variant="danger"
        icon="trash"
        onClick={() => {
          session.execute(removeComponentCmd(c.id));
          ui.select(null);
        }}
      >
        Remove {def.label.toLowerCase()}
      </Button>
    </PanelSection>
  );
}
