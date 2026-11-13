import type { ToolId } from '../../application/uiState';
import { COMPONENT_KINDS, kindDef } from '../../domain/components/registry';
import { MAX_ELEVATION, TERRAIN_TAGS } from '../../domain/scenario';
import { TextInput, Select } from '../atoms/inputs';
import { ComponentPaletteItem } from '../molecules/ComponentPaletteItem';
import { Hint } from '../atoms/Text';
import {
  ElevationLevelPicker,
  FieldRow,
  OwnerToggle,
  TerrainTagPicker,
  ToolButton,
  ToolGroup,
  ToolStack,
} from '../molecules/controls';
import { useServices, useUi } from '../hooks/editorContext';

export const TOOL_SHORTCUTS: Partial<Record<string, ToolId>> = {
  v: 'select',
  t: 'terrain',
  e: 'erase',
  u: 'raise',
  d: 'lower',
  l: 'setLevel',
  p: 'place',
  a: 'analyse',
};

/** Board tools: select, terrain painting and elevation. */
export function ToolPalette() {
  const { ui } = useServices();
  const { tool, terrainTag, level } = useUi();
  const pick = (t: ToolId) => () => ui.setTool(t);

  return (
    <>
      <ToolGroup title="Select">
        <ToolStack>
          <ToolButton
            icon="select"
            label="Select / move"
            shortcut="V"
            active={tool === 'select'}
            onSelect={pick('select')}
          />
        </ToolStack>
      </ToolGroup>

      <ToolGroup title="Terrain">
        <ToolStack>
          <ToolButton
            icon="brush"
            label="Paint terrain"
            shortcut="T"
            active={tool === 'terrain'}
            onSelect={pick('terrain')}
          />
          <ToolButton
            icon="eraser"
            label="Erase terrain"
            shortcut="E"
            active={tool === 'erase'}
            onSelect={pick('erase')}
          />
        </ToolStack>
        <div className="mt-1.5">
          <TerrainTagPicker
            value={terrainTag}
            tags={TERRAIN_TAGS}
            onChange={(t) => ui.patch({ terrainTag: t, tool: 'terrain' })}
          />
        </div>
      </ToolGroup>

      <ToolGroup title="Elevation">
        <ToolStack>
          <ToolButton
            icon="up"
            label="Raise +1"
            shortcut="U"
            active={tool === 'raise'}
            onSelect={pick('raise')}
          />
          <ToolButton
            icon="down"
            label="Lower −1"
            shortcut="D"
            active={tool === 'lower'}
            onSelect={pick('lower')}
          />
          <ToolButton
            icon="level"
            label="Set level"
            shortcut="L"
            active={tool === 'setLevel'}
            onSelect={pick('setLevel')}
          />
        </ToolStack>
        {tool === 'setLevel' ? (
          <div className="mt-1.5">
            <ElevationLevelPicker
              level={level}
              max={MAX_ELEVATION}
              onLevelChange={(l) => ui.patch({ level: l })}
            />
          </div>
        ) : null}
      </ToolGroup>

      <ToolGroup title="Test the map">
        <ToolStack>
          <ToolButton
            icon="eye"
            label="Sight & reach"
            shortcut="A"
            active={tool === 'analyse'}
            onSelect={pick('analyse')}
          />
        </ToolStack>
      </ToolGroup>
    </>
  );
}

const UPGRADE_OPTIONS = [
  { value: 'shield', label: 'Shield' },
  { value: 'speed', label: 'Speed' },
  { value: 'strength', label: 'Strength' },
] as const;

const OBJECTIVE_OPTIONS = [
  { value: 'controllable', label: 'Controllable' },
  { value: 'carryable', label: 'Carryable' },
] as const;

/** Component palette: pick a kind and its options, then click the board to place. */
export function ComponentPalette() {
  const { ui } = useServices();
  const { tool, palette } = useUi();
  const def = kindDef(palette.kind);
  const owner = def.allowedOwners.includes(palette.owner) ? palette.owner : def.allowedOwners[0]!;

  return (
    <ToolGroup title="Place component">
      <ToolStack>
        {COMPONENT_KINDS.map((k) => {
          const d = kindDef(k);
          const o = d.allowedOwners.includes(palette.owner) ? palette.owner : d.allowedOwners[0]!;
          return (
            <ComponentPaletteItem
              key={k}
              kind={k}
              label={d.label}
              owner={o}
              active={tool === 'place' && palette.kind === k}
              onSelect={() => {
                ui.setPalette({ kind: k, owner: o });
                ui.setTool('place');
              }}
            />
          );
        })}
      </ToolStack>

      {tool === 'place' ? (
        <div className="mt-2.5">
          <FieldRow label="Owner">
            <OwnerToggle
              value={owner}
              allowed={def.allowedOwners}
              onChange={(o) => ui.setPalette({ owner: o })}
            />
          </FieldRow>
          {palette.kind === 'upgrade' ? (
            <FieldRow label="Upgrade type">
              <Select
                value={palette.upgradeType}
                options={UPGRADE_OPTIONS}
                onValueChange={(v) => ui.setPalette({ upgradeType: v })}
              />
            </FieldRow>
          ) : null}
          {palette.kind === 'objective' ? (
            <FieldRow label="Objective type">
              <Select
                value={palette.objectiveType}
                options={OBJECTIVE_OPTIONS}
                onValueChange={(v) => ui.setPalette({ objectiveType: v })}
              />
            </FieldRow>
          ) : null}
          {def.requiresLabel || palette.kind === 'objective' ? (
            <FieldRow
              label={def.requiresLabel ? 'Label (required)' : 'Label (optional)'}
              htmlFor="palette-label"
            >
              <TextInput
                id="palette-label"
                maxLength={60}
                value={palette.label}
                placeholder={def.requiresLabel ? 'e.g. Supply drop' : ''}
                onChange={(e) => ui.setPalette({ label: e.target.value })}
              />
            </FieldRow>
          ) : null}
          {palette.kind === 'carrier' ? (
            <Hint as="p">Rotate after placing with R / Shift+R.</Hint>
          ) : null}
        </div>
      ) : null}
    </ToolGroup>
  );
}
