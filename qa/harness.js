// Headless harness for flag-ref.html (jsdom). Loads the real page, gives it a
// controllable clock, and exposes helpers to drive it like a user would.
//
//   const { boot } = require('./harness');
//   const app = boot();              // fresh app, empty storage
//   app.click('[data-act="newGame"]');
//   app.type('name0', 'Tigers'); app.type('name1', 'Sharks');
//   app.click('#kick0'); app.click('[data-act="toReady"]'); app.click('[data-act="startGame"]');
//   app.advance(5 * 60000);          // 5 minutes pass (fires the app's tick)
//   app.click('[data-act="touchdown"][data-team="0"]');
//   app.click('[data-act="conv"][data-pts="1"]');
//   console.log(app.state().current.teams.map(t => t.score));
//   const app2 = app.relaunch();     // simulate force-quit + reopen with the same storage
//   const app3 = app.relaunch({ wipeStorage: true }); // iPhone-in-viewer behaviour: storage gone
//
// Every helper throws with a useful message if the target is missing/hidden,
// so a test that "clicks" something that isn't on screen fails loudly.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const HTML = fs.readFileSync(process.env.FLAGREF_FILE || path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
const FULL_DOC = /^\s*<!doctype/i.test(HTML);

function boot(opts = {}) {
  const storage = opts.storage || new Map();
  let now = opts.now || Date.UTC(2026, 9, 6, 19, 0, 0); // Tue Oct 6 2026 12:00 PDT (Week 2)
  const timers = [];   // {id, at, fn, interval}
  let nextTimer = 1;

  const dom = new JSDOM(FULL_DOC ? HTML : '<!doctype html><html><head><meta charset="utf-8"></head><body>' + HTML + '</body></html>', {
    runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test/app',
    beforeParse(window) {
      // --- storage ---
      const ls = {
        getItem: (k) => (storage.has(k) ? storage.get(k) : null),
        setItem: (k, v) => storage.set(k, String(v)),
        removeItem: (k) => storage.delete(k), clear: () => storage.clear(), key: (i) => [...storage.keys()][i], get length() { return storage.size; }
      };
      Object.defineProperty(window, 'localStorage', { value: ls, configurable: true });
      // --- controllable time ---
      window.Date = class extends Date { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return now; } };
      window.setTimeout = (fn, ms = 0, ...args) => { const id = nextTimer++; timers.push({ id, at: now + Math.max(0, ms), fn: () => fn(...args), interval: null }); return id; };
      window.setInterval = (fn, ms = 0, ...args) => { const id = nextTimer++; timers.push({ id, at: now + Math.max(1, ms), fn: () => fn(...args), interval: Math.max(1, ms) }); return id; };
      window.clearTimeout = window.clearInterval = (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); };
      window.requestAnimationFrame = (fn) => window.setTimeout(() => fn(now), 16);
      // --- device-ish stubs ---
      window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
      Object.defineProperty(window.screen, 'width', { value: 393, configurable: true });
      Object.defineProperty(window.screen, 'height', { value: 852, configurable: true });
      window.scrollTo = () => {};
      window.navigator.vibrate = () => true;
      window.navigator.clipboard = { writeText: async (t) => { window.__clipboard = t; } };
      window.AudioContext = class { constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; } resume() {} createOscillator() { return { type: '', frequency: { value: 0 }, connect() { return this; }, start() {}, stop() {} }; } createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() { return this; } }; } };
      window.__errors = [];
      window.addEventListener('error', (e) => window.__errors.push(String(e.error && e.error.stack || e.message)));
    }
  });
  const { window } = dom;
  const document = window.document;
  // run the page script inside the window
  const script = [...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((t) => /const VERSION/.test(t));
  try { window.eval(script); } catch (e) { window.__errors.push('boot: ' + (e.stack || e)); }

  function runTimers(until) {
    // fire due timers in order until `until`
    for (;;) {
      const due = timers.filter((t) => t.at <= until).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      now = Math.max(now, due.at);
      if (due.interval) due.at = now + due.interval; else timers.splice(timers.indexOf(due), 1);
      try { due.fn(); } catch (e) { window.__errors.push('timer: ' + (e.stack || e)); }
    }
    now = until;
  }

  const visible = (el) => { let n = el; while (n && n !== document.body) { if (n.hidden || (n.style && n.style.display === 'none')) return false; n = n.parentElement; } return true; };
  const modalOpen = () => document.getElementById('modal').classList.contains('open');

  const app = {
    window, document, storage,
    now: () => now,
    /** advance the fake clock by ms, firing the app's timers (tick every 250 ms) */
    advance(ms) { runTimers(now + ms); return app; },
    /** dispatch a real click on the first matching, visible element. If a modal is open, look inside it first. */
    click(sel) {
      const root = modalOpen() ? document.getElementById('sheet') : document;
      // prefer a visible match (several screens share button labels like Quick rules)
      let el = [...root.querySelectorAll(sel)].find(visible) || root.querySelector(sel);
      if ((!el || !visible(el)) && modalOpen()) el = [...document.querySelectorAll(sel)].find(visible) || el;   // e.g. scrim / alert
      if (!el) throw new Error(`click: no element matches ${sel} (modal ${modalOpen() ? 'open' : 'closed'}, screen ${app.screen()})`);
      if (!visible(el)) throw new Error(`click: ${sel} is hidden (screen ${app.screen()})`);
      if (el.disabled) throw new Error(`click: ${sel} is disabled`);
      el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
      runTimers(now); return app;
    },
    /** drag a slide-to-confirm knob by dx px (default: far enough to confirm); fires the action after its 120 ms settle */
    slide(sel, dx = 400) {
      const root = modalOpen() ? document.getElementById('sheet') : document;
      const el = [...root.querySelectorAll(sel)].find(visible); if (!el) throw new Error(`slide: no visible element matches ${sel}`);
      const knob = el.querySelector('.slide-knob'); if (!knob) throw new Error('slide: not a slider: ' + sel);
      const ev = (type, x) => new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: 10 });
      knob.dispatchEvent(ev('pointerdown', 10)); document.dispatchEvent(ev('pointermove', 10 + dx / 2)); document.dispatchEvent(ev('pointermove', 10 + dx)); document.dispatchEvent(ev('pointerup', 10 + dx));
      runTimers(now + 150); return app;
    },
    /** set an input's value and fire input */
    type(id, value) { const el = document.getElementById(id); if (!el) throw new Error('type: no #' + id); el.value = value; el.dispatchEvent(new window.Event('input', { bubbles: true })); return app; },
    key(code) { document.dispatchEvent(new window.KeyboardEvent('keydown', { code, key: code === 'Space' ? ' ' : code, bubbles: true, cancelable: true })); runTimers(now); return app; },
    /** the app's persisted state (what localStorage holds) */
    state() { const r = storage.get('flagref.v1'); return r ? JSON.parse(r) : null; },
    screen() { return ['home', 'setup', 'ready', 'board'].find((id) => !document.getElementById(id).hidden); },
    modal() { return modalOpen() ? document.getElementById('sheet').textContent.replace(/\s+/g, ' ').trim() : null; },
    modalOpen,
    alertVisible() { return !document.getElementById('alert').hidden; },
    text(sel) { const el = document.querySelector(sel); return el ? el.textContent.replace(/\s+/g, ' ').trim() : null; },
    clock() { return app.text('#digits'); },
    clockState() { const c = document.getElementById('clock'); return { state: c.dataset.state, running: c.dataset.running, status: app.text('#clockStatus'), pre: app.text('#clockPre'), sub: app.text('#clockSub') }; },
    scores() { return [app.text('#bScore0'), app.text('#bScore1')].map(Number); },
    toast() { return app.text('#toast'); },
    errors() { return window.__errors.slice(); },
    /** simulate the app being killed and reopened. wipeStorage mimics iPhone-in-viewer (fresh storage). */
    relaunch(o = {}) { return boot({ storage: o.wipeStorage ? new Map() : new Map(storage), now: now + (o.after || 0) }); },
    /** simulate the phone being in a pocket: hide, advance, show (fires visibilitychange) */
    background(ms) {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new window.Event('visibilitychange'));
      // timers are frozen while suspended: just move time forward without firing them
      now += ms; timers.forEach((t) => { if (t.interval) t.at = now + t.interval; });
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new window.Event('visibilitychange'));
      runTimers(now); return app;
    },
    dump() { return { screen: app.screen(), clock: app.clock(), clockState: app.clockState(), scores: app.screen() === 'board' ? app.scores() : null, modal: app.modal(), alert: app.alertVisible(), toast: app.toast(), errors: app.errors() }; }
  };
  runTimers(now);
  return app;
}

/** convenience: get a live game going */
function quickGame(app, o = {}) {
  app.click('[data-act="newGame"]');
  app.type('name0', o.a || 'Tigers'); app.type('name1', o.b || 'Sharks');
  if (o.halfMin) app.type('halfMin', String(o.halfMin));
  app.click('#kick' + (o.kick || 0));
  app.click('[data-act="toReady"]');
  app.click('[data-act="startGame"]');
  return app;
}

module.exports = { boot, quickGame };
