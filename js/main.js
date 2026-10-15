import { startCountdown } from './countdown.js';
import { STATES, createFormMachine } from './form-state.js';
import { mockSubmit } from './mock-api.js';

const eventTime = document.querySelector('#event-time');
const doneMessage = document.querySelector('#countdown-done');
const unitNodes = document.querySelectorAll('#countdown-timer [data-unit]');

function pad(value) {
  return String(value).padStart(2, '0');
}

function renderRemaining(remaining) {
  unitNodes.forEach((node) => {
    node.textContent = pad(remaining[node.dataset.unit]);
  });
}

function showDone() {
  unitNodes.forEach((node) => {
    node.textContent = pad(0);
  });
  doneMessage.hidden = false;
}

startCountdown({
  targetIso: eventTime.getAttribute('datetime'),
  onTick: renderRemaining,
  onDone: showDone,
});

const form = document.querySelector('#register-form');
const submitBtn = document.querySelector('#submit-btn');
const retryBtn = document.querySelector('#retry-btn');
const statusNode = document.querySelector('p#form-status');
const fields = form.querySelectorAll('input, textarea');

const STATUS_MESSAGES = Object.freeze({
  [STATES.IDLE]: () => '',
  [STATES.SUBMITTING]: () => 'Submitting your registration...',
  [STATES.SUCCESS]: (name) => `Thanks, ${name}! You are registered.`,
  [STATES.ERROR]: () => 'Something went wrong. Please try again.',
});

let registeredName = '';

function renderState(newState, previousState) {
  form.dataset.state = newState;
  submitBtn.disabled = newState === STATES.SUBMITTING;

  if (previousState === STATES.ERROR && newState === STATES.IDLE) {
    fields[0].focus();
  }

  retryBtn.hidden = newState !== STATES.ERROR;
  statusNode.textContent = STATUS_MESSAGES[newState](registeredName);

  if (newState === STATES.ERROR) {
    retryBtn.focus();
  }
}

const machine = createFormMachine({ onChange: renderState });

function validateFields() {
  let firstInvalid = null;

  fields.forEach((field) => {
    const errorNode = document.querySelector(`#${field.id}-error`);
    const isValid = field.validity.valid;

    errorNode.textContent = isValid ? '' : field.validationMessage;
    field.setAttribute('aria-invalid', String(!isValid));

    if (!isValid && firstInvalid === null) {
      firstInvalid = field;
    }
  });

  if (firstInvalid !== null) {
    firstInvalid.focus();
  }

  return firstInvalid === null;
}

function clearFieldError(field) {
  document.querySelector(`#${field.id}-error`).textContent = '';
  field.removeAttribute('aria-invalid');
}

function clearFieldErrors() {
  fields.forEach(clearFieldError);
}

function handleSubmit(event) {
  event.preventDefault();

  if (machine.getState() !== STATES.IDLE || !validateFields()) {
    return;
  }

  const payload = Object.fromEntries(new FormData(form));
  registeredName = payload.name;
  machine.send('SUBMIT');

  mockSubmit(payload).then(
    () => {
      machine.send('RESOLVE');
      form.reset();
      clearFieldErrors();
    },
    () => {
      machine.send('REJECT');
    },
  );
}

form.addEventListener('submit', handleSubmit);
form.addEventListener('input', (event) => {
  clearFieldError(event.target);
  machine.send('RESET');
});
retryBtn.addEventListener('click', () => {
  machine.send('RETRY');
});
