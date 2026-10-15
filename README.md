# Event Hub: Future Web Summit 2027 (demo event)

A landing page for **Future Web Summit 2027 (demo event)**. It has a drift-free countdown to the event start and a registration form driven by an explicit state machine.

> **This is a demo.** The event does not exist, nobody can actually register, and no data leaves the browser. The page was built as a web development course assignment (vanilla HTML5, CSS and ES modules, with no frameworks, packages, bundlers or CDNs).

## Running the project

1. Open the project folder in VS Code.
2. Start the **Live Server** extension ("Go Live").
3. Browse to `http://localhost:5500`.

Do not open `index.html` through `file:///`. The page loads ES modules (`type="module"`), which browsers block on `file://`.

**CSP note:** the page ships a strict Content-Security-Policy. Live Server injects its own inline script for live reload, so the browser console may report a CSP violation for that script. This comes from Live Server, not from the project.

## Project structure

```
hw3-event-hub/
├── index.html               Page structure: countdown section, registration form, CSP meta tag
├── css/
│   ├── reset.css            Global reset (box-sizing: border-box) and reduced-motion handling
│   ├── tokens.css           Design tokens: colors, spacing, radii and font sizes as custom properties
│   ├── layout.css           Page layout: body grid background, header, main, footer, countdown grid, form layout
│   └── components.css       Component styles, including the styles for each form[data-state] value
├── js/
│   ├── main.js              Entry point: wires the countdown, the form, validation and the DOM updates
│   ├── countdown.js         getRemaining() and startCountdown(): self-correcting timer
│   ├── form-state.js        STATES and createFormMachine(): the form state machine
│   ├── mock-api.js          mockSubmit(): fake registration request (no server)
│   └── sanitize.js          sanitizeText() and escapeHtml()
├── TASK_DECOMPOSITION.md    Specification, contracts and work breakdown
├── AI_FAILURE_AUDIT.md      Report on defects found in AI-generated code
├── project-rules.md         Project constraints (stack, HTML, CSS, JS, security, Git)
├── CLAUDE.md                Loads project-rules.md and sets session rules
└── README.md                This file
```

## The three slices

### Slice 1: Countdown (`js/countdown.js`)

- **Target date:** read from the `datetime` attribute of `#event-time` (`2027-01-15T02:00:00Z`). It must be an ISO 8601 UTC string ending in `Z`. Strings without the designator, and impossible dates such as `2027-02-31T00:00:00Z`, are rejected with an error instead of being read as local time.
- **No drift:** each tick recomputes the remaining time from `Date.now()` instead of decrementing a counter. The next tick is scheduled with a self-correcting `setTimeout`, using `1000 - (Date.now() % 1000)` so it lands on the next wall-clock second. There is no `setInterval`.
- **Resync:** when the tab becomes visible again (`visibilitychange`), the pending timeout is cancelled and the display is recomputed immediately. On `pageshow` with `persisted` set (restore from the back/forward cache) the countdown does the same. On `pagehide` it stops the timer; a persisted page keeps its listeners for the restore, any other page unload also removes them.
- **Done:** at zero, `onDone` is called once and no further tick is scheduled. `main.js` then shows `#countdown-done`.
- **Cleanup:** `startCountdown` returns `stop()`, which clears the timeout and removes all three listeners.

### Slice 2: Form state machine (`js/form-state.js`)

States: `idle`, `submitting`, `success`, `error`. Any (state, event) pair not in the table is ignored: the state does not change, `onChange` is not called, and `send()` returns `false`.

| Current state | Event | Next state |
|---------------|-------|------------|
| `idle` | `SUBMIT` | `submitting` |
| `submitting` | `RESOLVE` | `success` |
| `submitting` | `REJECT` | `error` |
| `error` | `RETRY` | `idle` |
| `success` | `RESET` | `idle` |

`main.js` mirrors the state into `form.dataset.state`, so CSS styles each state. It also sets `aria-busy`, disables the submit button and the fields while `submitting`, shows `#retry-btn` in `error`, and writes the status message with `textContent`. The `RETRY` event is sent by the **Try again** button. The `RESET` event is sent when the user edits a field after a successful registration. After a retry, focus moves back to the first field.

### Slice 3: Double-submit guard and sanitization (`js/main.js`, `js/sanitize.js`)

- **Synchronous state check:** `handleSubmit` returns early unless the machine is in `idle`, and `machine.send('SUBMIT')` moves it to `submitting` before any asynchronous work starts. A second click or Enter press in the same tick is therefore rejected.
- **Locked controls:** while `submitting`, the submit button and every field are disabled.
- **Idempotency key:** a key from `crypto.randomUUID()` is created on the first attempt, sent in the payload, reused when the user retries after an error, and cleared after a success. The mock API receives the key but does not use it, since there is no server to deduplicate requests.
- **Stale responses:** a request counter makes `register()` ignore results from anything but the latest request.
- **`sanitizeText(value, maxLength)`:** coerces to string, normalizes to Unicode NFC, removes invisible and bidirectional control characters, turns whitespace runs into a single space, trims, cuts to `maxLength` by code points (so surrogate pairs are not split), and returns an empty string when no visible character remains. The form applies it to every field before validation, with limits of 80 (name), 254 (email) and 300 (message) characters, and lowercases the email.
- **Output:** user content is shown only through `textContent`. `escapeHtml` is exported for completeness but the page does not need it.

## Quick test

| Input | Result |
|-------|--------|
| Any normal email, such as `ada@example.com` | After about 1.2 seconds the status reads "Thanks, *name*! You are registered." (`success`) |
| An email ending in `@fail.test`, such as `ada@fail.test` | The request is rejected, the status reads "Something went wrong. Please try again." (`error`) and the **Try again** button appears |

To check the double-submit guard, click **Register now** rapidly or hold Enter in a field. The console should show a single `[mock-api] request` line per accepted submit. That line is the only `console` call in the project.

## Security

- **Strict CSP** in a `<meta>` tag: `default-src 'none'`, with `script-src`, `style-src`, `img-src` (plus `data:`) and `connect-src` limited to `'self'`, and `base-uri 'none'` and `form-action 'none'`.
- **No inline code:** no inline `<script>`, no inline `<style>`, no `style=""` attributes and no inline event handlers. All scripts and styles are separate local files.
- **No `innerHTML`** (or `outerHTML`, `insertAdjacentHTML`, `document.write`) with user data. Text is written with `textContent`.
- **No `eval`**, no `new Function`, and no external resources of any kind.
- **Input is untrusted:** every field passes through `sanitizeText` and native constraint validation before it is used.

## Process and history

The project was built from the plan in [TASK_DECOMPOSITION.md](TASK_DECOMPOSITION.md): one task, one atomic commit, with the commit message set by the plan. Defects found in AI-generated code during the build are documented in [AI_FAILURE_AUDIT.md](AI_FAILURE_AUDIT.md).

| Task | Commit | Message |
|------|--------|---------|
| T-01 | `caa921f` | docs(spec): define component contracts & WBS table |
| S1a | `5a99480` | chore(css): add empty stylesheet placeholders |
| S1b | `6b9e973` | chore(js): add empty module placeholders |
| T-02 | `bd139a1` | feat(html): landing page structure |
| T-03 | `8816a01` | feat(css): design tokens & box-sizing reset |
| T-04 | `4ab4412` | feat(css): layout, components & form state styles |
| Slice 1 | `46a664c` | feat(js): drift-free countdown engine |
| Slice 1 fix | `a80a1c7` | fix(js): resume countdown after bfcache restore |
| Slice 1 fix | `8a564c7` | fix(js): reject date strings without a UTC designator |
| Slice 2 | `b28912f` | feat(js): state-machine form |
| Slice 2 fix | `6fff7fa` | fix(js): keep focus after retry |
| Slice 2 fix | `65a1238` | fix(js): clear field errors when the user edits |
| Slice 3 | `69e0975` | feat(js): double-submit guard & input sanitization |
| Slice 3 fix | `3426c18` | fix(js): strip invisible and bidi control characters |
| Audit | `93f5c84` | docs(audit): AI failure mode report |

## Honest notes

- The event is fictional. The page footer says so, and so does the page header.
- There is no backend. `mockSubmit` waits about 1.2 seconds and then resolves or rejects based on the email suffix. Nothing is stored or sent anywhere, and the idempotency key has no server to act on it.
- The registration form has no persistence: after a success the form is reset and the data is gone.
