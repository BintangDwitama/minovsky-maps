import { useMemo, useState } from 'react';
import { openScenarioLink } from '../../application/shareLink';
import { BrowserClipboard } from '../../infrastructure/browserClipboard';
import { DownloadFileWriter } from '../../infrastructure/browserFiles';
import { FflateCompressor } from '../../infrastructure/fflateCompressor';
import { SvgPngExporter } from '../../infrastructure/svgPngExporter';
import { Button } from '../atoms/Button';
import { renderBoardSvg } from '../export/renderBoardSvg';
import { LINK_FAILURE } from '../linkMessages';
import { ErrorList } from '../organisms/dialogs';
import { appAddress, editHash, navigate, viewHash } from '../router';
import { SheetMessage, SheetView } from './SheetView';

/** Composition root of the share-link sheet. */
const buildServices = () => ({
  compressor: new FflateCompressor(),
  clipboard: new BrowserClipboard(),
  writer: new DownloadFileWriter(),
  exporter: new SvgPngExporter(renderBoardSvg),
});

/** Sheet for a self-contained share link (`#/view/<link>`). */
export function SheetPage({ link }: { link: string }) {
  const [services] = useState(buildServices);
  const result = useMemo(() => openScenarioLink(link, services.compressor), [link, services]);

  if (!result.ok) {
    const msg = LINK_FAILURE[result.reason];
    return (
      <SheetMessage
        title={msg.title}
        testId="link-error"
        actions={
          <Button variant="primary" icon="new" onClick={() => navigate('#/')}>
            Open the editor
          </Button>
        }
      >
        <ErrorList intro={msg.body} errors={result.reason === 'invalid' ? result.errors : []} />
      </SheetMessage>
    );
  }

  return (
    <SheetView
      scenario={result.scenario}
      link={`${appAddress()}${viewHash(link)}`}
      storedIn="link"
      services={services}
      editActions={
        <Button variant="frame" icon="edit" onClick={() => navigate(editHash(link))}>
          Edit a copy
        </Button>
      }
    />
  );
}
