# Flag Ref

Scoreboard + clock + quick rules for refereeing UBC Point Grey Cup flag football. Single-file PWA, installed to refs' home screens, works offline. Live: https://tomkoenig18000.github.io/flag-ref/

## Layout
- `src/app.html` — the only file you edit (body-only: `<title>`, `<style>`, markup, one `<script>`).
- `build.py` — generates `docs/` (served by GitHub Pages: `index.html`, `manifest`, `sw.js`, icons) and `flag-ref.html` (body-only copy for the legacy Claude artifact).
- `qa/` — jsdom harness (`harness.js`), spec (`BEHAVIOUR.md`), regression suite (`regress.js`). Run `cd qa && npm install && npm test`.
- `rulebook-questions.md` — rulebook ambiguities + the calls Tom settled at training. The rulebook PDF is git-ignored (UBC copyright).

## Release
1. Bump `const VERSION` and the `vN` label in `src/app.html` (the home screen shows it; that's how refs confirm an update).
2. `python3 build.py && (cd qa && npm test)` — all lines must PASS.
3. Commit and push `main`; Pages deploys in ~1 min. Refs get it on their next launch with signal.

## Rules that shape the code
- Every irreversible or accidental-prone change confirms by **slide** (`slideHtml()` / `data-slide`), never a tap. Taps only navigate, stage, or start the clock.
- Clock is timestamp-based (`clock.since`); a running clock produces no writes. Stop time = 2nd half, ≤ 1:00 on the clock, differential ≤ 14.
- Fair play ratings are an IM requirement: finishing needs both, or an explicit "finish without".
- Phone storage is the durable copy in the standalone app; the cloud (`window.claude` db) exists only inside the Claude viewer (`IN_VIEWER`).
- Team names are user text — always through `esc()`.
- League weeks come from `SEASONS` (Tue–Thu blocks from the first Tuesday of play); add an entry when winter dates are published.
