import type { OpenLinkFailure } from '../application/shareLink';

/** What to tell the user when a share link can't be opened. */
export const LINK_FAILURE: Record<OpenLinkFailure, { title: string; body: string }> = {
  newer: {
    title: 'This link needs a newer version',
    body: 'It was made by a newer version of Minovsky Maps. Reload the page to get the latest version, then try again.',
  },
  damaged: {
    title: 'This link is damaged or incomplete',
    body: 'Part of it may have been cut off when it was copied or pasted. Ask for the link again, or for the .json file.',
  },
  invalid: {
    title: "This link doesn't contain a valid scenario",
    body: 'The scenario in this link has problems:',
  },
};
