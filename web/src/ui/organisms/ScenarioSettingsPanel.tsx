import { updateMetaCmd, updateRulesCmd } from '../../application/commands';
import { rectangleSize } from '../../domain/scenario';
import { Button } from '../atoms/Button';
import { NumberInput, TextArea, TextInput } from '../atoms/inputs';
import { FieldRow, Segmented } from '../molecules/controls';
import { PanelSection } from '../molecules/PanelSection';
import { useEditor, useServices, useTransactionalField } from '../hooks/editorContext';

export function ScenarioSettingsPanel({ onResize }: { onResize(): void }) {
  const { session } = useServices();
  const { scenario } = useEditor();
  const metaTx = useTransactionalField('Edit details');
  const rulesTx = useTransactionalField('Edit rules');
  const { meta, rules } = scenario;
  const size = rectangleSize(scenario);
  const nameError = meta.name.trim() ? null : 'A name is required to save.';

  return (
    <>
      <PanelSection title="Scenario">
        <FieldRow label="Name" htmlFor="meta-name" error={nameError}>
          <TextInput
            id="meta-name"
            maxLength={120}
            value={meta.name}
            invalid={!!nameError}
            {...metaTx}
            onChange={(e) => session.execute(updateMetaCmd({ name: e.target.value }))}
          />
        </FieldRow>
        <FieldRow label="Author" htmlFor="meta-author">
          <TextInput
            id="meta-author"
            maxLength={120}
            value={meta.author ?? ''}
            {...metaTx}
            onChange={(e) => session.execute(updateMetaCmd({ author: e.target.value }))}
          />
        </FieldRow>
        <FieldRow label="Description" htmlFor="meta-desc">
          <TextArea
            id="meta-desc"
            maxLength={5000}
            rows={3}
            value={meta.description ?? ''}
            {...metaTx}
            onChange={(e) => session.execute(updateMetaCmd({ description: e.target.value }))}
          />
        </FieldRow>
        <FieldRow label="Board">
          <div className="flex items-center gap-1.5">
            <span className="flex-1">
              {size
                ? `${size.width} × ${size.height} hexes`
                : `${scenario.board.hexes.length} hexes`}
            </span>
            <Button small icon="resize" onClick={onResize}>
              Resize
            </Button>
          </div>
        </FieldRow>
      </PanelSection>

      <PanelSection title="Rules">
        <FieldRow label="Deployment">
          <Segmented
            ariaLabel="Deployment"
            value={rules.deployment}
            options={[
              { value: 'bases', label: 'Bases' },
              { value: 'carriers', label: 'Carriers' },
            ]}
            onChange={(deployment) => session.execute(updateRulesCmd({ deployment }))}
          />
        </FieldRow>
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Squad size" htmlFor="rules-squad">
            <NumberInput
              id="rules-squad"
              min={1}
              max={20}
              value={rules.squadSize}
              {...rulesTx}
              onValueChange={(v) =>
                session.execute(updateRulesCmd({ squadSize: Math.max(1, Math.min(20, v ?? 1)) }))
              }
            />
          </FieldRow>
          <FieldRow label="Mass-produced limit" htmlFor="rules-mp" hint="Blank = not specified">
            <NumberInput
              id="rules-mp"
              min={0}
              max={20}
              allowEmpty
              value={rules.massProducedLimit ?? null}
              {...rulesTx}
              onValueChange={(v) =>
                session.execute(
                  updateRulesCmd({
                    massProducedLimit: v === null ? undefined : Math.max(0, Math.min(20, v)),
                  }),
                )
              }
            />
          </FieldRow>
        </div>
        <FieldRow
          label="Terrain setup"
          hint={
            rules.terrainSetup === 'free'
              ? 'Players agree where terrain goes during setup.'
              : 'Terrain is placed exactly as shown.'
          }
        >
          <Segmented
            ariaLabel="Terrain setup"
            value={rules.terrainSetup}
            options={[
              { value: 'fixed', label: 'Fixed' },
              { value: 'free', label: 'Free' },
            ]}
            onChange={(terrainSetup) => session.execute(updateRulesCmd({ terrainSetup }))}
          />
        </FieldRow>
      </PanelSection>
    </>
  );
}
