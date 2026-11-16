import { IconButton, Button } from '../atoms/Button';
import { useEditor } from '../hooks/editorContext';
import { useHistory } from '../hooks/useHistory';
import { BrandMark } from '../atoms/BrandMark';
import { Brand } from '../molecules/Brand';
import { Menu } from '../molecules/Menu';
import { useAccountMenu } from './AccountMenu';
import { BROWSE_PATH, goToPath } from '../router';
import type { ReactNode } from 'react';

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
  /** Small screens: one row with history, Share and a menu for the rest. */
  compact?: boolean;
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
  compact,
}: ToolbarProps) {
  const { undo, redo } = useHistory();
  const acct = useAccountMenu();
  const { scenario, canUndo, canRedo, dirty, undoLabel, redoLabel } = useEditor();

  const history = (
    <>
      <IconButton
        variant="frame"
        icon="undo"
        label={undoLabel ? `Undo ${undoLabel} (Ctrl+Z)` : 'Undo (Ctrl+Z)'}
        disabled={!canUndo}
        onClick={undo}
      />
      <IconButton
        variant="frame"
        icon="redo"
        label={redoLabel ? `Redo ${redoLabel} (Ctrl+Y)` : 'Redo (Ctrl+Y)'}
        disabled={!canRedo}
        onClick={redo}
      />
    </>
  );

  if (compact) {
    return (
      <header className="flex items-center gap-1 border-b-2 border-vent bg-frame px-1.5 py-1 text-frame-ink">
        <span className="flex min-w-0 flex-1 items-center gap-2 pl-1">
          <HomeLink>
            <BrandMark />
          </HomeLink>
          <span
            className="truncate font-semibold font-stretch-condensed"
            title={scenario.meta.name}
            data-testid="scenario-title"
          >
            {scenario.meta.name || 'Untitled'}
            {dirty ? <span className="text-vent"> •</span> : null}
          </span>
        </span>
        {history}
        <IconButton
          variant="frame"
          icon="link"
          label="Share: copy a link that opens this scenario for anyone"
          onClick={onShare}
        />
        <Menu
          label="Menu"
          footer="Minovsky Maps · Unofficial fan tool"
          items={[
            { label: 'New', icon: 'new', onSelect: onNew },
            { label: 'Open', icon: 'open', onSelect: onOpen },
            { label: 'Save', icon: 'save', onSelect: onSave },
            {
              label: publishMode === 'update' ? 'Update online' : 'Save online',
              icon: 'upload',
              onSelect: onPublish,
            },
            { label: 'My scenarios', icon: 'list', onSelect: onMyScenarios },
            { label: 'Browse scenarios', icon: 'grid', onSelect: () => goToPath(BROWSE_PATH) },
            { label: 'Export PNG', icon: 'image', onSelect: onExport },
            ...(acct.hidden
              ? []
              : acct.signedIn
                ? acct.items
                : [{ label: 'Sign in with Google', icon: 'user' as const, onSelect: acct.signIn }]),
          ]}
        />
        {acct.dialogs}
      </header>
    );
  }

  return (
    <header className="flex flex-wrap items-center gap-1 border-b-2 border-vent bg-frame px-2.5 py-1.5 text-frame-ink">
      <HomeLink>
        <Brand />
      </HomeLink>
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
            ? 'Save this version online; its link shows it immediately'
            : 'Save to your account, then choose who can see it'
        }
      >
        {publishMode === 'update' ? 'Update online' : 'Save online'}
      </Button>
      <Button
        variant="frame"
        icon="list"
        onClick={onMyScenarios}
        title="Your scenarios saved online"
      >
        My scenarios
      </Button>
      <Button
        variant="frame"
        icon="grid"
        onClick={() => goToPath(BROWSE_PATH)}
        title="Find scenarios other players share"
      >
        Browse
      </Button>
      <Button variant="frame" icon="image" onClick={onExport}>
        Export PNG
      </Button>
      <span className="mx-1.5 h-5.5 w-px bg-frame-2" aria-hidden />
      {history}
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
      {acct.hidden ? null : acct.signedIn ? (
        <Menu label={acct.label} icon="user" items={acct.items} />
      ) : (
        <Button variant="frame" icon="user" onClick={acct.signIn}>
          Sign in
        </Button>
      )}
      {acct.dialogs}
    </header>
  );
}

/** The brand, linking to the landing page (the draft is autosaved, so leaving is safe). */
function HomeLink({ children }: { children: ReactNode }) {
  return (
    <a
      href="/"
      title="Minovsky Maps home"
      className="flex items-center rounded-ui focus-visible:outline-vent coarse:min-h-11"
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        goToPath('/');
      }}
    >
      {children}
    </a>
  );
}
