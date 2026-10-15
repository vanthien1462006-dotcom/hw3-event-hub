# AI Failure Audit

This report lists the defects found in AI-generated code while building the Event Hub landing page. Every entry below is backed by a commit in this repository's git history. Nothing was added to reach a target count.

## How the project was built

The work followed the decomposition in `TASK_DECOMPOSITION.md`:

1. **Specification first.** The contracts for the countdown, the form state machine, sanitization and the mock API were written before any JavaScript.
2. **Small slices.** The JavaScript was split into three slices: countdown (Slice 1), state-machine form (Slice 2), and double-submit guard with sanitization (Slice 3).
3. **One slice, one commit.** Each slice was committed on its own with the message given in the plan.
4. **A bug-hunting pass after every slice.** Before moving on, the slice's commit was reviewed with a separate adversarial prompt that asked for rule violations and unhandled edge cases without rewriting the code. Each finding was then reproduced by hand and fixed in its own `fix(js)` commit.

| Slice | Original commit | Fix commits |
|-------|-----------------|-------------|
| Slice 1: countdown | `46a664c` | `a80a1c7`, `8a564c7` |
| Slice 2: state-machine form | `b28912f` | `6fff7fa`, `65a1238` |
| Slice 3: double-submit guard and sanitization | `69e0975` | `3426c18` |

## Main defects

### 1. Date strings without a time zone were accepted (Slice 1)

#### Defect Description

- **Type:** timezone parsing / input validation.
- **Origin:** `46a664c`, `js/countdown.js`, `startCountdown` (lines 21-24).
- **What went wrong:** the target date was parsed with `Date.parse(targetIso)` and the only check was `Number.isNaN`. A string without a UTC designator, such as `2027-01-15T02:00:00`, is read as local time, so the countdown target moved with the visitor's time zone. On the author's machine (Asia/Saigon, UTC+7) it differed from the `Z` version by 7 hours. Impossible calendar values such as `2027-02-31T00:00:00Z` and `2027-01-15T24:00:00Z` were also accepted, because `Date.parse` normalizes them instead of rejecting them. The contract in `TASK_DECOMPOSITION.md` requires an ISO 8601 UTC string.

#### Diagnostic Method

- **How it was found:** the adversarial review prompt run on commit `46a664c` flagged the parsing.
- **How it was confirmed (DevTools Console):**
  1. Serve the page at `http://localhost:5500` and open the Console.
  2. Load the module, for example with `await import('/js/countdown.js')`.
  3. Loop over four strings: `2027-01-15T02:00:00Z`, `2027-01-15T02:00:00`, `2027-02-31T00:00:00Z` and `2027-01-15T24:00:00Z`.
  4. Call `startCountdown` for each one and compare the hours remaining reported by `onTick`.
  5. Result: the string without `Z` differed from the `Z` string by 7 hours, and the two impossible dates did not throw.

#### Refactored Solution

Fix commit: `8a564c7`.

Before (`46a664c`):

```js
const targetMs = Date.parse(targetIso);
if (Number.isNaN(targetMs)) {
  throw new Error(`Invalid countdown target: "${targetIso}" is not a valid ISO 8601 date.`);
}
```

After:

```js
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

const targetMs = parseUtcIso(targetIso);
```

Why this is correct: the pattern forces the trailing `Z`, so local-time interpretation can no longer happen. The round trip through `new Date(ms).toISOString()` compares the date and time down to the second with the original text. A date that `Date.parse` silently moved (31 February becomes 3 March, hour 24 becomes the next day) no longer matches and is rejected. The error message now names the expected format.

### 2. The countdown froze after a bfcache restore (Slice 1)

#### Defect Description

- **Type:** timer and listener lifecycle.
- **Origin:** `46a664c`, `js/countdown.js`, lines 52 and 56.
- **What went wrong:** `stop` was registered directly as the `pagehide` listener. `stop` clears the timeout and also removes the `visibilitychange` listener. When a page enters the back/forward cache and is later restored, the module does not run again, so nothing calls `tick()`. The seconds stay frozen, and the `visibilitychange` listener that could have resynced the display is already gone.

#### Diagnostic Method

- **How it was found:** the adversarial review of commit `46a664c`.
- **How it was reproduced (DevTools Console, simulated):**
  1. Open the page at `http://localhost:5500` and watch the seconds count down.
  2. Run `window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))` in the Console.
  3. Result: the seconds stop updating.
- **Limitation:** this is a **simulation**. A real bfcache round trip (navigate away, then use the Back button) was not tested. The simulation shows what the old `pagehide` handler does when `persisted` is true; it does not prove the browser would restore the page in that state.

#### Refactored Solution

Fix commit: `a80a1c7`.

Before (`46a664c`):

```js
window.addEventListener('pagehide', stop);
```

After:

```js
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

window.addEventListener('pagehide', handlePageHide);
window.addEventListener('pageshow', handlePageShow);
```

`stop()` now also removes both new listeners.

Why this is correct: when the page may be restored (`persisted` is true), the handler only pauses the timer and keeps the listeners. A `pageshow` event with `persisted` then recomputes the remaining time from `Date.now()` and reschedules. When the page is really being discarded, `stop()` still runs and cleans up every timer and listener.

### 3. Strings made only of invisible characters passed sanitization (Slice 3)

#### Defect Description

- **Type:** input sanitization / Unicode handling.
- **Origin:** `69e0975`, `js/sanitize.js`, `stripControlCharacters` (line 10); consumed in `js/main.js` by `sanitizeFields` (line 107) and the success message (line 125).
- **What went wrong:** the function removed only `\p{Cc}` control characters. Format characters such as U+200B (zero-width space) and U+202E (right-to-left override) are not in `\p{Cc}`, so they went through unchanged. A name of `"​​"` survived sanitization, satisfied the `required` check, and the thank-you line displayed a visually empty name. The bidi override characters could also reorder surrounding text.

#### Diagnostic Method

- **How it was found:** the security-focused review prompt run on commit `69e0975`.
- **How it was confirmed (DevTools Console):**
  1. Import `sanitizeText` from `/js/sanitize.js`.
  2. Call it with strings containing U+200B and U+202E, including a string made only of zero-width spaces.
  3. Result: the invisible characters came back unchanged and the all-invisible string was not reduced to an empty string.

#### Refactored Solution

Fix commit: `3426c18`.

Before (`69e0975`):

```js
function stripControlCharacters(text) {
  return text.replace(/\p{Cc}/gu, (char) => (/\s/u.test(char) ? ' ' : ''));
}
```

After:

```js
const INVISIBLE_AND_BIDI = /[​‎‏‪-‮⁠⁦-⁩﻿]/gu;
const VISIBLE_CHARACTER = /[\p{L}\p{N}\p{P}\p{S}]/u;

function stripControlCharacters(text) {
  return text
    .replace(INVISIBLE_AND_BIDI, '')
    .replace(/\p{Cc}/gu, (char) => (/\s/u.test(char) ? ' ' : ''));
}

// sanitizeText now ends with:
return VISIBLE_CHARACTER.test(limited) ? limited : '';
```

The character class lists these code points: U+200B, U+200E, U+200F, U+202A-U+202E, U+2060, U+2066-U+2069 and U+FEFF.

Why this is correct: the invisible and bidi characters are removed before whitespace is collapsed. The final `VISIBLE_CHARACTER` test returns an empty string when no letter, number, punctuation or symbol remains, so an invisible-only name now fails the `required` check instead of being accepted. The invisible-character set is an explicit list, not every Unicode format character, so a character outside the list would still pass.

## Additional defects

### 4. Focus was lost after pressing "Try again" (Slice 2)

#### Defect Description

- **Type:** focus management / accessibility.
- **Origin:** `b28912f`, `js/main.js`, `renderState` (lines 47-56).
- **What went wrong:** `#retry-btn` is hidden (`retryBtn.hidden = newState !== STATES.ERROR`) when the machine goes from `error` to `idle`. The button still had focus at that moment, so focus dropped to `body` and keyboard users lost their place.

#### Diagnostic Method

- **How it was found:** the adversarial review of commit `b28912f`.
- **How it was reproduced (DevTools Console):**
  1. Submit the form with an email ending in `@fail.test` so the request is rejected.
  2. Press **Try again**.
  3. Type `document.activeElement` in the Console.
  4. Result: it returned `body` instead of a form control.

#### Refactored Solution

Fix commit: `6fff7fa`.

Before (`b28912f`):

```js
function renderState(newState) {
  form.dataset.state = newState;
  submitBtn.disabled = newState === STATES.SUBMITTING;
  retryBtn.hidden = newState !== STATES.ERROR;
```

After:

```js
function renderState(newState, previousState) {
  form.dataset.state = newState;
  submitBtn.disabled = newState === STATES.SUBMITTING;

  if (previousState === STATES.ERROR && newState === STATES.IDLE) {
    fields[0].focus();
  }

  retryBtn.hidden = newState !== STATES.ERROR;
```

Why this is correct: `onChange` already receives the previous state, so the handler moves focus to the first form field on the `error` to `idle` transition, before the retry button is hidden.

### 5. Old validation errors stayed visible while the user edited (Slice 2)

#### Defect Description

- **Type:** stale UI state.
- **Origin:** `b28912f`, `js/main.js`, the `input` listener (lines 113-115).
- **What went wrong:** the listener only sent `RESET` to the state machine. The text in the field's error element and its `aria-invalid` attribute were left in place, so a message such as a missing-value error stayed on screen and was still announced after the user had corrected the field.

#### Diagnostic Method

- **How it was found:** the adversarial review of commit `b28912f`, by reading the `input` listener.
- **Confirmation:** Git diff inspection of the listener in `b28912f` shows that no code path clears the per-field error on input. The diff of the fix shows the missing call being added. No separate Console reproduction was recorded for this defect.

#### Refactored Solution

Fix commit: `65a1238`.

Before (`b28912f`):

```js
form.addEventListener('input', () => {
  machine.send('RESET');
});
```

After:

```js
function clearFieldError(field) {
  document.querySelector(`#${field.id}-error`).textContent = '';
  field.removeAttribute('aria-invalid');
}

function clearFieldErrors() {
  fields.forEach(clearFieldError);
}

form.addEventListener('input', (event) => {
  clearFieldError(event.target);
  machine.send('RESET');
});
```

Why this is correct: the per-field cleanup was extracted from `clearFieldErrors` into `clearFieldError`, so the same code serves both the whole-form reset and a single edited field. Only the field being edited is cleared, and errors on other fields stay until they are fixed.

## Conclusion

The AI wrote each slice quickly and the code matched the main contract. The defects were at the edges: time zones in date parsing, page lifecycle events such as `pagehide` and bfcache restores, and Unicode characters that look like nothing but are not control characters. Small details in the form code (focus, stale error text) were also missed.

Two things made these defects visible. Small slices meant each diff was short enough to review. A separate review prompt after each slice found problems that the generating prompt had not. A review finding is still only a claim until someone reproduces it, so each defect above was checked by hand, in the Console or in the diff. Defect 2 was only simulated, and the report says so.
