const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;

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
  const targetMs = Date.parse(targetIso);
  if (Number.isNaN(targetMs)) {
    throw new Error(`Invalid countdown target: "${targetIso}" is not a valid ISO 8601 date.`);
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

  function stop() {
    clearTimeout(timerId);
    timerId = null;
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pagehide', stop);
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', stop);
  tick();

  return stop;
}
