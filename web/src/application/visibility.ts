/** Visibility words, shared by the save dialog, My scenarios and the sheet banner. */
import type { Visibility } from './ports';

/** New online saves start private: nothing is visible until the creator decides. */
export const DEFAULT_VISIBILITY: Visibility = 'private';

export const VISIBILITIES: readonly Visibility[] = ['private', 'link', 'public'];

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  private: 'Only me',
  link: 'Anyone with the link',
  public: 'Everyone',
};

export const VISIBILITY_HINT: Record<Visibility, string> = {
  private: 'Saved to your account. Only you can open it.',
  link: 'People you send the link to can open it. Not listed in Browse.',
  public: 'Listed in Browse for every player to find.',
};

export const isVisibility = (v: unknown): v is Visibility =>
  v === 'private' || v === 'link' || v === 'public';
