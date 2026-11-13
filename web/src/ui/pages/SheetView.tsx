import { useEffect, useState, type ReactNode } from 'react';
import type { Clipboard, FileWriter, ImageExporter } from '../../application/ports';
import { downloadScenarioFile, exportScenarioPng } from '../../application/useCases';
import type { Scenario } from '../../domain/scenario';
import { Button } from '../atoms/Button';
import { cn } from '../cn';
import { ConfirmDialog, ShareLinkDialog } from '../organisms/dialogs';
import { GoalsList } from '../organisms/GoalsList';
import { RulesSummary } from '../organisms/RulesSummary';
import { BoardInWords } from '../organisms/BoardInWords';
import { SetupChecklist } from '../organisms/SetupChecklist';
import { SheetBoard } from '../organisms/SheetBoard';
import { SheetHeader } from '../organisms/SheetHeader';
import { SheetLayout } from '../templates/SheetLayout';

export interface SheetServices {
  readonly clipboard: Clipboard;
  readonly writer: FileWriter;
  readonly exporter: ImageExporter;
}

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

export const useDocumentTitle = (title: string) => {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => {
      document.title = prev;
    };
  }, [title]);
};

export interface SheetViewProps {
  scenario: Scenario;
  /** The address Copy link copies (share link or short link). */
  link: string;
  /** Where the scenario lives, for the copy dialog's wording. */
  storedIn: 'link' | 'server';
  /** Edit / Edit a copy buttons, shown first. */
  editActions: ReactNode;
  /** Extra actions after Print (e.g. Report on published scenarios). */
  trailingActions?: ReactNode;
  /** Extra dialogs owned by the page. */
  extraOverlay?: ReactNode;
  services: SheetServices;
}

type Dialog =
  { kind: 'none' } | { kind: 'link'; copied: boolean } | { kind: 'error'; message: string };

/** The read-only scenario sheet with its actions (shared by share links and published scenarios). */
export function SheetView({
  scenario: s,
  link,
  storedIn,
  editActions,
  trailingActions,
  extraOverlay,
  services,
}: SheetViewProps) {
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });
  const close = () => setDialog({ kind: 'none' });
  useDocumentTitle(`${s.meta.name} – Minovsky Maps`);

  const copyLink = async () =>
    setDialog({ kind: 'link', copied: await services.clipboard.writeText(link) });
  const exportImage = async () => {
    const r = await exportScenarioPng(s, services.exporter, services.writer);
    if (r.ok === false) setDialog({ kind: 'error', message: r.errors.join(' ') });
  };

  return (
    <SheetLayout
      actions={
        <>
          {editActions}
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
          {trailingActions}
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
          <BoardInWords scenario={s} className="mb-4 bg-panel p-4 chamfer [&>summary]:text-head" />
        </>
      }
      overlay={
        <>
          {dialog.kind === 'link' ? (
            <ShareLinkDialog
              link={link}
              copied={dialog.copied}
              long={false}
              storedIn={storedIn}
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
          {extraOverlay}
        </>
      }
    />
  );
}

/** A centred message panel on the sheet page (errors, loading, waking). */
export function SheetMessage({
  title,
  children,
  actions,
  busy,
  testId,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  busy?: boolean;
  testId?: string;
}) {
  return (
    <SheetLayout>
      <section
        role={busy ? 'status' : 'alert'}
        aria-busy={busy || undefined}
        className="mx-auto mt-10 max-w-xl bg-panel p-6 chamfer"
        data-testid={testId}
      >
        <h1 className="mb-2 text-title font-bold font-stretch-condensed">{title}</h1>
        {children}
        {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
      </section>
    </SheetLayout>
  );
}
