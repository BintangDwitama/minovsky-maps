import { useCallback, useEffect, useRef, useState } from 'react';
import {
  openPublished,
  rememberEditToken,
  reportScenario,
  shortLink,
} from '../../application/publishing';
import { encodeScenarioLink } from '../../application/shareLink';
import type { Scenario } from '../../domain/scenario';
import { BrowserClipboard } from '../../infrastructure/browserClipboard';
import { DownloadFileWriter } from '../../infrastructure/browserFiles';
import { FflateCompressor } from '../../infrastructure/fflateCompressor';
import { HttpScenarioPublisher } from '../../infrastructure/httpScenarioPublisher';
import { TurnstileHumanCheck } from '../../infrastructure/turnstileHumanCheck';
import { LocalStoragePublicationStore } from '../../infrastructure/localStoragePublicationStore';
import { SvgPngExporter } from '../../infrastructure/svgPngExporter';
import { Button } from '../atoms/Button';
import { renderBoardSvg } from '../export/renderBoardSvg';
import { ErrorList } from '../organisms/dialogs';
import { ReportDialog } from '../organisms/ReportDialog';
import { PUBLISH_FAILURE } from '../publishMessages';
import { appAddress, editHash, editPublishedHash, navigate, replaceHashSilently } from '../router';
import { SheetMessage, SheetView } from './SheetView';

/** Composition root of the published-scenario sheet. */
const buildServices = () => ({
  publisher: new HttpScenarioPublisher({
    humanCheck: new TurnstileHumanCheck(import.meta.env.VITE_TURNSTILE_SITE_KEY),
  }),
  publications: new LocalStoragePublicationStore(),
  compressor: new FflateCompressor(),
  clipboard: new BrowserClipboard(),
  writer: new DownloadFileWriter(),
  exporter: new SvgPngExporter(renderBoardSvg),
});

type State =
  | { kind: 'loading'; slow: boolean }
  | { kind: 'ready'; scenario: Scenario }
  | { kind: 'not-found' }
  | { kind: 'invalid'; errors: string[] }
  | { kind: 'unavailable' };

export interface PublishedSheetPageProps {
  id: string;
  /** From a private edit link (`#edit=<token>`): remembered, then removed from the address. */
  editToken: string | null;
}

/** `/s/<id>`: the latest published version of a scenario. */
export function PublishedSheetPage({ id, editToken }: PublishedSheetPageProps) {
  const [services] = useState(buildServices);
  const [state, setState] = useState<State>({ kind: 'loading', slow: false });
  const [canEdit, setCanEdit] = useState(() => services.publications.get(id) !== null);
  const [reporting, setReporting] = useState(false);

  // a private edit link: remember the token in this browser and take it out of the address bar
  const tokenHandled = useRef(false);
  useEffect(() => {
    if (!editToken || tokenHandled.current) return;
    tokenHandled.current = true;
    rememberEditToken(services.publications, id, editToken);
    replaceHashSilently(`${location.pathname}${location.search}`);
    setCanEdit(true);
  }, [editToken, id, services]);

  const load = useCallback(() => {
    let active = true;
    setState({ kind: 'loading', slow: false });
    void openPublished(id, services.publisher, {
      onSlow: () => active && setState({ kind: 'loading', slow: true }),
    }).then((r) => {
      if (!active) return;
      if (r.ok) {
        setState({ kind: 'ready', scenario: r.scenario });
        const known = services.publications.get(id);
        if (known) services.publications.save({ ...known, name: r.scenario.meta.name });
      } else if (r.failure === 'not-found') setState({ kind: 'not-found' });
      else if (r.failure === 'invalid') setState({ kind: 'invalid', errors: r.errors });
      else setState({ kind: 'unavailable' });
    });
    return () => {
      active = false;
    };
  }, [id, services]);
  useEffect(() => load(), [load]);

  const openEditor = (
    <Button variant="primary" icon="new" onClick={() => navigate('#/')}>
      Open the editor
    </Button>
  );

  switch (state.kind) {
    case 'loading':
      return (
        <SheetMessage title="Loading scenario…" busy testId="published-loading">
          {state.slow ? (
            <p>
              Waking up the server. Free hosting goes to sleep when it’s quiet, so this can take up
              to a minute.
            </p>
          ) : null}
        </SheetMessage>
      );
    case 'not-found':
      return (
        <SheetMessage title="Scenario not found" testId="published-not-found" actions={openEditor}>
          <p>This link doesn’t point to a published scenario. It may have been taken down.</p>
        </SheetMessage>
      );
    case 'invalid':
      return (
        <SheetMessage title="This scenario can’t be shown" actions={openEditor}>
          <ErrorList intro="The published data has problems:" errors={state.errors} />
        </SheetMessage>
      );
    case 'unavailable':
      return (
        <SheetMessage
          title="Server unavailable"
          testId="published-unavailable"
          actions={
            <>
              <Button variant="primary" icon="rotateCw" onClick={() => load()}>
                Try again
              </Button>
              {openEditor}
            </>
          }
        >
          <p>The publishing server didn’t answer. Check your connection and try again.</p>
        </SheetMessage>
      );
    case 'ready': {
      const s = state.scenario;
      return (
        <SheetView
          scenario={s}
          link={shortLink(appAddress(), id)}
          storedIn="server"
          services={services}
          editActions={
            <>
              {canEdit ? (
                <Button
                  variant="frame"
                  icon="edit"
                  onClick={() => navigate(editPublishedHash(id))}
                  title="Edit and update this published scenario"
                >
                  Edit
                </Button>
              ) : null}
              <Button
                variant="frame"
                icon={canEdit ? 'new' : 'edit'}
                onClick={() => navigate(editHash(encodeScenarioLink(s, services.compressor)))}
                title="Open your own unpublished copy in the editor"
              >
                Edit a copy
              </Button>
            </>
          }
          trailingActions={
            <Button
              variant="frame"
              icon="flag"
              onClick={() => setReporting(true)}
              title="Tell the site owner about a problem with this scenario"
            >
              Report
            </Button>
          }
          extraOverlay={
            reporting ? (
              <ReportDialog
                scenarioName={s.meta.name}
                onClose={() => setReporting(false)}
                onSend={async (reason, details) => {
                  const r = await reportScenario(services.publisher, {
                    scenarioId: id,
                    reason,
                    details,
                  });
                  if (r.ok) return { ok: true };
                  const msg = PUBLISH_FAILURE[r.failure];
                  return {
                    ok: false,
                    title:
                      r.failure === 'not-found'
                        ? 'This scenario no longer exists.'
                        : r.failure === 'blocked'
                          ? 'Please check the form:'
                          : `${msg.title}.`,
                    errors: r.failure === 'not-found' ? [] : r.errors,
                  };
                }}
              />
            ) : null
          }
        />
      );
    }
  }
}
