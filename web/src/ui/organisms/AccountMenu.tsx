import { useState, type ReactNode } from 'react';
import { Button } from '../atoms/Button';
import { TextInput } from '../atoms/inputs';
import { Hint } from '../atoms/Text';
import { useAccount } from '../hooks/useAccount';
import { FieldRow } from '../molecules/controls';
import type { MenuItem } from '../molecules/Menu';
import { navigate, PRIVACY_ROUTE } from '../router';
import { ConfirmDialog, DialogShell, ErrorList } from './dialogs';

export interface AccountMenuModel {
  /** Nothing to show yet (still loading, or sign-in not configured). */
  readonly hidden: boolean;
  readonly signedIn: boolean;
  /** Menu label: the display name. */
  readonly label: string;
  /** Account actions for a menu (signed in only). */
  readonly items: readonly MenuItem[];
  signIn(): void;
  /** Rename / delete-account dialogs; render once. */
  readonly dialogs: ReactNode;
}

type Dialog = { kind: 'none' } | { kind: 'rename' } | { kind: 'delete' };

/** The account menu's entries and dialogs, for the toolbar (desktop menu or the phone Menu). */
export function useAccountMenu(): AccountMenuModel {
  const acc = useAccount();
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });
  const close = () => setDialog({ kind: 'none' });

  const items: MenuItem[] = acc.account
    ? [
        {
          label: 'Change display name',
          icon: 'edit',
          onSelect: () => setDialog({ kind: 'rename' }),
        },
        { label: 'What we store', icon: 'info', onSelect: () => navigate(`#${PRIVACY_ROUTE}`) },
        { label: 'Sign out', icon: 'signOut', onSelect: () => void acc.signOut() },
        { label: 'Delete account…', icon: 'trash', onSelect: () => setDialog({ kind: 'delete' }) },
      ]
    : [];

  return {
    hidden: acc.loading || !acc.available,
    signedIn: !!acc.account,
    label: acc.account?.displayName ?? '',
    items,
    signIn: () => acc.signIn(),
    dialogs:
      dialog.kind === 'rename' && acc.account ? (
        <RenameDialog current={acc.account.displayName} onClose={close} />
      ) : dialog.kind === 'delete' ? (
        <DeleteAccountDialog onClose={close} />
      ) : null,
  };
}

function RenameDialog({ current, onClose }: { current: string; onClose(): void }) {
  const { rename } = useAccount();
  const [name, setName] = useState(current);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();
  const valid = trimmed.length >= 1 && [...trimmed].length <= 40;
  const save = async () => {
    setBusy(true);
    const r = await rename(trimmed);
    setBusy(false);
    if (r.ok) onClose();
    else setErrors(r.errors);
  };
  return (
    <DialogShell
      title="Display name"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid || busy} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !busy) void save();
        }}
      >
        <FieldRow label="Shown as the author of your published scenarios" htmlFor="display-name">
          <TextInput
            id="display-name"
            maxLength={40}
            value={name}
            invalid={!valid}
            onChange={(e) => setName(e.target.value)}
          />
        </FieldRow>
        <Hint as="p" className="mb-0">
          1 to 40 characters. Your email is never shown.
        </Hint>
        {errors.length ? <ErrorList intro="Could not save:" errors={errors} /> : null}
      </form>
    </DialogShell>
  );
}

function DeleteAccountDialog({ onClose }: { onClose(): void }) {
  const { deleteAccount } = useAccount();
  const [errors, setErrors] = useState<string[] | null>(null);
  return (
    <ConfirmDialog
      title="Delete your account?"
      danger
      confirmLabel="Delete account"
      cancelLabel="Keep it"
      onCancel={onClose}
      onConfirm={() => void deleteAccount().then((r) => (r.ok ? onClose() : setErrors(r.errors)))}
    >
      <p className="mb-2">
        This removes your email, display name and sign-in, and{' '}
        <strong>takes all your published scenarios offline</strong>: their links will show “Scenario
        not found”. It can’t be undone.
      </p>
      <Hint as="p" className="mb-0">
        Scenarios you saved as files or share links are not affected.
      </Hint>
      {errors ? <ErrorList intro="Could not delete the account:" errors={errors} /> : null}
    </ConfirmDialog>
  );
}
