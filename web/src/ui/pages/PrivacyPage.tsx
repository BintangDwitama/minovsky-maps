import { useEffect, type ReactNode } from 'react';
import { Button } from '../atoms/Button';
import { navigate } from '../router';
import { SheetLayout } from '../templates/SheetLayout';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-1.5 text-title font-semibold font-stretch-condensed">{title}</h2>
      <div className="grid gap-2 leading-relaxed">{children}</div>
    </section>
  );
}

/** `#/privacy`: what Minovsky Maps stores about people, in plain words. */
export function PrivacyPage() {
  useEffect(() => {
    document.title = 'Privacy · Minovsky Maps';
  }, []);
  return (
    <SheetLayout
      actions={
        <Button variant="frame" icon="new" onClick={() => navigate('#/')}>
          Open the editor
        </Button>
      }
    >
      <article className="mx-auto max-w-[68ch]" data-testid="privacy">
        <h1 className="mb-4 text-[28px] leading-tight font-bold font-stretch-condensed">
          What we store
        </h1>
        <Section title="Without an account">
          <p>
            The editor runs in your browser. Scenarios you make, save or share as a link stay on
            your device or inside the link itself; we don&rsquo;t receive them.
          </p>
        </Section>
        <Section title="When you sign in with Google">
          <p>
            Signing in is only needed to publish. Google tells us an account id, your email address
            and your name. We store:
          </p>
          <ul className="list-disc pl-5">
            <li>the Google account id, to recognise you next time;</li>
            <li>
              your email address, which is{' '}
              <strong>never shown, shared or used to contact you</strong>;
            </li>
            <li>a display name (your Google name at first; you can change it);</li>
            <li>sign-in sessions, which end when you sign out or after 30 days.</li>
          </ul>
          <p>A session cookie keeps you signed in. We use no tracking or advertising cookies.</p>
        </Section>
        <Section title="Published scenarios">
          <p>
            Published scenarios are public to anyone with their link, together with your display
            name as the author. Earlier versions are kept so a scenario can be checked if it is
            reported.
          </p>
        </Section>
        <Section title="Reports">
          <p>
            Reports about a scenario store the reason and the details you write, with no personal
            data about you.
          </p>
        </Section>
        <Section title="Deleting">
          <p>
            You can delete a published scenario from &ldquo;My scenarios&rdquo;, and your whole
            account from the account menu. Deleting your account removes your email, name and
            sessions and takes all your scenarios offline.
          </p>
        </Section>
        <p className="mt-6 text-ui text-muted">
          Minovsky Maps is an unofficial fan tool, not affiliated with the makers of Gundam
          Assemble.
        </p>
      </article>
    </SheetLayout>
  );
}
