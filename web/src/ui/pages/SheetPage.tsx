import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { openScenarioLink } from '../../application/shareLink';
import { downloadScenarioFile, exportScenarioPng } from '../../application/useCases';
import { BrowserClipboard } from '../../infrastructure/browserClipboard';
import { DownloadFileWriter } from '../../infrastructure/browserFiles';
import { FflateCompressor } from '../../infrastructure/fflateCompressor';
import { SvgPngExporter } from '../../infrastructure/svgPngExporter';
import { Button } from '../atoms/Button';
import { cn } from '../cn';
import { renderBoardSvg } from '../export/renderBoardSvg';
import { LINK_FAILURE } from '../linkMessages';
import { ConfirmDialog, ErrorList, ShareLinkDialog } from '../organisms/dialogs';
import { GoalsList } from '../organisms/GoalsList';
import { RulesSummary } from '../organisms/RulesSummary';
import { SetupChecklist } from '../organisms/SetupChecklist';
import { SheetBoard } from '../organisms/SheetBoard';
import { SheetHeader } from '../organisms/SheetHeader';
import { appAddress, editHash, navigate, viewHash } from '../router';
import { SheetLayout } from '../templates/SheetLayout';

/** Composition root of the read-only sheet. */
const buildServices = () => ({
  compressor: new FflateCompressor(),
  clipboard: new BrowserClipboard(),
  writer: new DownloadFileWriter(),
  exporter: new SvgPngExporter(renderBoardSvg),
});

/** `flow` sections may continue in the next print column (their groups still stay together). */
function Section({
  title,
  flow,
  children,
}: {
  title: string;
  flow?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'mb-4 bg-panel p-4 chamfer print:mb-2 print:bg-transparent print:p-0 print:[clip-path:none]',
        flow ? 'print:break-before-column' : 'print:break-inside-avoid',
      )}
    >
      <h2 className="mb-2 text-head font-semibold font-stretch-condensed print:mb-1 print:break-after-avoid">
        {title}
      </h2>
      {children}
    </section>
  );
}

type Dialog =
  | { kind: 'none' }
  | { kind: 'link'; link: string; copied: boolean }
  | { kind: 'error'; message: string };

export function SheetPage({ link }: { link: string }) {
  const [services] = useState(buildServices);
  const result = useMemo(() => openScenarioLink(link, services.compressor), [link, services]);
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });
  const close = () => setDialog({ kind: 'none' });

  useEffect(() => {
    const prev = document.title;
    document.title = result.ok ? `${result.scenario.meta.name} – Minovsky Maps` : 'Minovsky Maps';
    return () => {
      document.title = prev;
    };
  }, [result]);

  if (!result.ok) {
    const msg = LINK_FAILURE[result.reason];
    return (
      <SheetLayout>
        <section
          role="alert"
          className="mx-auto mt-10 max-w-xl bg-panel p-6 chamfer"
          data-testid="link-error"
        >
          <h1 className="mb-2 text-title font-bold font-stretch-condensed">{msg.title}</h1>
          <ErrorList intro={msg.body} errors={result.reason === 'invalid' ? result.errors : []} />
          <div className="mt-5">
            <Button variant="primary" icon="new" onClick={() => navigate('#/')}>
              Open the editor
            </Button>
          </div>
        </section>
      </SheetLayout>
    );
  }

  const s = result.scenario;
  const copyLink = async () => {
    const full = `${appAddress()}${viewHash(link)}`;
    setDialog({ kind: 'link', link: full, copied: await services.clipboard.writeText(full) });
  };
  const exportImage = async () => {
    const r = await exportScenarioPng(s, services.exporter, services.writer);
    if (r.ok === false) setDialog({ kind: 'error', message: r.errors.join(' ') });
  };

  return (
    <SheetLayout
      actions={
        <>
          <Button variant="frame" icon="edit" onClick={() => navigate(editHash(link))}>
            Edit a copy
          </Button>
          <Button variant="frame" icon="link" onClick={() => void copyLink()}>
            Copy link
          </Button>
          <Button
            variant="frame"
            icon="download"
            onClick={() => void downloadScenarioFile(s, services.writer)}
          >
            Download .json
          </Button>
          <Button variant="frame" icon="image" onClick={() => void exportImage()}>
            Export PNG
          </Button>
          <Button variant="frame" icon="print" onClick={() => window.print()}>
            Print
          </Button>
        </>
      }
      intro={<SheetHeader scenario={s} />}
      board={<SheetBoard scenario={s} />}
      details={
        <>
          <Section title="Rules">
            <RulesSummary rules={s.rules} />
          </Section>
          <Section title="Goals">
            <GoalsList goals={s.goals} />
          </Section>
          <Section title="Setup checklist" flow>
            <SetupChecklist scenario={s} />
          </Section>
        </>
      }
      overlay={
        <>
          {dialog.kind === 'link' ? (
            <ShareLinkDialog
              link={dialog.link}
              copied={dialog.copied}
              long={false}
              onClose={close}
            />
          ) : null}
          {dialog.kind === 'error' ? (
            <ConfirmDialog
              title="Export failed"
              cancelLabel={null}
              onCancel={close}
              onConfirm={close}
            >
              {dialog.message}
            </ConfirmDialog>
          ) : null}
        </>
      }
    />
  );
}
