import type { ReactNode } from 'react';

/** A tickable setup line. Native checkbox: works with the keyboard and prints as a box. */
export function ChecklistItem({ children, detail }: { children: ReactNode; detail?: ReactNode }) {
  return (
    <li>
      <label className="flex cursor-pointer items-start gap-2.5 py-1 has-checked:text-muted has-checked:line-through print:py-0.5">
        <input type="checkbox" className="mt-0.5 size-4 flex-none accent-(--accent)" />
        <span>
          {children}
          {detail ? (
            <span className="block text-xs text-muted print:ml-2 print:inline">{detail}</span>
          ) : null}
        </span>
      </label>
    </li>
  );
}
