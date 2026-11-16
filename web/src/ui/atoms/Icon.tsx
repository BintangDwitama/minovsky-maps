/** Minimal original stroke icons (24x24 grid). */
const PATHS = {
  new: 'M6 3h8l4 4v14H6z M14 3v4h4 M12 11v6 M9 14h6',
  open: 'M3 7h6l2 2h10v10H3z',
  save: 'M5 3h11l3 3v15H5z M8 3v5h7V3 M8 21v-7h8v7',
  image: 'M3 5h18v14H3z M3 16l5-5 4 4 3-3 6 6 M15.5 9.5a1.5 1.5 0 1 0 0.01 0',
  undo: 'M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5 M20 9H10a6 6 0 0 0 0 12h3',
  select: 'M5 3l13 8-6 1.5L9 19z',
  brush: 'M14 4l6 6-8 8H6v-6z M4 20l2-2',
  eraser: 'M4 15l9-9 7 7-7 7H8z M9 11l6 6',
  up: 'M12 19V5 M6 11l6-6 6 6',
  down: 'M12 5v14 M6 13l6 6 6-6',
  level: 'M4 18h16 M4 13h16 M4 8h16',
  rotateCw: 'M20 12a8 8 0 1 1-2.3-5.7 M20 4v5h-5',
  rotateCcw: 'M4 12a8 8 0 1 0 2.3-5.7 M4 4v5h5',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  plus: 'M12 5v14 M5 12h14',
  arrowUp: 'M12 19V5 M6 11l6-6 6 6',
  arrowDown: 'M12 5v14 M6 13l6 6 6-6',
  fit: 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5',
  zoomIn: 'M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13 M20 20l-4.5-4.5 M10.5 7.5v6 M7.5 10.5h6',
  zoomOut: 'M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13 M20 20l-4.5-4.5 M7.5 10.5h6',
  resize: 'M4 4h7 M4 4v7 M20 20h-7 M20 20v-7 M4 4l16 16',
  warning: 'M12 3l10 18H2z M12 10v5 M12 18v0.5',
  link: 'M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1 M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1',
  print: 'M7 9V3h10v6 M7 18H4v-8h16v8h-3 M7 14h10v7H7z',
  download: 'M12 4v11 M7 10l5 5 5-5 M5 20h14',
  edit: 'M4 20h4L19 9l-4-4L4 16z M13.5 6.5l4 4',
  upload: 'M12 16V5 M7 10l5-5 5 5 M5 20h14',
  flag: 'M5 21V4 M5 4h11l-2 4 2 4H5',
  list: 'M9 6h11 M9 12h11 M9 18h11 M4 6h0.01 M4 12h0.01 M4 18h0.01',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  lock: 'M6 11h12v10H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  globe:
    'M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18 M3 12h18 M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9 M12 3c-2.5 2.6-3.7 5.6-3.7 9s1.2 6.4 3.7 9',
  search: 'M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13 M20 20l-4.5-4.5',
  grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  user: 'M12 4a4 4 0 1 1 0 8a4 4 0 0 1 0-8 M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6',
  signOut: 'M14 4h5v16h-5 M10 8l-4 4 4 4 M6 12h10',
  verified: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z M9 12l2 2 4-4',
  info: 'M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18 M12 11v6 M12 7.5v0.5',
  close: 'M6 6l12 12 M18 6L6 18',
  enlarge: 'M14 4h6v6 M10 20H4v-6 M20 4l-7 7 M4 20l7-7',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0.01 0',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, title }: { name: IconName; title?: string }) {
  return (
    <svg
      className="size-4 flex-none"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}
