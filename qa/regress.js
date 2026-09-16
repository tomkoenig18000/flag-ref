const { boot, quickGame } = require('./harness');
const fpFinish = (x) => { x.click('[data-act="fpScore"][data-to="0"][data-score="4"]'); x.click('[data-act="fpScore"][data-to="1"][data-score="5"]'); x.slide('[data-slide="finish"]'); return x; };
const out = [];
const ok = (name, cond, extra) => out.push((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? ' — ' + JSON.stringify(extra) : ''));
// 1 new game over in-progress asks first
let a = quickGame(boot()); a.click('[data-act="menu"]'); a.click('[data-act="goHome"]');
a.click('[data-act="newGame"]'); ok('newGame confirm shown', /Start a new game\?/.test(a.modal() || ''), a.modal());
a.click('[data-act="close"]'); ok('cancel keeps game', a.state().current && a.state().current.status === 'live');
a.click('[data-act="newGame"]'); a.slide('[data-slide="newGameConfirm"]'); ok('confirm starts setup', a.screen() === 'setup' && a.state().current.status === 'setup');
// 2 cancel on setup discards the half-made game
a.type('name0', 'Half'); a.click('[data-act="goHome"]'); ok('cancel discards setup game', a.state().current === null && a.screen() === 'home');
// 3 delete by id removes the right game
a = boot(); for (const n of ['One','Two','Three']) { a = quickGame(a, { a: n, b: 'X' }); a.advance(40*60000); a.slide('[data-slide="startHalf2"]'); a.advance(20*60000 + 500); fpFinish(a); a.advance(1000); }
const two = a.state().games.find(g => g.teams[0].name === 'Two');
a.click(`[data-act="viewGame"][data-id="${two.id}"]`); a.click('[data-act="deleteSaved"]'); a.slide('[data-slide="deleteSavedConfirm"]');
ok('deleted exactly Two', a.state().games.map(g => g.teams[0].name).join(',') === 'Three,One', a.state().games.map(g => g.teams[0].name));
ok('unique ids', new Set(a.state().games.map(g => g.id)).size === 2);
// 4 set clock from menu at halftime sets 2nd-half clock without reviving
a = quickGame(boot(), { halfMin: 2 }); a.advance(2*60000+300); ok('halftime banner', /Halftime/.test(a.modal()||''));
a.click('[data-act="close"]'); a.click('[data-act="menu"]'); a.click('[data-act="adjustClock"]'); a.type('setMin','1'); a.type('setSec','30'); a.slide('[data-slide="applyClock"]');
ok('menu set clock keeps halftime', a.state().current.status === 'halftime' && a.clock() === '1:30', [a.state().current.status, a.clock()]);
a.click('#clock'); a.slide('[data-slide="startHalf2"]'); ok('2nd half starts from the set clock', a.state().current.half === 2 && a.clock() === '1:30', a.clock());
// 5 set clock from the banner revives the 1st half
a = quickGame(boot(), { halfMin: 2 }); a.advance(2*60000+300); a.click('[data-act="adjustClockRevive"]'); a.type('setMin','0'); a.type('setSec','25'); a.slide('[data-slide="applyClock"]');
ok('banner set clock revives 1st half', a.state().current.status === 'live' && a.state().current.half === 1 && a.clock() === '0:25', [a.state().current.status, a.clock()]);
// 6 expiry while a sheet is open: banner waits, then appears on close
a = quickGame(boot(), { halfMin: 1 }); a.advance(55000); a.click('[data-act="menu"]'); a.click('[data-act="adjustScore"]'); a.advance(10000);
ok('sheet not replaced by expiry', /Adjust score/.test(a.modal()||''), a.modal()); a.click('[data-act="adj"][data-team="0"][data-d="1"]');
a.slide('[data-slide="adjustApply"]'); ok('banner shows after close', /Halftime/.test(a.modal()||'') && a.state().current.teams[0].score === 1, a.modal());
a.click('[data-act="close"]'); ok('Not yet does not re-open', a.modal() === null);
// 7 expiry with conversion locked → banner after conversion
a = quickGame(boot(), { halfMin: 1 }); a.advance(58000); a.click('[data-act="touchdown"][data-team="1"]'); a.advance(5000); a.slide('[data-slide="conv"][data-pts="1"]');
ok('banner after conversion', /Halftime/.test(a.modal()||'') && a.scores()[1] === 7, [a.modal(), a.scores()]);
// 8 rules from setup preserve inputs (harness now picks visible button)
a = boot(); a.click('[data-act="newGame"]'); a.type('name0','Keep'); a.click('[data-act="rules"]'); ok('rules opens from setup', /Quick rules/.test(a.modal()||'')); a.click('[data-act="close"]'); ok('setup input kept', a.document.getElementById('name0').value === 'Keep');
// 9 full game + relaunch still fine, no errors
a = quickGame(boot()); a.advance(40*60000); a.slide('[data-slide="startHalf2"]'); a.advance(20*60000 + 500); fpFinish(a); const b = a.relaunch();
ok('relaunch home with 1 game', b.screen() === 'home' && b.state().games.length === 1);
ok('no errors', a.errors().length === 0 && b.errors().length === 0, a.errors().concat(b.errors()));
console.log(out.join('\n'));
// round-2 review regressions
{
  // banner does not reopen spuriously after goHome/resume when a half ended behind the menu
  let c = quickGame(boot(), { halfMin: 1 }); c.advance(58000); c.click('[data-act="menu"]'); c.advance(3000);
  c.click('[data-act="goHome"]'); c.click('[data-act="resume"]'); const first = /Halftime/.test(c.modal()||'');
  c.click('[data-act="close"]'); const reopened = c.modal() !== null;
  console.log((first && !reopened ? 'PASS' : 'FAIL') + ' no spurious banner reopen — ' + JSON.stringify([first, reopened]));
  // finish without cloud queues the game for upload and persists that
  let d = quickGame(boot()); d.advance(40*60000); d.slide('[data-slide="startHalf2"]'); d.advance(20*60000 + 500); fpFinish(d);
  const st = d.state(); console.log((st.unsyncedGames.length === 1 && st.games[0].id === st.unsyncedGames[0] ? 'PASS' : 'FAIL') + ' finish queued for upload — ' + JSON.stringify(st.unsyncedGames));
  console.log((d.errors().length + c.errors().length === 0 ? 'PASS' : 'FAIL') + ' no errors r2');
}
// slide-to-confirm
{
  let e = quickGame(boot()); e.advance(5000);
  e.click('#clock'); console.log((e.state().current.clock.since !== null ? 'PASS' : 'FAIL') + ' tap does not stop a running clock — ' + e.toast());
  e.slide('#stopSlide', 40); console.log((e.state().current.clock.since !== null ? 'PASS' : 'FAIL') + ' short slide does not stop');
  e.slide('#stopSlide'); console.log((e.state().current.clock.since === null && e.document.getElementById('stopSlide').hidden ? 'PASS' : 'FAIL') + ' full slide stops and hides the slider');
  e.click('#clock'); console.log((e.state().current.clock.since !== null && !e.document.getElementById('stopSlide').hidden ? 'PASS' : 'FAIL') + ' tap starts again, slider back');
  e.key('Space'); console.log((e.state().current.clock.since === null ? 'PASS' : 'FAIL') + ' clicker key still stops immediately');
  e.click('#clock'); e.click('[data-act="touchdown"][data-team="1"]'); e.slide('[data-slide="conv"][data-pts="2"]', 30);
  console.log((e.state().current.pending && e.scores()[1] === 6 ? 'PASS' : 'FAIL') + ' short conversion slide does nothing');
  e.slide('[data-slide="conv"][data-pts="2"]'); console.log((!e.state().current.pending && e.scores()[1] === 8 && e.modal() === null ? 'PASS' : 'FAIL') + ' full conversion slide confirms 2 pts');
  // stop time: tap stops directly, no slider
  e.advance(20*60000); e.slide('[data-slide="startHalf2"]'); e.advance(19*60000+5000); e.click('[data-act="hideAlert"]');
  console.log((e.document.getElementById('stopSlide').hidden && e.clockState().state === 'stoptime' ? 'PASS' : 'FAIL') + ' no slider in stop time');
  e.click('#clock'); console.log((e.state().current.clock.since === null ? 'PASS' : 'FAIL') + ' tap stops in stop time');
  console.log((e.errors().length === 0 ? 'PASS' : 'FAIL') + ' no errors slide');
}
// v14: staged adjustments, undo sheet, halftime slide
{
  let f = quickGame(boot()); f.click('[data-act="touchdown"][data-team="0"]'); f.slide('[data-slide="conv"][data-pts="1"]');
  f.click('[data-act="menu"]'); f.click('[data-act="adjustScore"]'); f.click('[data-act="adj"][data-team="1"][data-d="1"]'); f.click('[data-act="adj"][data-team="1"][data-d="1"]'); f.click('[data-act="adj"][data-team="0"][data-d="-1"]');
  console.log((f.scores().join(',') === '7,0' ? 'PASS' : 'FAIL') + ' staged taps do not change the board yet — ' + f.scores());
  f.click('[data-act="close"]'); console.log((f.scores().join(',') === '7,0' && f.state().current.log.length === 2 ? 'PASS' : 'FAIL') + ' cancel discards staged');
  f.click('[data-act="menu"]'); f.click('[data-act="adjustScore"]'); f.click('[data-act="adj"][data-team="1"][data-d="1"]'); f.click('[data-act="adj"][data-team="1"][data-d="1"]'); f.click('[data-act="adj"][data-team="0"][data-d="-1"]'); f.slide('[data-slide="adjustApply"]');
  const lg = f.state().current.log; console.log((f.scores().join(',') === '6,2' && lg.length === 4 && lg[2].pts === -1 && lg[3].pts === 2 ? 'PASS' : 'FAIL') + ' slide applies net adjustments as log entries — ' + JSON.stringify([f.scores(), lg.slice(2).map(e => [e.team, e.pts])]));
  f.click('[data-act="undo"]'); console.log((/Undo last play/.test(f.modal()||'') && f.scores().join(',') === '6,2' ? 'PASS' : 'FAIL') + ' undo opens a sheet, changes nothing yet');
  f.click('[data-act="close"]'); console.log((f.modal() === null && f.state().current.log.length === 4 ? 'PASS' : 'FAIL') + ' keep it');
  f.click('[data-act="undo"]'); f.slide('[data-slide="undoConfirm"]'); console.log((f.scores().join(',') === '6,0' && f.state().current.log.length === 3 ? 'PASS' : 'FAIL') + ' slide undoes — ' + f.scores());
  // halftime: tap shows banner, slide starts
  f.advance(20*60000+300); f.click('[data-act="close"]'); f.click('#clock'); console.log((/Halftime/.test(f.modal()||'') && f.state().current.status === 'halftime' ? 'PASS' : 'FAIL') + ' clock tap at halftime opens the banner, does not start');
  f.slide('[data-slide="startHalf2"]'); console.log((f.state().current.half === 2 && f.state().current.clock.since !== null ? 'PASS' : 'FAIL') + ' slide starts 2nd half');
  // set clock via slide; end game via confirm slide
  f.click('[data-act="menu"]'); f.click('[data-act="adjustClock"]'); f.type('setMin','0'); f.type('setSec','45'); f.slide('[data-slide="applyClock"]'); console.log((f.clock() === '0:45' && f.state().current.clock.since === null ? 'PASS' : 'FAIL') + ' set clock slide applies — ' + f.clock());
  f.click('[data-act="menu"]'); f.click('[data-act="endHalf"]'); f.slide('[data-slide="endHalfConfirm"]', 30); console.log((f.state().current.status === 'live' ? 'PASS' : 'FAIL') + ' short slide does not end game');
  f.slide('[data-slide="endHalfConfirm"]'); console.log((f.state().current.status === 'over' && /Final/.test(f.modal()||'') ? 'PASS' : 'FAIL') + ' full slide ends game');
  fpFinish(f); console.log((f.screen() === 'home' && f.state().games.length === 1 ? 'PASS' : 'FAIL') + ' finish slide saves');
  console.log((f.errors().length === 0 ? 'PASS' : 'FAIL') + ' no errors v14');
}
// v15: fair play
{
  const P = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  let h = quickGame(boot(), { halfMin: 1 }); h.advance(61000); h.slide('[data-slide="startHalf2"]'); h.advance(61000);
  P(/Final/.test(h.modal()||'') && !h.document.querySelector('#sheet [data-slide="finish"]') && /Finish without them/.test(h.modal()), 'final banner: no finish slide until both ratings');
  h.click('[data-act="fpScore"][data-to="0"][data-score="3"]');
  P(!h.document.querySelector('#sheet [data-slide="finish"]') && h.state().current.fairPlay[0].score === 3, 'one rating saved, still no slide');
  h.document.getElementById('fpNote0').value = 'Great sports'; h.document.getElementById('fpNote0').dispatchEvent(new h.window.Event('input', { bubbles: true }));
  const h2 = h.relaunch(); h2.advance(300);
  P(/Final/.test(h2.modal()||'') && h2.state().current.fairPlay[0].score === 3 && h2.state().current.fairPlay[0].note === 'Great sports' && h2.document.querySelector('#sheet [data-act="fpScore"][data-to="0"][data-score="3"]').getAttribute('aria-pressed') === 'true', 'rating + comment survive relaunch and re-render');
  h2.click('[data-act="fpScore"][data-to="1"][data-score="5"]');
  P(!!h2.document.querySelector('#sheet [data-slide="finish"]') && !h2.document.querySelector('#finishWrap .hint'), 'second rating reveals the finish slide and drops the hint');
  h2.click('[data-act="fpScore"][data-to="1"][data-score="5"]');
  P(!h2.document.querySelector('#sheet [data-slide="finish"]') && h2.state().current.fairPlay[1].score === null, 'tapping the same score clears it and hides the slide');
  h2.click('[data-act="fpScore"][data-to="1"][data-score="2"]'); h2.slide('[data-slide="finish"]');
  const saved = h2.state().games[0];
  P(h2.screen() === 'home' && saved.fairPlay[0].score === 3 && saved.fairPlay[0].note === 'Great sports' && saved.fairPlay[1].score === 2, 'fair play saved with the game');
  h2.click(`[data-act="viewGame"][data-id="${saved.id}"]`);
  P(/Fair play/.test(h2.modal()) && /Great sports/.test(h2.modal()), 'past game shows fair play');
  h2.click('[data-act="shareSaved"]'); P(/Fair play \(1–5\)/.test(h2.window.__clipboard) && /Tigers: 3  "Great sports"/.test(h2.window.__clipboard), 'share text includes fair play');
  // finish without scores → confirm slide
  let k = quickGame(boot(), { halfMin: 1 }); k.advance(61000); k.slide('[data-slide="startHalf2"]'); k.advance(61000);
  k.click('[data-act="finishWithoutFP"]'); P(/Finish without fair play/.test(k.modal()||''), 'finish-without opens a confirm');
  k.slide('[data-slide="finish"]'); P(k.screen() === 'home' && k.state().games[0].fairPlay[0].score === null, 'confirm slide finishes with empty ratings');
  P(h.errors().length + h2.errors().length + k.errors().length === 0, 'no errors v15');
}
