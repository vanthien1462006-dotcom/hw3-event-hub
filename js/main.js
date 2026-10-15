import { startCountdown } from './countdown.js';
import { STATES, createFormMachine } from './form-state.js';
import { mockSubmit } from './mock-api.js';
import { sanitizeText } from './sanitize.js';

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

const FIELD_LIMITS = Object.freeze({ name: 80, email: 254, message: 300 });

let registeredName = '';
let idempotencyKey = null;
let latestRequestId = 0;

function renderState(newState, previousState) {
  const isBusy = newState === STATES.SUBMITTING;

  form.dataset.state = newState;
  form.setAttribute('aria-busy', String(isBusy));
  submitBtn.disabled = isBusy;
  fields.forEach((field) => {
    field.disabled = isBusy;
  });

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

function sanitizeFields() {
  fields.forEach((field) => {
    const clean = sanitizeText(field.value, FIELD_LIMITS[field.name]);
    field.value = field.type === 'email' ? clean.toLowerCase() : clean;
  });
}

async function register(payload) {
  const requestId = ++latestRequestId;

  try {
    await mockSubmit(payload);

    if (requestId !== latestRequestId) {
      return;
    }

    idempotencyKey = null;
    registeredName = payload.name;
    machine.send('RESOLVE');
    form.reset();
    clearFieldErrors();
  } catch {
    if (requestId === latestRequestId) {
      machine.send('REJECT');
    }
  } finally {
    if (requestId === latestRequestId && machine.getState() === STATES.SUBMITTING) {
      machine.send('REJECT');
    }
  }
}

function handleSubmit(event) {
  event.preventDefault();

  if (machine.getState() !== STATES.IDLE) {
    return;
  }

  sanitizeFields();

  if (!validateFields()) {
    return;
  }

  idempotencyKey ??= crypto.randomUUID();
  const payload = { ...Object.fromEntries(new FormData(form)), idempotencyKey };

  if (!machine.send('SUBMIT')) {
    return;
  }

  register(payload);
}

form.addEventListener('submit', handleSubmit);
form.addEventListener('input', (event) => {
  clearFieldError(event.target);
  machine.send('RESET');
});
retryBtn.addEventListener('click', () => {
  machine.send('RETRY');
});
