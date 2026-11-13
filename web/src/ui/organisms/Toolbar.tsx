import { IconButton, Button } from '../atoms/Button';
import { useEditor, useServices } from '../hooks/editorContext';
import { Brand } from '../molecules/Brand';

export interface ToolbarProps {
  onNew(): void;
  onOpen(): void;
  onSave(): void;
  onShare(): void;
  onExport(): void;
  onPublish(): void;
  /** Update when the open document is a published scenario this browser can edit. */
  publishMode: 'publish' | 'update';
  onMyScenarios(): void;
}

/** The navy frame along the top: brand, file actions, history, scenario title. */
export function Toolbar({
  onNew,
  onOpen,
  onSave,
  onShare,
  onExport,
  onPublish,
  publishMode,
  onMyScenarios,
}: ToolbarProps) {
  const { session } = useServices();
  const { scenario, canUndo, canRedo, dirty, undoLabel, redoLabel } = useEditor();
  return (
    <header className="flex flex-wrap items-center gap-1 border-b-2 border-vent bg-frame px-2.5 py-1.5 text-frame-ink">
      <Brand />
      <Button variant="frame" icon="new" onClick={onNew}>
        New
      </Button>
      <Button
        variant="frame"
        icon="open"
        onClick={onOpen}
        title="Open a .scenario.json file (or drop one on the board)"
      >
        Open
      </Button>
      <Button variant="frame" icon="save" onClick={onSave} title="Save (Ctrl+S)">
        Save
      </Button>
      <Button
        variant="frame"
        icon="link"
        onClick={onShare}
        title="Copy a link that opens this scenario for anyone"
      >
        Share
      </Button>
      <Button
        variant="frame"
        icon="upload"
        onClick={onPublish}
        title={
          publishMode === 'update'
            ? 'Save this version to the published scenario; its short link shows it immediately'
            : 'Publish to get a short link you can keep updating'
        }
      >
        {publishMode === 'update' ? 'Update' : 'Publish'}
      </Button>
      <Button
        variant="frame"
        icon="list"
        onClick={onMyScenarios}
        title="Scenarios published from this browser"
      >
        My scenarios
      </Button>
      <Button variant="frame" icon="image" onClick={onExport}>
        Export PNG
      </Button>
      <span className="mx-1.5 h-5.5 w-px bg-frame-2" aria-hidden />
      <IconButton
        variant="frame"
        icon="undo"
        label={undoLabel ? `Undo ${undoLabel} (Ctrl+Z)` : 'Undo (Ctrl+Z)'}
        disabled={!canUndo}
        onClick={() => session.undo()}
      />
      <IconButton
        variant="frame"
        icon="redo"
        label={redoLabel ? `Redo ${redoLabel} (Ctrl+Y)` : 'Redo (Ctrl+Y)'}
        disabled={!canRedo}
        onClick={() => session.redo()}
      />
      <span
        className="ml-3 max-w-[30vw] truncate font-semibold font-stretch-condensed"
        title={scenario.meta.name}
        data-testid="scenario-title"
      >
        {scenario.meta.name || 'Untitled'}
        {dirty ? <span className="text-vent"> •</span> : null}
      </span>
      <span className="flex-1" />
      <span className="text-xs text-frame-muted">Unofficial fan tool</span>
    </header>
  );
}
