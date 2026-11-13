import type { ApiFailure } from '../application/ports';

type Failure = ApiFailure | 'blocked' | 'no-token';

/** Titles and intros for failed publish / update / open, by failure kind. */
export const PUBLISH_FAILURE: Record<
  Failure,
  { title: string; intro: string; showErrors: boolean }
> = {
  blocked: { title: "Can't publish yet", intro: 'Fix these first:', showErrors: true },
  invalid: {
    title: 'The server rejected this scenario',
    intro: 'It reported these problems:',
    showErrors: true,
  },
  'not-found': {
    title: 'Scenario not found',
    intro: 'This published scenario does not exist or was taken down.',
    showErrors: false,
  },
  forbidden: {
    title: 'Edit link no longer valid',
    intro:
      'This browser’s edit link does not match the published scenario, so it cannot be updated.',
    showErrors: false,
  },
  'no-token': {
    title: 'Not editable from this browser',
    intro: 'Open the private edit link you saved when publishing, then try again.',
    showErrors: false,
  },
  bot: {
    title: 'Couldn’t confirm you’re a person',
    intro: 'The bot check didn’t succeed:',
    showErrors: true,
  },
  'rate-limited': {
    title: 'Too many changes at once',
    intro: 'Wait a minute, then try again.',
    showErrors: false,
  },
  unavailable: {
    title: 'Server unavailable',
    intro:
      'The publishing server could not be reached. Your work is safe in this browser; try again in a minute.',
    showErrors: false,
  },
};
