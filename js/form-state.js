export const STATES = Object.freeze({
  IDLE: 'idle',
  SUBMITTING: 'submitting',
  SUCCESS: 'success',
  ERROR: 'error',
});

const TRANSITIONS = Object.freeze({
  [STATES.IDLE]: Object.freeze({ SUBMIT: STATES.SUBMITTING }),
  [STATES.SUBMITTING]: Object.freeze({
    RESOLVE: STATES.SUCCESS,
    REJECT: STATES.ERROR,
  }),
  [STATES.ERROR]: Object.freeze({ RETRY: STATES.IDLE }),
  [STATES.SUCCESS]: Object.freeze({ RESET: STATES.IDLE }),
});

export function createFormMachine({ onChange }) {
  let state = STATES.IDLE;

  function send(event) {
    const next = Object.hasOwn(TRANSITIONS[state], event)
      ? TRANSITIONS[state][event]
      : undefined;

    if (next === undefined) {
      return false;
    }

    const previous = state;
    state = next;
    onChange(next, previous);
    return true;
  }

  function getState() {
    return state;
  }

  return { send, getState };
}
