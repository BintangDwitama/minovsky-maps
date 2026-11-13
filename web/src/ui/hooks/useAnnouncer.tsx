import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { LiveRegion } from '../atoms/LiveRegion';

type Announce = (text: string) => void;

/** Zero-width space: appended to repeat a message so the live region still changes. */
const ZWSP = String.fromCharCode(0x200b);

const AnnouncerContext = createContext<Announce>(() => undefined);

/** Speaks short messages to screen readers through one live region. */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState('');
  // the same text twice must still be spoken, so a repeat gets a zero-width space appended
  const announce = useCallback<Announce>((t) => setText((prev) => (prev === t ? t + ZWSP : t)), []);
  return (
    <AnnouncerContext.Provider value={announce}>
      {children}
      <LiveRegion text={text} />
    </AnnouncerContext.Provider>
  );
}

/** `announce(text)`; does nothing outside an AnnouncerProvider. */
export const useAnnouncer = (): Announce => useContext(AnnouncerContext);
