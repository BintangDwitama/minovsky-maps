import { IconButton, Button } from '../atoms/Button';
import { useEditor, useServices } from '../hooks/editorContext';

export interface ToolbarProps {
  onNew(): void;
  onOpen(): void;
  onSave(): void;
  onExport(): void;
}

export function Toolbar({ onNew, onOpen, onSave, onExport }: ToolbarProps) {
  const { session } = useServices();
  const { scenario, canUndo, canRedo, dirty, undoLabel, redoLabel } = useEditor();
  return (
    <header className="toolbar">
      <span className="toolbar__brand">Minovsky Maps</span>
      <Button icon="new" onClick={onNew}>
        New
      </Button>
      <Button icon="open" onClick={onOpen} title="Open a .scenario.json file (or drop one on the board)">
        Open
      </Button>
      <Button icon="save" onClick={onSave} title="Save (Ctrl+S)">
        Save
      </Button>
      <Button icon="image" onClick={onExport}>
        Export PNG
      </Button>
      <span className="toolbar__sep" />
      <IconButton
        icon="undo"
        label={undoLabel ? `Undo ${undoLabel} (Ctrl+Z)` : 'Undo (Ctrl+Z)'}
        disabled={!canUndo}
        onClick={() => session.undo()}
      />
      <IconButton
        icon="redo"
        label={redoLabel ? `Redo ${redoLabel} (Ctrl+Y)` : 'Redo (Ctrl+Y)'}
        disabled={!canRedo}
        onClick={() => session.redo()}
      />
      <span className="toolbar__title" title={scenario.meta.name}>
        {scenario.meta.name || 'Untitled'}
        {dirty ? ' •' : ''}
      </span>
      <span className="toolbar__spacer" />
      <span className="field__hint">Unofficial fan tool</span>
    </header>
  );
}
