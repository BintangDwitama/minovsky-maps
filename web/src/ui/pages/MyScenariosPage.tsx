import { useEffect, useState, type ReactNode } from 'react';
import { changeVisibility, deletePublished, shortLink } from '../../application/publishing';
import { discardDraft, editedAgo, findDraft } from '../../application/useCases';
import { EditorSession } from '../../application/editorSession';
import { createScenario } from '../../domain/scenario';
import { BrowserClipboard } from '../../infrastructure/browserClipboard';
import { HttpScenarioPublisher } from '../../infrastructure/httpScenarioPublisher';
import { LocalStorageDraftStore } from '../../infrastructure/localStorageDraftStore';
import { LocalStoragePublicationStore } from '../../infrastructure/localStoragePublicationStore';
import { TurnstileHumanCheck } from '../../infrastructure/turnstileHumanCheck';
import { Button } from '../atoms/Button';
import { Hint } from '../atoms/Text';
import { useAccount } from '../hooks/useAccount';
import { DraftCard } from '../organisms/DraftCard';
import { MyScenariosList } from '../organisms/MyScenariosList';
import {
  appAddress,
  editPublishedHash,
  goToPath,
  navigate,
  openEditor,
  resumeDraft,
} from '../router';
import { SiteLayout } from '../templates/SiteLayout';

const buildServices = () => ({
  publisher: new HttpScenarioPublisher({
    humanCheck: new TurnstileHumanCheck(import.meta.env.VITE_TURNSTILE_SITE_KEY),
  }),
  publications: new LocalStoragePublicationStore(),
  drafts: new LocalStorageDraftStore(),
  clipboard: new BrowserClipboard(),
  // deletePublished unlinks an open editor session; here there is none, so a throwaway one
  session: new EditorSession(createScenario()),
});

function Section({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-6 bg-panel p-4 chamfer" data-testid={testId}>
      <h2 className="mb-3 text-title font-semibold font-stretch-condensed">{title}</h2>
      {children}
    </section>
  );
}

/** `/my`: this browser's draft, the account's saved scenarios, and pre-account ones. */
export function MyScenariosPage() {
  const [services] = useState(buildServices);
  const account = useAccount();
  const [draft, setDraft] = useState(() => findDraft(services.drafts));
  const [legacy, setLegacy] = useState(() => services.publications.list());

  useEffect(() => {
    document.title = 'My scenarios – Minovsky Maps';
  }, []);
  // signing in claims legacy scenarios; show the list as it is now
  useEffect(() => setLegacy(services.publications.list()), [account.account, services]);

  const linkFor = (id: string) => shortLink(appAddress(), id);
  const common = {
    shortLinkFor: linkFor,
    onOpen: (id: string) => goToPath(`/s/${id}`),
    onEdit: (id: string) => navigate(editPublishedHash(id)),
    onCopy: (id: string) => services.clipboard.writeText(linkFor(id)),
  };

  return (
    <SiteLayout current="my" mainClassName="max-w-[860px]">
      <h1 className="mb-4 text-[32px] leading-tight font-bold font-stretch-condensed">
        My scenarios
      </h1>

      <Section title="On this browser" testId="my-draft">
        {draft ? (
          <DraftCard
            name={draft.scenario.meta.name}
            edited={editedAgo(draft.savedAt, new Date())}
            onContinue={resumeDraft}
            onDiscard={() => {
              discardDraft(services.drafts);
              setDraft(null);
            }}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p data-testid="my-draft-empty">No unsaved draft in this browser.</p>
            <Button icon="new" onClick={openEditor}>
              Create a scenario
            </Button>
          </div>
        )}
      </Section>

      <Section title="Saved online" testId="my-online">
        {account.loading ? (
          <p role="status">Checking your sign-in…</p>
        ) : account.account ? (
          <MyScenariosList
            {...common}
            source={{
              kind: 'account',
              load: () => account.service.listOwned(),
              onDelete: (id) => deletePublished(services.session, services.publisher, id),
              onVisibility: (id, v) => changeVisibility(services.publisher, id, v),
            }}
          />
        ) : account.available ? (
          <div className="flex flex-wrap items-center gap-3" data-testid="my-sign-in">
            <p>Sign in to see the scenarios you saved online, on any device.</p>
            <Button variant="primary" icon="user" onClick={() => account.signIn()}>
              Sign in with Google
            </Button>
          </div>
        ) : (
          <p>Saving online isn’t available on this server.</p>
        )}
      </Section>

      {legacy.length > 0 ? (
        <Section title="Saved before accounts" testId="my-legacy">
          <Hint as="p" className="mt-0">
            Stored in this browser only.
            {account.account ? '' : ' Signing in adds them to your account.'}
          </Hint>
          <MyScenariosList
            {...common}
            source={{
              kind: 'browser',
              scenarios: legacy,
              onForget: (id) => {
                services.publications.remove(id);
                setLegacy(services.publications.list());
              },
            }}
          />
        </Section>
      ) : null}
    </SiteLayout>
  );
}
