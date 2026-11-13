import { addGoalCmd, moveGoalCmd, removeGoalCmd, updateGoalCmd } from '../../application/commands';
import { Button } from '../atoms/Button';
import { Hint } from '../atoms/Text';
import { GoalRow } from '../molecules/GoalRow';
import { PanelSection } from '../molecules/PanelSection';
import { useEditor, useServices } from '../hooks/editorContext';

export function GoalsEditor() {
  const { session, ids } = useServices();
  const { scenario } = useEditor();
  const { goals } = scenario;

  return (
    <PanelSection
      title={
        <>
          Goals
          <Button
            small
            icon="plus"
            className="font-normal font-stretch-normal"
            onClick={() =>
              session.execute(
                addGoalCmd({ id: ids.next(), text: 'New goal', vp: 1, scoring: 'each-phase' }),
              )
            }
          >
            Add
          </Button>
        </>
      }
    >
      {goals.length === 0 ? (
        <Hint as="p">
          No goals yet. Victory points for defeating units and Garrisons are scored as usual.
        </Hint>
      ) : null}
      {goals.map((g, i) => (
        <GoalRow
          key={g.id}
          goal={g}
          index={i}
          count={goals.length}
          onBeginEdit={() => session.begin('Edit goal')}
          onEndEdit={() => session.commit()}
          onChange={(patch) => session.execute(updateGoalCmd(g.id, patch))}
          onMove={(d) => session.execute(moveGoalCmd(g.id, i + d))}
          onRemove={() => session.execute(removeGoalCmd(g.id))}
        />
      ))}
    </PanelSection>
  );
}
