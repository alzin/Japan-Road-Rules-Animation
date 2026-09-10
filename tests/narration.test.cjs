const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const html = readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const learnUI = html.slice(html.indexOf('/* ===================== LEARN UI'), html.indexOf('function boot()'));

// Run the real scene/picker handlers with a deterministic clock and native speech
// stand-in. A canceled native voice may still be audible after cancel() returns.
const UA = {
  windowsChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0.0.0 Mobile/15E148 Safari/604.1',
  ipadDesktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'
};

function setup({ cancelDelay = 80, reportIdleEarly = false, cancelEvents = true, ua = UA.windowsChrome, voices = [], maxTouchPoints = 0 } = {}) {
  let now = 0, timerId = 0;
  const timers = new Map(), elements = new Map(), audible = new Set(), canceling = new Set();
  const calls = [];
  let overlaps = 0;
  const later = (fn, delay = 0) => {
    const id = ++timerId;
    timers.set(id, { fn, at: now + delay });
    return id;
  };
  const tick = ms => {
    const target = now + ms;
    for (let steps = 0; ; steps++) {
      assert.ok(steps < 1000, 'timers should settle');
      const next = [...timers].filter(([, task]) => task.at <= target).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      timers.delete(next[0]); now = next[1].at; next[1].fn();
    }
    now = target;
  };
  function element() {
    const listeners = new Map();
    return {
      open: false, children: [], dataset: {}, style: {}, value: '',
      classList: { add() {}, remove() {}, toggle() {} },
      setAttribute() {}, focus() {}, scrollIntoView() {},
      appendChild(child) { this.children.push(child); },
      addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
      dispatch(type, event = {}) { for (const fn of listeners.get(type) || []) fn(event); },
      showModal() { this.open = true; },
      close() { this.open = false; later(() => this.dispatch('close')); }
    };
  }
  const $ = selector => {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  };
  const synth = {
    get speaking() { return [...audible].some(u => !reportIdleEarly || !canceling.has(u)); },
    pending: false,
    getVoices() { return voices; },
    speak(utterance) {
      if (audible.size) overlaps++;
      audible.add(utterance); calls.push({ utterance, at: now });
    },
    cancel() {
      for (const utterance of audible) {
        if (canceling.has(utterance)) continue;
        canceling.add(utterance);
        if (cancelDelay === Infinity) continue;
        later(() => {
          audible.delete(utterance); canceling.delete(utterance);
          if (cancelEvents) utterance.onerror?.({ error: 'interrupted' });
        }, cancelDelay);
      }
    }
  };
  const window = element();
  window.speechSynthesis = synth;
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  window.scrollTo = () => {};
  const document = Object.assign(element(), { hidden: false, body: element(), createElement: element });
  const ORDER = ['left', 'speed', 'stop'];
  const TEXT = Object.fromEntries(ORDER.map((id, i) => [id, {
    num: i + 1, en: id, ja: `日本語 ${id}`, tag: {},
    caps: [[0, `${id} opening`, `${id} 最初`], [4, `${id} second`, `${id} 次`], [8, `${id} final`, `${id} 最後`]]
  }]));
  const context = vm.createContext({
    window, document, speechSynthesis: synth, SpeechSynthesisUtterance: window.SpeechSynthesisUtterance,
    navigator: { userAgent: ua, maxTouchPoints, language: 'en-US' },
    performance: { now: () => now }, setTimeout: later, clearTimeout: id => timers.delete(id),
    $, $$: () => [], ORDER, TEXT, T: x => x?.en || '', REDUCE: false, lang: 'en', threeOK: true,
    VEH: [], PEOPLE: [], localStorage: { getItem() { return null; }, setItem() {} },
    history: { state: null, pushState() {}, back() {} }, location: { href: '', hash: '#learn' },
    matchMedia: () => ({ addEventListener() {} }),
    BUILD: Object.fromEntries(ORDER.map(id => [id, () => ({ dur: 12, update() {} })])),
    clearStage() {}, hudHide() {}, setSceneTransition() {}, resize() {},
    renderSigns() {}, renderPenalties() {}, renderQuiz() {},
    IntersectionObserver: class {
      constructor(fn) { window.intersectionChanged = fn; }
      observe() {}
    }
  });
  window.IntersectionObserver = context.IntersectionObserver;
  const run = code => vm.runInContext(code, context);
  run(learnUI);
  // Rendering detailed lesson markup and camera movement are outside this test.
  run('renderChapterList=()=>{}; renderDetail=()=>{}; applyStrings=()=>{}; activeTab="learn"; bind();');
  return { run, tick, calls, $, document, window, synth, timers, get overlaps() { return overlaps; } };
}

test('all inline scripts parse', () => {
  for (const [, script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(script);
});

test('first idle playback starts synchronously and duplicate requests do not restart it', () => {
  const h = setup();
  h.run('loadChapter(0)');
  assert.equal(h.calls.length, 1, 'keep first playback inside the user gesture');
  h.run('speakCaption(); speakCaption();');
  assert.equal(h.calls.length, 1);
});

test('mobile picker selection starts the selected chapter only once', () => {
  const h = setup();
  h.run('loadChapter(0); openChapters();');
  h.tick(300);
  const selected = h.$('#sheetList').children.find(b => b.dataset.chapter === 1);
  selected.dispatch('click');
  h.tick(500); // The dialog close event fires after loadChapter has run.
  assert.deepEqual(h.calls.map(c => c.utterance.text), ['left opening', 'speed opening']);
  assert.equal(h.overlaps, 0);
});

for (const mode of [
  { name: 'native cancellation takes 700 ms', cancelDelay: 700 },
  { name: 'Safari reports idle before native audio stops', cancelDelay: 120, reportIdleEarly: true },
  { name: 'cancellation does not emit an end/error event', cancelDelay: 80, cancelEvents: false }
]) {
  test(`rapid scene changes discard superseded speech when ${mode.name}`, () => {
    const h = setup(mode);
    h.run('loadChapter(0); loadChapter(1); loadChapter(2);');
    assert.equal(h.calls.length, 1, 'replacement must wait for cancellation');
    h.tick(1000);
    assert.deepEqual(h.calls.map(c => c.utterance.text), ['left opening', 'stop opening']);
    assert.equal(h.overlaps, 0);
  });
}

test('late callbacks from canceled speech cannot clear the new request', () => {
  const h = setup();
  h.run('loadChapter(0)');
  const old = h.calls[0].utterance;
  h.run('loadChapter(1)'); h.tick(500);
  old.onend(); old.onerror();
  h.run('speakCaption()');
  assert.equal(h.calls.length, 2);
});

test('opening the picker during a caption fade keeps narration silent', () => {
  const h = setup();
  h.run('loadChapter(0); updateCaption(4,false); openChapters();');
  h.tick(500);
  assert.equal(h.calls.length, 1);
  h.run('closeChapters()'); h.tick(500);
  assert.equal(h.calls.at(-1).utterance.text, 'left second');
  assert.equal(h.overlaps, 0);
});

for (const action of ['pause', 'mute', 'tab', 'hidden', 'offscreen', 'pagehide']) {
  test(`${action} cancels pending replacement narration`, () => {
    const h = setup();
    h.run('loadChapter(0); loadChapter(1);');
    if (action === 'pause') h.run('togglePlay()');
    if (action === 'mute') h.run('setNarration(false)');
    if (action === 'tab') h.run('showTab("signs",{history:false})');
    if (action === 'hidden') { h.document.hidden = true; h.document.dispatch('visibilitychange'); }
    if (action === 'offscreen') h.window.intersectionChanged([{ isIntersecting: false }]);
    if (action === 'pagehide') h.window.dispatch('pagehide');
    h.tick(3000);
    assert.equal(h.calls.length, 1);
    assert.equal(h.synth.speaking, false);
  });
}

test('restoring a page and its visibility does not duplicate narration', () => {
  const h = setup();
  h.run('loadChapter(0)'); h.window.dispatch('pagehide'); h.tick(500);
  h.window.dispatch('pageshow'); h.document.dispatch('visibilitychange'); h.tick(500);
  assert.equal(h.calls.length, 2);
  assert.equal(h.overlaps, 0);
});

test('a delayed caption cannot restart speech after leaving the page', () => {
  const h = setup();
  h.run('loadChapter(0); updateCaption(4,false);');
  h.window.dispatch('pagehide'); h.tick(500);
  assert.equal(h.calls.length, 1);
  h.window.dispatch('pageshow'); h.tick(500);
  assert.equal(h.calls.at(-1).utterance.text, 'left second');
  assert.equal(h.overlaps, 0);
});

test('scrubbing replaces pending speech with the final caption', () => {
  const h = setup();
  h.run('loadChapter(0); loadChapter(1);');
  h.$('#scrub').dispatch('input', { target: { value: 750 } });
  h.tick(500);
  assert.equal(h.calls.length, 1);
  h.$('#scrub').dispatch('change'); h.tick(500);
  assert.equal(h.calls.at(-1).utterance.text, 'speed final');
  assert.equal(h.overlaps, 0);
});

test('language changes invalidate pending speech and use the selected locale', () => {
  const h = setup();
  h.run('loadChapter(0); loadChapter(1); setLang("ja");'); h.tick(500);
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls.at(-1).utterance.text, 'speed 最初');
  assert.equal(h.calls.at(-1).utterance.lang, 'ja-JP');
  assert.equal(h.overlaps, 0);
});

test('replay intentionally restarts the opening caption', () => {
  const h = setup();
  h.run('loadChapter(0)'); h.$('#replayBtn').dispatch('click'); h.tick(500);
  assert.deepEqual(h.calls.map(c => c.utterance.text), ['left opening', 'left opening']);
  assert.equal(h.overlaps, 0);
});

test('a stale caption request cannot interrupt the current caption', () => {
  const h = setup();
  h.run('loadChapter(0); updateCaption(4,true);'); h.tick(500);
  h.run('speakCaption(0)'); h.tick(500);
  assert.deepEqual(h.calls.map(c => c.utterance.text), ['left opening', 'left second']);
});

test('a stuck speech engine times out without starting overlapping audio or polling forever', () => {
  const h = setup({ cancelDelay: Infinity });
  h.run('loadChapter(0); loadChapter(1);'); h.tick(3000);
  assert.equal(h.calls.length, 1);
  assert.equal(h.timers.size, 0);
});

test('paused chapters and unavailable 3D do not start narration', () => {
  const h = setup();
  h.run('loadChapter(0,{autoplay:false}); threeOK=false; loadChapter(1);'); h.tick(500);
  assert.equal(h.calls.length, 0);
});

// Speech engines disagree about what utterance.rate means: Windows voices compress it,
// Android multiplies by it, and Apple's engine reaches its top speed at 2. A crowded
// scene opener has to sound equally calm everywhere.
const CROWDED = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty';
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `expected ${expected}, got ${actual}`);
function crowdedOpener(options) {
  const h = setup(options);
  h.run(`TEXT.stop.caps[0][1]=${JSON.stringify(CROWDED)}; loadChapter(2);`);
  assert.equal(h.calls.length, 1);
  return h.calls[0].utterance;
}
const davidVoice = { name: 'Microsoft David', lang: 'en-US', localService: true, voiceURI: 'Microsoft David - English (United States)' };
const samanthaVoice = { name: 'Samantha', lang: 'en-US', localService: true, voiceURI: 'com.apple.voice.compact.en-US.Samantha' };
const googleVoice = { name: 'Google US English', lang: 'en-US', localService: false, voiceURI: 'Google US English' };

test('a crowded caption still asks Windows voices for the full rate', () => {
  const utterance = crowdedOpener({ voices: [davidVoice] });
  near(utterance.rate, 1.7);
  assert.equal(utterance.voice, davidVoice);
});

for (const [name, options] of Object.entries({
  'Safari on iPhone': { ua: UA.iphoneSafari },
  'Chrome on iPhone': { ua: UA.iphoneChrome },
  'Safari on iPad with a desktop user agent': { ua: UA.ipadDesktop, maxTouchPoints: 5 },
  'an Apple voice in any browser': { ua: UA.macChrome, voices: [samanthaVoice] }
})) {
  test(`${name} keeps the same caption close to Apple's normal pace`, () => {
    near(crowdedOpener(options).rate, 1.105);
  });
}

test('Android and network voices get a plain multiplier of about 1.25', () => {
  near(crowdedOpener({ ua: UA.androidChrome }).rate, 1.252);
  near(crowdedOpener({ voices: [googleVoice] }).rate, 1.252);
});

test('captions that already fit are never sped up on any engine', () => {
  const h = setup({ ua: UA.iphoneSafari });
  h.run('loadChapter(0)');
  near(h.calls[0].utterance.rate, 0.9);
});
