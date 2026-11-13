import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** Theme names added in styles/app.css, so tailwind-merge groups them correctly. */
const twMerge = extendTailwindMerge({
  override: {
    // In Tailwind v4 `leading-*` sets --tw-leading, which beats a text size's default line
    // height regardless of order, so a later `text-xs` must not drop an earlier `leading-*`.
    conflictingClassGroups: { 'font-size': [] },
  },
  extend: {
    theme: {
      color: [
        'bg',
        'panel',
        'panel-2',
        'border',
        'text',
        'muted',
        'accent',
        'plate-hover',
        'field',
        'vent-soft',
        'danger',
        'warning-bg',
        'warning-text',
        'board',
        'plate-hi',
        'frame',
        'frame-2',
        'frame-ink',
        'frame-muted',
        'accent-ink',
        'vent',
        'deck-stencil',
      ],
      text: ['micro', 'tiny', 'ui', 'head', 'title', 'stat'],
      radius: ['ui'],
    },
  },
});

/** Compose class names; later classes win over earlier conflicting ones (parent overrides atom). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
