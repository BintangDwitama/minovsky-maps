import { useCallback, useEffect, useRef, useState } from 'react';
import { removeComponentCmd, resizeBoardCmd, rotateCarrierCmd } from '../../application/commands';
import { EditorSession } from '../../application/editorSession';
import { createShareLink, editSharedCopy, openScenarioLink } from '../../application/shareLink';
import { UiStore } from '../../application/uiState';
import {
  exportPng,
  findDraft,
  newScenario,
  openFromBlob,
  openFromPicker,
  restoreDraft,
  saveScenario,
  startDraftAutosave,
  type UseCaseResult,
} from '../../application/useCases';
import { planResize } from '../../domain/operations';
import { createScenario, rectangleSize, type Scenario } from '../../domain/scenario';
import { BrowserClipboard } from '../../infrastructure/browserClipboard';
import { BrowserFileReader, DownloadFileWriter } from '../../infrastructure/browserFiles';
import { FflateCompressor } from '../../infrastructure/fflateCompressor';
import { LocalStorageDraftStore } from '../../infrastructure/localStorageDraftStore';
import { RandomIdGenerator } from '../../infrastructure/randomIds';
import { SvgPngExporter } from '../../infrastructure/svgPngExporter';
import { renderBoardSvg } from '../export/renderBoardSvg';
import { EditorProvider, type EditorServices, useEditor } from '../hooks/editorContext';
import { LINK_FAILURE } from '../linkMessages';
import { ConfirmDialog, ErrorList, NewScenarioDialog, ShareLinkDialog } from '../organisms/dialogs';
import { appAddress, navigate, replaceHashSilently, viewHash } from '../router';
import { GoalsEditor } from '../organisms/GoalsEditor';
import { HexBoard } from '../organisms/HexBoard';
import { ScenarioInspector } from '../organisms/ScenarioInspector';
import { ScenarioSettingsPanel } from '../organisms/ScenarioSettingsPanel';
import { StatusBar } from '../organisms/StatusBar';
import { ComponentPalette, TOOL_SHORTCUTS, ToolPalette } from '../organisms/ToolPalette';
import { Toolbar } from '../organisms/Toolbar';
import { PillarCount, WarningsPanel } from '../organisms/WarningsPanel';
import { EditorLayout } from '../templates/EditorLayout';

/** Composition root: builds concrete infrastructure and injects it through context. */
const buildServices = (): EditorServices => ({
  session: new EditorSession(createScenario()),
  ui: new UiStore(),
  ids: new RandomIdGenerator(),
  reader: new BrowserFileReader(),
  writer: new DownloadFileWriter(),
  drafts: new LocalStorageDraftStore(),
  exporter: new SvgPngExporter(renderBoardSvg),
  compressor: new FflateCompressor(),
  clipboard: new BrowserClipboard(),
});

export interface EditorPageProps {
  /** A share link (`<codec>.<payload>`) to open as an unsaved copy ("Edit a copy"). */
  importLink?: string | null;
}

export function EditorPage({ importLink = null }: EditorPageProps) {
  const [services] = useState(buildServices);
  return (
    <EditorProvider services={services}>
      <Editor services={services} importLink={importLink} />
    </EditorProvider>
  );
}

type DialogState =
  | { kind: 'none' }
  | { kind: 'new' }
  | { kind: 'resize'; initial?: { width: number; height: number } }
  | { kind: 'confirm-resize'; width: number; height: number; removed: number }
  | { kind: 'unsaved'; proceed: () => void }
  | { kind: 'draft'; draft: Scenario }
  | { kind: 'share'; link: string; copied: boolean; long: boolean }
  | { kind: 'replace-with-shared'; scenario: Scenario; link: string }
  | { kind: 'errors'; title: string; intro: string; errors: string[] };

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);

function Editor({ services, importLink }: { services: EditorServices; importLink: string | null }) {
  const { session, ui, reader, writer, drafts, exporter, compressor, clipboard } = services;
  const { dirty } = useEditor();
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' });
  const close = useCallback(() => setDialog({ kind: 'none' }), []);

  const resetView = useCallback(() => {
    ui.patch({
      selectedId: null,
      highlight: [],
      hover: null,
      zoom: 1,
      pan: { x: 0, y: 0 },
      message: null,
    });
  }, [ui]);

  const report = useCallback((r: UseCaseResult, title: string, intro: string) => {
    if (r.ok === false) setDialog({ kind: 'errors', title, intro, errors: r.errors });
  }, []);

  /** Run `action` now, or after confirming that unsaved changes may be discarded. */
  const guardUnsaved = useCallback(
    (action: () => void) => {
      if (session.getSnapshot().dirty) setDialog({ kind: 'unsaved', proceed: action });
      else action();
    },
    [session],
  );

  const onNew = () => guardUnsaved(() => setDialog({ kind: 'new' }));
  const onOpen = () =>
    guardUnsaved(async () => {
      close();
      const r = await openFromPicker(session, reader);
      if (r.ok === true) resetView();
      report(r, 'Could not open file', 'This file is not a valid scenario:');
    });
  const onDrop = (file: File) =>
    guardUnsaved(async () => {
      close();
      const r = await openFromBlob(session, reader, file);
      if (r.ok === true) resetView();
      report(r, 'Could not open file', `"${file.name}" is not a valid scenario:`);
    });
  const onSave = useCallback(async () => {
    session.commit();
    report(await saveScenario(session, writer, drafts), "Can't save yet", 'Fix these first:');
  }, [session, writer, drafts, report]);
  const onExport = async () =>
    report(
      await exportPng(session, exporter, writer),
      'Export failed',
      'The image could not be created:',
    );
  const onShare = async () => {
    session.commit();
    const r = createShareLink(session.scenario, appAddress(), compressor);
    if (!r.ok) {
      setDialog({
        kind: 'errors',
        title: "Can't share yet",
        intro: 'Fix these first:',
        errors: r.errors,
      });
      return;
    }
    const copied = await clipboard.writeText(r.link);
    setDialog({ kind: 'share', link: r.link, copied, long: r.long });
  };

  const onResizeRequest = () =>
    setDialog({ kind: 'resize', initial: rectangleSize(session.scenario) ?? undefined });
  const applyResize = (width: number, height: number) => {
    session.execute(resizeBoardCmd(width, height));
    ui.patch({ highlight: [] });
    if (
      ui.current.selectedId &&
      !session.scenario.components.some((c) => c.id === ui.current.selectedId)
    )
      ui.select(null);
    close();
  };

  const requestLabel = useCallback(
    (kindLabel: string) => window.prompt(`Label for this ${kindLabel.toLowerCase()}:`),
    [],
  );

  /* ---- draft restore + autosave (an "Edit a copy" import handles the draft itself) ---- */
  const importedAtMount = useRef(importLink !== null);
  useEffect(() => {
    if (!importedAtMount.current) {
      const draft = findDraft(drafts);
      if (draft) setDialog({ kind: 'draft', draft });
    }
    return startDraftAutosave(session, drafts);
  }, [session, drafts]);

  /* ---- "Edit a copy" from a shared scenario ---- */
  const handledImport = useRef<string | null>(null);
  useEffect(() => {
    if (!importLink || handledImport.current === importLink) return;
    handledImport.current = importLink;
    replaceHashSilently('#/');
    const r = openScenarioLink(importLink, compressor);
    if (!r.ok) {
      const msg = LINK_FAILURE[r.reason];
      setDialog({
        kind: 'errors',
        title: msg.title,
        intro: msg.body,
        errors: r.reason === 'invalid' ? r.errors : [],
      });
      return;
    }
    if (session.getSnapshot().dirty || findDraft(drafts)) {
      setDialog({ kind: 'replace-with-shared', scenario: r.scenario, link: importLink });
    } else {
      editSharedCopy(session, r.scenario);
      resetView();
    }
  }, [importLink, compressor, session, drafts, resetView]);

  /* ---- leaving the page with unsaved changes ---- */
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  /* ---- keyboard shortcuts ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 's') {
        e.preventDefault();
        void onSave();
        return;
      }
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (isTyping(e.target)) return;
      if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        session.undo();
      } else if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        session.redo();
      } else if (!mod && (e.key === 'Delete' || e.key === 'Backspace')) {
        const id = ui.current.selectedId;
        if (id) {
          e.preventDefault();
          session.execute(removeComponentCmd(id));
          ui.select(null);
        }
      } else if (!mod && key === 'r') {
        const id = ui.current.selectedId;
        const c = id ? session.scenario.components.find((x) => x.id === id) : undefined;
        if (c?.kind === 'carrier') {
          const r = session.execute(rotateCarrierCmd(c.id, e.shiftKey ? -1 : 1));
          if (!r.ok) ui.flash(r.reason);
        }
      } else if (e.key === 'Escape') {
        ui.patch({ selectedId: null, highlight: [], tool: 'select' });
      } else if (!mod && !e.altKey) {
        const t = TOOL_SHORTCUTS[key];
        if (t) ui.setTool(t);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session, ui, onSave]);

  return (
    <EditorLayout
      onFileDrop={onDrop}
      toolbar={
        <Toolbar
          onNew={onNew}
          onOpen={onOpen}
          onSave={() => void onSave()}
          onShare={() => void onShare()}
          onExport={() => void onExport()}
        />
      }
      left={
        <>
          <ToolPalette />
          <ComponentPalette />
        </>
      }
      board={<HexBoard requestLabel={requestLabel} />}
      right={
        <>
          <ScenarioInspector />
          <WarningsPanel />
          <PillarCount />
          <ScenarioSettingsPanel onResize={onResizeRequest} />
          <GoalsEditor />
        </>
      }
      status={<StatusBar />}
      overlay={
        <>
          {dialog.kind === 'new' ? (
            <NewScenarioDialog
              mode="new"
              onCancel={close}
              onSubmit={(size) => {
                report(newScenario(session, size), 'Could not create scenario', 'Problem:');
                resetView();
                close();
              }}
            />
          ) : null}

          {dialog.kind === 'resize' ? (
            <NewScenarioDialog
              mode="resize"
              initial={dialog.initial}
              onCancel={close}
              onSubmit={({ width, height }) => {
                const removed = planResize(session.scenario, width, height).removedComponents
                  .length;
                if (removed > 0) setDialog({ kind: 'confirm-resize', width, height, removed });
                else applyResize(width, height);
              }}
            />
          ) : null}

          {dialog.kind === 'confirm-resize' ? (
            <ConfirmDialog
              title="Remove components?"
              danger
              confirmLabel={`Resize and remove ${dialog.removed}`}
              onCancel={close}
              onConfirm={() => applyResize(dialog.width, dialog.height)}
            >
              Resizing to {dialog.width} × {dialog.height} removes {dialog.removed} component
              {dialog.removed === 1 ? '' : 's'} that would be off the board. You can undo this.
            </ConfirmDialog>
          ) : null}

          {dialog.kind === 'unsaved' ? (
            <ConfirmDialog
              title="Discard unsaved changes?"
              danger
              confirmLabel="Discard changes"
              onCancel={close}
              onConfirm={() => {
                close();
                dialog.proceed();
              }}
            >
              The current scenario has changes that haven't been saved to a file.
            </ConfirmDialog>
          ) : null}

          {dialog.kind === 'draft' ? (
            <ConfirmDialog
              title="Restore unsaved draft?"
              confirmLabel="Restore draft"
              cancelLabel="Discard"
              onCancel={() => {
                drafts.clear();
                close();
              }}
              onConfirm={() => {
                restoreDraft(session, dialog.draft);
                resetView();
                close();
              }}
            >
              You have unsaved work from a previous session:{' '}
              <strong>{dialog.draft.meta.name}</strong>.
            </ConfirmDialog>
          ) : null}

          {dialog.kind === 'share' ? (
            <ShareLinkDialog
              link={dialog.link}
              copied={dialog.copied}
              long={dialog.long}
              onClose={close}
            />
          ) : null}

          {dialog.kind === 'replace-with-shared' ? (
            <ConfirmDialog
              title="Replace your unsaved work?"
              danger
              confirmLabel="Open the shared copy"
              cancelLabel="Keep my work"
              onCancel={() => {
                close();
                navigate(viewHash(dialog.link));
              }}
              onConfirm={() => {
                editSharedCopy(session, dialog.scenario);
                resetView();
                close();
              }}
            >
              You have unsaved changes in the editor. Opening{' '}
              <strong>{dialog.scenario.meta.name}</strong> replaces them.
            </ConfirmDialog>
          ) : null}

          {dialog.kind === 'errors' ? (
            <ConfirmDialog
              title={dialog.title}
              cancelLabel={null}
              onCancel={close}
              onConfirm={close}
            >
              <ErrorList intro={dialog.intro} errors={dialog.errors} />
            </ConfirmDialog>
          ) : null}
        </>
      }
    />
  );
}
