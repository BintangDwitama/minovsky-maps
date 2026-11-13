import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { EditorSession, EditorSnapshot } from '../../application/editorSession';
import type {
  Clipboard,
  Compressor,
  DraftStore,
  FileWriter,
  IdGenerator,
  ImageExporter,
  PublicationStore,
  ScenarioFileReader,
  ScenarioPublisher,
} from '../../application/ports';
import type { UiState, UiStore } from '../../application/uiState';
import { computeWarnings, type Warning } from '../../domain/warnings';

/** Everything organisms may depend on. Built once in the page (composition root). */
export interface EditorServices {
  readonly session: EditorSession;
  readonly ui: UiStore;
  readonly ids: IdGenerator;
  readonly reader: ScenarioFileReader;
  readonly writer: FileWriter;
  readonly drafts: DraftStore;
  readonly exporter: ImageExporter;
  readonly compressor: Compressor;
  readonly clipboard: Clipboard;
  readonly publisher: ScenarioPublisher;
  readonly publications: PublicationStore;
}

const Ctx = createContext<EditorServices | null>(null);

export function EditorProvider({
  services,
  children,
}: {
  services: EditorServices;
  children: ReactNode;
}) {
  return <Ctx.Provider value={services}>{children}</Ctx.Provider>;
}

export const useServices = (): EditorServices => {
  const s = useContext(Ctx);
  if (!s) throw new Error('useServices must be used inside <EditorProvider>');
  return s;
};

export const useEditor = (): EditorSnapshot => {
  const { session } = useServices();
  return useSyncExternalStore(session.subscribe, session.getSnapshot);
};

export const useUi = (): UiState => {
  const { ui } = useServices();
  return useSyncExternalStore(ui.subscribe, ui.getSnapshot);
};

export const useWarnings = (): Warning[] => {
  const { scenario } = useEditor();
  return useMemo(() => computeWarnings(scenario), [scenario]);
};

/**
 * Props that group a text/number field's edits into one undo step per focus session.
 * Spread onto inputs: onFocus begins a transaction, onBlur commits it.
 */
export const useTransactionalField = (label: string) => {
  const { session } = useServices();
  return useMemo(
    () => ({
      onFocus: () => session.begin(label),
      onBlur: () => session.commit(),
    }),
    [session, label],
  );
};
