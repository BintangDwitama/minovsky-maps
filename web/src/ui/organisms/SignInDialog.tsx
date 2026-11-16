import { Button } from '../atoms/Button';
import { Hint } from '../atoms/Text';
import { PRIVACY_ROUTE } from '../router';
import { DialogShell } from './dialogs';

export interface SignInDialogProps {
  /** Why sign-in is needed, in one sentence. */
  reason: string;
  /** Sign-in is configured on this server. */
  available: boolean;
  onSignIn(): void;
  onClose(): void;
}

/** "Sign in with Google to publish": the only way to sign in. */
export function SignInDialog({ reason, available, onSignIn, onClose }: SignInDialogProps) {
  return (
    <DialogShell
      title={available ? 'Sign in to save online' : 'Saving online unavailable'}
      onClose={onClose}
      actions={
        available ? (
          <>
            <Button onClick={onClose}>Not now</Button>
            <Button variant="primary" icon="user" onClick={onSignIn}>
              Sign in with Google
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {available ? (
        <>
          <p>{reason}</p>
          <Hint as="p">
            You’ll come back here with your work as it is. Saving to a file and sharing links don’t
            need an account.
          </Hint>
          <Hint as="p" className="mb-0">
            Your email is never shown or shared.{' '}
            <a className="underline" href={`#${PRIVACY_ROUTE}`} target="_blank" rel="noopener">
              What we store
            </a>
          </Hint>
        </>
      ) : (
        <p>
          Sign-in isn’t set up on this server, so scenarios can’t be saved online here. You can
          still save them to a file or share them as a link.
        </p>
      )}
    </DialogShell>
  );
}
