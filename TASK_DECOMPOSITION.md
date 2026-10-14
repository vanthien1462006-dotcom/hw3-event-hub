# TASK_DECOMPOSITION: Resilient Event Hub & AI Failure Audit

## 1. Overview

A landing page for the demo event **"Future Web Summit 2027 (demo event)"**. The project is built with vanilla HTML5, modern CSS and ES6+ JavaScript (ES modules). There are no frameworks, packages, bundlers or CDNs (see `project-rules.md`).

- **Layout:** mobile-first, base styles written for 375px, enhanced with `min-width` media queries.
- **Visual style, "cyber blueprint":** dark navy background, a faint grid, glowing cyan and violet accents, and the system monospace font stack.
- **Features:**
  1. A drift-free countdown to the event start.
  2. A registration form driven by an explicit state machine (`idle`, `submitting`, `success`, `error`).
  3. Protection against double submission and sanitization of all user input.
- **Second deliverable:** `AI_FAILURE_AUDIT.md`, a report on the failure modes of AI-generated code found while building the slices above.
- **Serving:** Live Server at `http://localhost:5500`, never `file:///`.

## 2. Work Breakdown Structure

| ID | Task | Files | Acceptance criteria | Commit message |
|----|------|-------|---------------------|----------------|
| T-01 | Write the specification | `TASK_DECOMPOSITION.md` (plus `.gitignore`, `CLAUDE.md`, `project-rules.md`) | All nine required sections exist; contracts are unambiguous; no code is written. | `docs(spec): define component contracts & WBS table` |
| S1a | Empty CSS placeholders | `css/reset.css`, `css/tokens.css`, `css/layout.css`, `css/components.css` | Files exist and are empty; no HTML or JS touched. | `chore(css): add empty stylesheet placeholders` |
| S1b | Empty JS module placeholders | `js/main.js`, `js/countdown.js`, `js/form-state.js`, `js/mock-api.js`, `js/sanitize.js` | Files exist and are empty; no HTML or CSS touched. | `chore(js): add empty module placeholders` |
| T-02 | HTML structure | `index.html` | Matches the HTML contract (section 3); validates with no errors; one `h1`; no `div`, inline handlers, inline styles or inline scripts; page loads with unstyled content readable. | `feat(html): landing page structure` |
| T-03 | Design tokens & reset | `css/tokens.css`, `css/reset.css` | All colors, spacing, radii and font sizes are custom properties in `:root`; global `box-sizing: border-box`; text contrast at least 4.5:1 and focus indicators at least 3:1. | `feat(css): design tokens & box-sizing reset` |
| T-04 | Layout, components & form state styles | `css/layout.css`, `css/components.css` | Renders correctly at 375px and wider; no hard-coded colors; `form[data-state]` selectors style all four states; animations respect `prefers-reduced-motion`; visible focus styles. | `feat(css): layout, components & form state styles` |
| Slice 1 | Countdown | `js/countdown.js`, `js/main.js` | Follows the countdown contract (section 4); no `setInterval`; no decrementing counter; `stop()` clears the timer; resyncs after tab becomes visible. | `feat(js): drift-free countdown engine` |
| Slice 2 | State-machine form | `js/form-state.js`, `js/mock-api.js`, `js/main.js` | Follows the state machine contract (section 5) and mock API contract (section 7); `data-state` mirrors the machine state; invalid events return `false`. | `feat(js): state-machine form` |
| Slice 3 | Double-submit guard & sanitization | `js/sanitize.js`, `js/form-state.js`, `js/main.js` | Follows the sanitization contract (section 6); rapid repeated submits (click and Enter) produce exactly one `console.info` request line; user content is rendered only via `textContent`. | `feat(js): double-submit guard & input sanitization` |
| Audit | AI failure mode report | `AI_FAILURE_AUDIT.md` | Documents each AI failure found per slice: prompt, faulty output, how it was detected, the fix and the commit. | `docs(audit): AI failure mode report` |

Commit order follows the table. Each row is one atomic commit; HTML, CSS and JS are never combined in one commit.

## 3. HTML contract (`index.html`)

No `div` elements. Semantic elements only. Exactly one `h1`; headings never skip a level.

```
<header>
  <h1>Future Web Summit 2027 (demo event)</h1>
</header>
<main>
  <section id="countdown" aria-labelledby="countdown-title">
    <h2 id="countdown-title">Event starts in</h2>
    <time id="event-time" datetime="2027-01-15T02:00:00Z">...</time>
    <p id="countdown-timer" role="timer">
      <span data-unit="days"></span>
      <span data-unit="hours"></span>
      <span data-unit="minutes"></span>
      <span data-unit="seconds"></span>
    </p>
    <p id="countdown-done" hidden>...</p>
  </section>

  <section id="register" aria-labelledby="register-title">
    <h2 id="register-title">Register</h2>
    <form id="register-form" data-state="idle" novalidate>
      name:    label[for] + input + hint (p) + error (p); aria-describedby -> hint and error ids
      email:   label[for] + input[type=email] + hint + error; aria-describedby -> hint and error ids
      message: label[for] + textarea[maxlength=300] + hint + error; aria-describedby -> hint and error ids
      <button type="submit" id="submit-btn">
    </form>
    <button type="button" id="retry-btn" hidden>
    <p id="form-status" role="status"></p>
  </section>
</main>
<footer>...</footer>
```

Rules:
- `<html lang="en">`, `<meta charset="UTF-8">`, viewport meta. No `X-UA-Compatible`.
- Every control has a visible `<label for>`. Placeholders are never labels.
- Scripts load as `<script type="module" src="js/main.js">`; stylesheets are linked in this order: `reset.css`, `tokens.css`, `layout.css`, `components.css`.
- No inline event handlers, inline `style`, inline `<script>` or inline `<style>`.

## 4. Countdown contract (`js/countdown.js`)

```
export function getRemaining(targetMs, nowMs)
  -> { totalMs, days, hours, minutes, seconds }

export function startCountdown({ targetIso, onTick, onDone })
  -> stop()
```

- `getRemaining` is a pure function. It never returns negative values: when `nowMs >= targetMs`, every field is `0`.
- The target is an ISO 8601 UTC string read from the `datetime` attribute of `#event-time`. It is parsed with `Date.parse`; an invalid value is treated as an error, not as `NaN` output.
- Every tick recomputes the remaining time from `Date.now()`. A variable that is decremented each tick is forbidden.
- The next tick is scheduled with `setTimeout`, self-corrected to the start of the next wall-clock second: `delay = 1000 - (Date.now() % 1000)`. `setInterval` is forbidden.
- `stop()` calls `clearTimeout` and removes the `visibilitychange` listener.
- On `visibilitychange` to `visible`, the countdown cancels the pending timeout, recomputes immediately and reschedules.
- When `totalMs` reaches `0`, `onDone` is called once and no further tick is scheduled.
- `main.js` wires `onTick` to write the numbers into the four `data-unit` spans with `textContent`, and `onDone` to unhide `#countdown-done`.

## 5. State machine contract (`js/form-state.js`)

| Current state | Event | Next state |
|---------------|-------|------------|
| `idle` | `SUBMIT` | `submitting` |
| `submitting` | `RESOLVE` | `success` |
| `submitting` | `REJECT` | `error` |
| `error` | `RETRY` | `idle` |
| `success` | `RESET` | `idle` |

- Any other (state, event) pair is ignored: the state does not change, `onChange` is not called, and `send()` returns `false`. A valid transition returns `true`.
- Exports: `STATES` (frozen object of state names) and `createFormMachine({ onChange })` returning `{ send(event), getState() }`.
- `onChange(nextState, previousState)` is called after each valid transition.
- `main.js` mirrors the state into `form#register-form` via `form.dataset.state`, so CSS can style each state. It also toggles `#submit-btn` disabled, shows `#retry-btn` in `error`, and writes messages to `#form-status` with `textContent`.
- Configuration (labels and messages per state) is stored in `data-*` attributes, not in a `switch`.

## 6. Sanitization contract (`js/sanitize.js`)

```
export function sanitizeText(value, maxLength)
export function escapeHtml(value)
```

`sanitizeText` runs these steps in order: coerce to string, normalize to Unicode NFC, remove control characters, collapse whitespace runs to a single space, trim, then cut to `maxLength` (by code points, so surrogate pairs are not split).

`escapeHtml` replaces `&`, `<`, `>`, `"` and `'` with entities.

Any user-provided content shown in the UI goes through `textContent` only. `innerHTML`, `outerHTML`, `insertAdjacentHTML` and `document.write` are forbidden.

## 7. Mock API contract (`js/mock-api.js`)

```
export function mockSubmit(payload) -> Promise<{ id }>
```

- Resolves after about 1200 ms with `{ id }`.
- Rejects with an `Error` when `payload.email` ends with `@fail.test` (case-insensitive); otherwise resolves.
- Logs exactly one `console.info` line per request, at call time, so the number of requests can be counted during double-submit testing. This is the only permitted `console` call in the project.
- The timer used for the delay is not left running after the promise settles.

## 8. Verification gates and AI bug-hunting strategy

Gate checklist run before each commit:

| Task | Gate |
|------|------|
| T-01 | Read the file against the nine requirements; `git status` shows only the four named files. |
| S1a, S1b | Files exist and are empty; `git diff --cached --stat` shows only the named paths. |
| T-02 | W3C validator reports no errors; one `h1`; no skipped heading levels; no `div`, `style=` or `on*=` attributes (`grep`); every control has a label; page opens via `http://localhost:5500`. |
| T-03 | `grep` finds no hex or rgb values outside `tokens.css`; contrast checked at 4.5:1 for text and 3:1 for focus rings. |
| T-04 | Check at 375px, 768px and 1280px with no horizontal scroll; toggle each `data-state` value in DevTools and confirm styling; enable reduced motion and confirm animations stop. |
| Slice 1 | `grep` finds no `setInterval`; throttle the tab or change the system clock and confirm the display corrects itself; call `stop()` and confirm no timers remain; confirm `onDone` fires once. |
| Slice 2 | Drive every valid transition and several invalid ones (expect `false`); submit with `@fail.test` and with a normal email; confirm `data-state` changes. |
| Slice 3 | Click submit rapidly and press Enter repeatedly: console shows one `console.info` line per accepted submit; paste `<img src=x onerror=alert(1)>` and control characters and confirm they appear as plain text. |
| Audit | Every finding links to a slice, a prompt and a commit hash. |

AI bug-hunting strategy, after every slice and before committing:

1. Run an adversarial review prompt on the diff, for example: "Review this diff against `project-rules.md` and the relevant contract. List every violation, every unhandled edge case, and every place where a timer, listener or state can leak or go stale. Do not rewrite the code."
2. Check the known AI failure patterns for the slice: `setInterval` or a decrementing counter in the countdown; a missing `event.repeat` check; transitions allowed from the wrong state; a disabled button used as the only double-submit guard; `innerHTML` for user text; leftover `console.log`; commented-out code.
3. Try to break the result manually (rapid input, tab switching, invalid dates, long strings, emoji).
4. Record each failure in notes for `AI_FAILURE_AUDIT.md`: the prompt, the faulty output, how it was found, and the fix.

## 9. Rules

- No one-shot prompts. The project is built in small steps, one task or slice per prompt.
- One slice = one atomic commit, with the exact message from the WBS table.
- At least five commits in total (this plan has nine).
- Stage only the files named in the task, with explicit paths; never `git add .` or `git add -A`.
- Never push, amend, rebase or hard reset.
- Do not start the next task until the current one is verified and committed.
