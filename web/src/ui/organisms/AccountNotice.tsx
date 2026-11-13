import { useEffect } from 'react';
import { IconButton } from '../atoms/Button';
import { useAccount } from '../hooks/useAccount';

/** Short account messages ("Signed in as …", "3 scenarios added …"), shown on any page. */
export function AccountNotice() {
  const { notice, dismissNotice } = useAccount();
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(dismissNotice, 8000);
    return () => clearTimeout(t);
  }, [notice, dismissNotice]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-50 flex justify-center px-4 print:hidden">
      <div role="status" aria-live="polite" data-testid="account-notice">
        {notice ? (
          <div className="pointer-events-auto flex max-w-[min(520px,calc(100vw-32px))] items-center gap-2 bg-frame py-1.5 pr-1.5 pl-3.5 text-frame-ink shadow-lg chamfer-sm">
            <span>{notice}</span>
            <IconButton
              variant="frame"
              icon="close"
              label="Dismiss message"
              onClick={dismissNotice}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
