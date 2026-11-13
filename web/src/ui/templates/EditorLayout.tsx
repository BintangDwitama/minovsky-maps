import { useId, useState, type DragEvent, type ReactNode } from 'react';
import { IconButton } from '../atoms/Button';
import { TabBar } from '../molecules/TabBar';

type Drawer = 'tools' | 'scenario';

export interface EditorLayoutProps {
  toolbar: ReactNode;
  left: ReactNode;
  board: ReactNode;
  right: ReactNode;
  status: ReactNode;
  overlay?: ReactNode;
  onFileDrop?(file: File): void;
  /**
   * Compact layout (narrow screens): the board fills the screen, `left` and `right` live in a
   * bottom drawer opened from a tab bar.
   */
  compact?: boolean;
  /** Compact: shown on the Tools tab, e.g. the current tool. */
  toolsDetail?: string;
  /** Compact: the drawer closes whenever this changes (a tool or component kind was picked). */
  drawerCloseKey?: string;
  /** Compact: bar above the status line; `openDetails` opens the Scenario drawer. */
  selectionBar?(openDetails: () => void): ReactNode;
}

/**
 * Desktop: toolbar on top, tools left, board centre, panels right, status bar bottom.
 * Side panels only scroll vertically; their content must fit their fixed widths.
 * Compact: one-row toolbar, full-height board, selection bar, status, tab bar with drawers.
 */
export function EditorLayout(props: EditorLayoutProps) {
  const { onFileDrop, overlay } = props;
  const [dragging, setDragging] = useState(false);
  const hasFile = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

  const dropProps = {
    onDragOver: (e: DragEvent) => {
      if (!onFileDrop || !hasFile(e)) return;
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: (e: DragEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      setDragging(false);
    },
    onDrop: (e: DragEvent) => {
      if (!onFileDrop || !hasFile(e)) return;
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) onFileDrop(f);
    },
  };
  const dropHint = dragging ? (
    <div className="pointer-events-none absolute inset-3 grid place-items-center rounded-xl border-2 border-dashed border-accent bg-black/45 text-lg text-white">
      Drop a .scenario.json file to open it
    </div>
  ) : null;

  if (props.compact) return <CompactLayout {...props} dropProps={dropProps} dropHint={dropHint} />;

  return (
    <div
      className="grid h-full min-h-0 grid-cols-[220px_minmax(0,1fr)_320px] grid-rows-[auto_minmax(0,1fr)_auto] [grid-template-areas:'toolbar_toolbar_toolbar'_'left_board_right'_'status_status_status']"
      {...dropProps}
    >
      <div className="[grid-area:toolbar]">{props.toolbar}</div>
      <aside
        className="min-w-0 overflow-x-hidden overflow-y-auto border-r border-border bg-panel p-2.5 [grid-area:left]"
        aria-label="Tools"
      >
        {props.left}
      </aside>
      <main className="relative min-h-0 min-w-0 deck [grid-area:board]">
        {props.board}
        {dropHint}
      </main>
      <aside
        className="min-w-0 overflow-x-hidden overflow-y-auto border-l border-border bg-panel [grid-area:right]"
        aria-label="Scenario panels"
      >
        {props.right}
      </aside>
      <div className="[grid-area:status]">{props.status}</div>
      {overlay}
    </div>
  );
}

function CompactLayout({
  toolbar,
  left,
  board,
  right,
  status,
  overlay,
  toolsDetail,
  drawerCloseKey,
  selectionBar,
  dropProps,
  dropHint,
}: EditorLayoutProps & {
  dropProps: Record<string, (e: DragEvent) => void>;
  dropHint: ReactNode;
}) {
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const drawerId = useId();

  // picking a tool or component kind frees the board (reset during render: no extra frame)
  const [closeKey, setCloseKey] = useState(drawerCloseKey);
  if (closeKey !== drawerCloseKey) {
    setCloseKey(drawerCloseKey);
    setDrawer(null);
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col" {...dropProps}>
      {toolbar}
      {/* nothing in this column may change height while the board is in use: a resize
          re-centres the board under the finger. Overlays sit on top of the board instead. */}
      <main className="relative min-h-0 flex-1 deck">
        {board}
        {dropHint}
        {drawer ? null : (
          <div className="absolute inset-x-0 top-0 z-10">
            {selectionBar?.(() => setDrawer('scenario'))}
          </div>
        )}
        {drawer ? (
          <section
            id={drawerId}
            aria-label={drawer === 'tools' ? 'Tools' : 'Scenario panels'}
            className="absolute inset-x-0 bottom-0 z-10 flex max-h-[min(65dvh,100%)] flex-col border-t-2 border-vent bg-panel shadow-[0_-6px_18px_rgb(0_0_0/0.25)]"
            data-testid="drawer"
          >
            <div className="flex items-center justify-between border-b border-border py-0.5 pr-1 pl-3">
              <h2 className="font-semibold font-stretch-condensed">
                {drawer === 'tools' ? 'Tools' : 'Scenario'}
              </h2>
              <IconButton
                icon="close"
                label="Close panel"
                className="bg-transparent shadow-none"
                onClick={() => setDrawer(null)}
              />
            </div>
            <div
              className={
                drawer === 'tools'
                  ? 'min-h-0 overflow-y-auto overscroll-contain p-2.5'
                  : 'min-h-0 overflow-y-auto overscroll-contain'
              }
            >
              {drawer === 'tools' ? left : right}
            </div>
          </section>
        ) : null}
      </main>
      {status}
      <TabBar<Drawer>
        controls={drawerId}
        open={drawer}
        onToggle={(id) => setDrawer((d) => (d === id ? null : id))}
        tabs={[
          { id: 'tools', label: 'Tools', detail: toolsDetail },
          { id: 'scenario', label: 'Scenario' },
        ]}
      />
      {overlay}
    </div>
  );
}
