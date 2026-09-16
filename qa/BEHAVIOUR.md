# Flag Ref — intended behaviour (what counts as a bug)

Single-file web app for refereeing UBC intramural flag football. Two teams, yellow vs blue flags.

## Flow
Home → New game → Setup (names, flag colours, who kicks off 1st half, half length 1–60 min, default 20)
→ Continue → Ready screen → Start game (starts the clock) → Board.
- Setup validation: both names required (whitespace-only is invalid); a kickoff team must be chosen; half length 1–60.
- Flags are mutually exclusive: picking yellow for one team makes the other blue.
- Team names are user text: must be shown escaped (no HTML injection).

## Board
- Clock counts down from halfLength; tap clock = start/stop. Clock is timestamp based, so time passes while backgrounded.
- TD button: +6 immediately AND opens a locked full-screen conversion modal (2 pts / 1 pt / No good / "Oops — not a TD").
  The modal cannot be dismissed by scrim/close; only by answering or undoTD. Another TD tap while pending must not add points.
- Undo (board): removes the last log entry and its points; undoing a conversion re-opens the conversion modal; undoing a TD removes 6.
- Adjust score (menu): ±1 per tap, logged as adjustments, score never below 0.
- Set clock (menu): mm:ss, capped at half length, clock stops after setting. Setting 0:00 while live ends the half.
- Menu: End half now / End game now (with confirm), Share, Diagnostics, Back to home (keeps game), Abandon (with confirm).
- Scores, log, clock, and status must survive: goHome+resume, and relaunch (same storage). With wiped storage and no cloud, loss is expected (documented) — not a bug.

## Halves
- 1st half hits 0:00 → status "halftime", clock resets to full length, halftime modal (shows who kicks off 2nd half, Start 2nd half, Not yet, Set the clock instead).
- Tapping the clock at halftime starts the 2nd half. Start 2nd half resets clock to full length and starts it, warned=false.
- 2nd half hits 0:00 → status "over", Final modal (Save & finish, Share, Not yet, Set the clock instead). Scoring is still allowed after 0:00 (untimed down) and after conversion the Final modal reappears.
- If a locked conversion modal is open when a half expires, the halftime/final modal appears after the conversion is answered.
- "Set the clock instead" from halftime/final with a value > 0 revives that half as live.

## Stop time (2nd half only)
- From 3:00 in the 2nd half a pill says "Stop time at 1:00 — within 14" or "Clock runs at 1:00 — up by more than 14".
- Crossing 1:00 while running: warned=true, full-screen alert ("Stop time" if |diff| ≤ 14 else "Clock runs"), auto-hides.
- Under 1:00: clock block state is "stoptime" when |diff| ≤ 14 (amber running / red stopped) else normal with "Clock runs" pill.
- If the differential crosses 14 during the last minute, an alert fires ("Stop time on"/"Stop time off") and the state flips. It must not fire repeatedly without a change.
- Alert must not fire on relaunch of a game whose warned flag is already true.

## Finish / history
- Save & finish: game moves to Past games (home), grouped by league week: Tue–Thu blocks from Tue Sep 29 2026 = Week 1, … ; Tue Nov 24 2026 onward = "Playoffs · Week N"; games on Fri–Mon or outside the season go under "Test / other". Most recent week first, Test/other last.
- Tap a past game: log + Share + Delete (confirm). Delete removes exactly that game.
- Share text: "Team (flag) X – Y Team (flag)", FINAL or (in progress), plus scoring lines like "2H 4:12  Tigers · 1-pt conversion  +1".
- Quick rules and Diagnostics open as modals from home, setup, ready and the game menu without losing setup inputs.

## Keyboard (Bluetooth clicker)
- Space/Enter/Arrows/PageUp/PageDown/KeyB toggle the clock on the board only, never while a modal is open or while typing in an input; if an alert is showing, the key dismisses it instead.

## General
- No uncaught JS errors at any point (harness collects them in app.errors()).
- No state where the app is stuck: e.g. a modal that can't be closed (other than the intentional conversion lock), a clock that can't be started when it should, a half that ends but shows the wrong status.
