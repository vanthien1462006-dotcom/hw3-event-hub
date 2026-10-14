import { startCountdown } from './countdown.js';

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
