const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;

const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const ISO_SECONDS_LENGTH = 19;

function parseUtcIso(value) {
  if (typeof value !== 'string' || !ISO_UTC_PATTERN.test(value)) {
    return NaN;
  }

  const ms = Date.parse(value);
  const roundTrip = Number.isNaN(ms) ? '' : new Date(ms).toISOString();
  return roundTrip.slice(0, ISO_SECONDS_LENGTH) === value.slice(0, ISO_SECONDS_LENGTH) ? ms : NaN;
}

export function getRemaining(targetMs, nowMs) {
  const diff = targetMs - nowMs;
  const totalMs = Number.isFinite(diff) ? Math.max(0, diff) : 0;
  const totalSeconds = Math.ceil(totalMs / MS_PER_SECOND);

  return {
    totalMs,
    days: Math.floor(totalSeconds / SECONDS_PER_DAY),
    hours: Math.floor((totalSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR),
    minutes: Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE),
    seconds: totalSeconds % SECONDS_PER_MINUTE,
  };
}

export function startCountdown({ targetIso, onTick, onDone }) {
  const targetMs = parseUtcIso(targetIso);
  if (Number.isNaN(targetMs)) {
    throw new Error(`Invalid countdown target: "${targetIso}" must be an existing UTC date in ISO 8601 form ending with "Z", e.g. 2027-01-15T02:00:00Z.`);
  }

  let timerId = null;

  function tick() {
    const remaining = getRemaining(targetMs, Date.now());
    onTick(remaining);

    if (remaining.totalMs === 0) {
      stop();
      onDone();
      return;
    }

    timerId = setTimeout(tick, MS_PER_SECOND - (Date.now() % MS_PER_SECOND));
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      clearTimeout(timerId);
      tick();
    }
  }

  function handlePageHide(event) {
    if (event.persisted) {
      clearTimeout(timerId);
      return;
    }
    stop();
  }

  function handlePageShow(event) {
    if (event.persisted) {
      clearTimeout(timerId);
      tick();
    }
  }

  function stop() {
    clearTimeout(timerId);
    timerId = null;
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('pageshow', handlePageShow);
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('pageshow', handlePageShow);
  tick();

  return stop;
}
