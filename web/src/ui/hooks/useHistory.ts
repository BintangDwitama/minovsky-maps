import { useCallback } from 'react';
import { useAnnouncer } from './useAnnouncer';
import { useServices } from './editorContext';

/** Undo and redo that also tell screen readers what was undone ("Undid Paint terrain"). */
export function useHistory() {
  const { session } = useServices();
  const announce = useAnnouncer();
  const undo = useCallback(() => {
    const label = session.getSnapshot().undoLabel;
    if (!session.getSnapshot().canUndo) return;
    session.undo();
    announce(label ? `Undid ${label}` : 'Undone');
  }, [session, announce]);
  const redo = useCallback(() => {
    const label = session.getSnapshot().redoLabel;
    if (!session.getSnapshot().canRedo) return;
    session.redo();
    announce(label ? `Redid ${label}` : 'Redone');
  }, [session, announce]);
  return { undo, redo };
}
