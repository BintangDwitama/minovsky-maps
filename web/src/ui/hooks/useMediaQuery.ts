import { useCallback, useSyncExternalStore } from 'react';

/** Below this width the editor uses its compact (phone / portrait tablet) layout. */
export const COMPACT_MAX_WIDTH = 900;
export const COMPACT_QUERY = `(max-width: ${COMPACT_MAX_WIDTH - 0.02}px)`;

/** Live result of a CSS media query. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', notify);
      return () => mq.removeEventListener('change', notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
