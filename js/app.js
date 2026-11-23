// app.js — UI + glue. Holds app state; the engine does the audio.
import { STYLES } from './styles/index.js';
import { AudioEngine, MIN_DB } from './engine/audio.js';
import { Sequencer } from './engine/sequencer.js';
import { makeSong } from './engine/song.js';
import { planRadio } from './engine/radio.js';
import { KEY_NAMES } from './engine/music.js';
import { initMediaSession } from './mediasession.js';

const $ = s => document.querySelector(s);
const STEP_DB = 3, MAX_DB = 12, OFF_DB = MIN_DB - STEP_DB;
const fmtDb = db => (db < MIN_DB ? 'Off' : `${db > 0 ? '+' : ''}${db} dB`);

// ---- State ------------------------------------------------------------------
const saved = (() => { try { return JSON.parse(localStorage.getItem('chillradio')) || {}; } catch { return {}; } })();
const state = {
  mode: saved.mode || 'manual',
  styleId: saved.styleId || STYLES[0].id,
  allStyles: !!saved.allStyles,
  radioOff: Array.isArray(saved.radioOff) ? saved.radioOff : [], // style ids left out of Radio's hop (a blacklist, so new styles join by default)
  reverb: saved.reverb !== false,
  levels: saved.levels || {},          // { styleId: { roleId: dB } }
  userSwing: saved.userSwing ?? null,   // fraction of a 16th; null = style default
  userBpm: saved.userBpm || null,      // set once the user touches BPM
  bpm: 0, key: Math.floor(Math.random() * 12), prog: 0, voices: {},
  song: null, playing: false, paused: false, yielded: false,
};
const save = () => {
  const { mode, styleId, allStyles, radioOff, levels, userBpm, userSwing, reverb } = state;
  try { localStorage.setItem('chillradio', JSON.stringify({ mode, styleId, allStyles, radioOff, levels, userBpm, userSwing, reverb })); } catch {}
};

const style = () => STYLES.find(s => s.id === state.styleId) || STYLES[0];
const levelsFor = st => (state.levels[st.id] ||= Object.fromEntries(st.roles.map(r => [r.id, r.mix])));

// Event log that survives the page being killed. Tap the build stamp to view it.
const LOG_KEY = 'chillradio-log';
let LOG = [];
try { LOG = JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch {}
function log(msg) {
  LOG.push(new Date().toLocaleString('sv-SE').slice(5) + ' ' + msg);
  if (LOG.length > 1500) LOG.splice(0, LOG.length - 1500);
  try { localStorage.setItem(LOG_KEY, JSON.stringify(LOG)); } catch {}
}

// Liveness record: if the page is killed mid-play, the next boot says so in the log.
const ALIVE_KEY = 'chillradio-alive';
const alive = why => { try { localStorage.setItem(ALIVE_KEY, JSON.stringify({ t: Date.now(), p: state.playing && !state.paused, w: why })); } catch {} };
try {
  const pv = JSON.parse(localStorage.getItem(ALIVE_KEY) || 'null');
  if (pv && pv.p) log(`PREV SESSION ENDED WHILE PLAYING. last alive ${new Date(pv.t).toLocaleString('sv-SE').slice(5)} (${pv.w}) discarded=${document.wasDiscarded}`);
} catch {}
alive('boot');
log(`boot, build ${$('#ver').textContent}`);

// Per-session song counter, stored separately so the capped log can't push it out.
const STATS_KEY = 'chillradio-stats';
let stats = { start: 0, songs: 0, last: 0, ended: null };
try { stats = JSON.parse(localStorage.getItem(STATS_KEY)) || stats; } catch {}
const saveStats = () => { try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch {} };
const fmtDur = ms => `${Math.floor(ms / 3600000)}h ${Math.floor(ms / 60000) % 60}m`;

const engine = new AudioEngine();

// Audio-clock lag vs wall clock (ms): grows if the audio thread stalls. Reset whenever the clock restarts.
let clk = { c: 0, p: 0 };
const resetClock = () => { if (engine.ctx) clk = { c: engine.ctx.currentTime, p: performance.now() }; };
// Browser underrun counters, where Brave/Chrome expose them (AudioContext.playoutStats).
const playout = () => {
  try {
    const s = engine.ctx && engine.ctx.playoutStats;
    return s ? ` fb=${s.fallbackFramesEvents}/${Math.round(s.fallbackFramesDuration)}ms lat=${Math.round(s.averageLatency)}-${Math.round(s.maximumLatency)}ms` : ' po=n/a';
  } catch { return ' po=err'; }
};

let lastAlive = 0, lastBeat = 0, lastErr = 0;
const seq = new Sequencer(engine, {
  onPhrase, onEnd,
  onResync: (ms, phrase) => log(`RESYNC ${ms} ms behind at phrase ${phrase}`),
  onError: (e, step) => { // throttled: a persistent fault must not flood the log
    const n = Date.now();
    if (n - lastErr > 5000) { lastErr = n; log(`ERR step ${step}: ${e && e.message}`); }
  },
  onTick: () => {
    const n = Date.now();
    if (n - lastAlive > 30000) { lastAlive = n; alive('tick'); }
    if (n - lastBeat > 120000) { // heartbeat every 2 min
      lastBeat = n;
      const c = engine.ctx, mem = performance.memory ? ` mem=${Math.round(performance.memory.usedJSHeapSize / 1048576)}MB` : '';
      const lag = c && c.state === 'running' ? Math.round((performance.now() - clk.p) - (c.currentTime - clk.c) * 1000) + 'ms' : 'n/a';
      log(`hb ctx=${c ? c.state : '-'} ct=${c ? Math.round(c.currentTime) : 0} vis=${document.visibilityState} lag=${lag} notes=${engine.notes}/${engine.songNotes}${playout()}${mem}`);
    }
  },
});

let gapTimer, yieldTimer;
const YIELD_GRACE_MS = 45000;
const session = initMediaSession({
  onLog: log,
  onPlay: () => {
    log('media session: play');
    if (state.yielded) { session.start(); unyieldAudio(); return; }
    return state.paused ? resume() : !state.playing && play();
  },
  onPause: () => { log('media session: pause'); pause(); },
  onStop: stop,
  onNext: nextSong,
  onYield: yieldAudio,
  onFocusBack: unyieldAudio,
});

// ---- Playback ---------------------------------------------------------------
async function play() {
  stats = { start: Date.now(), songs: 0, last: 0, ended: null };
  saveStats();
  log(`session start, build ${$('#ver').textContent}`);
  alive('play');
  engine.reverbOn = state.reverb;
  state.yielded = false; clearTimeout(yieldTimer);
  seq.open();
  session.start(); // must run synchronously inside the tap
  await engine.start();
  const ctx = engine.ctx;
  
  ctx.onstatechange = () => {
    log(`ctx ${ctx.state}`);
    if (ctx.state === 'running') resetClock();
    // If the system suspends us while we should be playing, try to resume.
    if (ctx === engine.ctx && ctx.state !== 'running' && ctx.state !== 'closed' && state.playing && !state.paused) {
      ctx.resume().catch(() => {});
    }
  };
  
  resetClock();
  engine.setStyle(style(), levelsFor(style()));
  state.playing = true; state.paused = false;
  lastHop = null; // a new Radio session may start on any style in the rotation
  state.mode === 'radio' ? nextRadio() : startManual();
  renderTransport();
}

function stop() {
  if (state.playing) {
    stats.ended = Date.now();
    saveStats();
    log(`session stopped: ${stats.songs} songs in ${fmtDur(stats.ended - stats.start)}`);
  }
  state.yielded = false; clearTimeout(yieldTimer);
  clearTimeout(gapTimer);
  seq.close(); engine.stop(); session.stop();
  state.playing = false; state.paused = false;
  alive('stop');
  renderTransport();
}

// Lock screen / Bluetooth pause: freeze the audio clock so resume continues mid-phrase.
function pause() {
  if (!state.playing || state.paused || !engine.ctx) return;
  state.paused = true; alive('pause');
  clearTimeout(yieldTimer); state.yielded = false;
  engine.ctx.suspend();
  session.pause();
  renderTransport();
}

async function resume() {
  if (!state.paused || !engine.ctx) return;
  state.paused = false; alive('resume');
  engine.setMuted(false);
  session.start();
  await engine.ctx.resume();
  resetClock();
  renderTransport();
}

// Another app (call, video, etc.) took audio focus: go silent, and give up if it doesn't come back.
function yieldAudio() {
  if (!state.playing || state.paused || state.yielded) return;
  state.yielded = true;
  engine.setMuted(true);
  log('yield: another app took audio focus');
  clearTimeout(yieldTimer);
  yieldTimer = setTimeout(() => {
    if (state.yielded) { log('yield timeout: stopping'); stop(); }
  }, YIELD_GRACE_MS);
}

function unyieldAudio() {
  if (!state.yielded) return;
  state.yielded = false;
  clearTimeout(yieldTimer);
  engine.setMuted(false);
  log('unyield: audio focus back');
}

// Radio "Next song": finish the phrase, then end like a natural song end.
function nextSong() {
  if (!state.playing || state.mode !== 'radio') return;
  if (state.paused) resume();
  if (seq.endAfterPhrase()) {
    $('#section').textContent = 'Ending song…';
  } else { // already in the tail or the gap between songs: just move on
    clearTimeout(gapTimer);
    seq.stop();
    nextRadio();
  }
}

const restart = async () => { if (state.playing) { stop(); await play(); } };

function manualOpts(keep) {
  const st = style();
  return { key: state.key, bpm: state.bpm, progression: st.progressions[state.prog], voices: state.voices, keep };
}

function startManual() {
  const st = style();
  const song = makeSong(st, manualOpts());
  adopt(song);
  const all = new Set(st.roles.map(r => r.id));
  seq.start(song, i => ({ chord: i, active: all, section: 'Jam' }));
}

// Radio's style hop: pick from the ticked styles (state.radioOff lists the unticked ones), never the same style twice
// in a row unless it is the only one left. Nothing ticked = every style. Takes effect at the next song.
let lastHop = null;
function pickHop() {
  let pool = STYLES.filter(s => !state.radioOff.includes(s.id));
  if (!pool.length) pool = STYLES;
  const fresh = pool.filter(s => s.id !== lastHop);
  const from = fresh.length ? fresh : pool;
  return (lastHop = from[Math.floor(Math.random() * from.length)].id);
}

function nextRadio(startAt) {
  if (!state.playing) return;
  const t0 = performance.now();
  // Radio always uses each style's own tempo range and swing: a BPM/swing tweak lasts only for the song it was made in.
  state.userBpm = null; state.userSwing = null; seq.swing = null; save();
  if (state.allStyles) {
    const pick = pickHop();
    if (pick !== state.styleId) selectStyle(pick);
  }
  const { song, arranger } = planRadio(style(), null);
  adopt(song);
  seq.start(song, arranger, startAt);
  log(`song setup ${Math.round(performance.now() - t0)} ms, page ${document.visibilityState}`);
}

function onEnd(startAt) {
  // positive = the handoff ran this late (ms) past the planned start of the next song
  log(`handoff ${Math.round((engine.ctx.currentTime - startAt) * 1000)} ms after planned start`);
  if (state.playing && state.mode === 'radio') nextRadio(startAt);
  else seq.stop();
}

// Make a song the current one and mirror its choices into state/UI.
function adopt(song) {
  state.song = song;
  session.setTrack(song);
  if (state.mode === 'radio') { stats.songs++; stats.last = Date.now(); saveStats(); }
  log(`song ${state.mode === 'radio' ? '#' + stats.songs + ' ' : ''}"${song.title}" ${song.bpm} BPM (prev song notes=${engine.songNotes})`);
  state.key = song.key; state.bpm = song.bpm;
  state.prog = song.style.progressions.indexOf(song.progression);
  for (const [id, v] of Object.entries(song.voices)) state.voices[id] = v.name;
  syncControls();
}

function onPhrase(p, i) {
  const st = style();
  $('#section').textContent = `${p.section} · phrase ${i + 1}`;
  $('#active').textContent = st.roles.filter(r => p.active.has(r.id)).map(r => r.label).join(', ');
}

// ---- Controls ---------------------------------------------------------------
function selectStyle(id) {
  state.styleId = id;
  const st = style();
  state.voices = {}; state.prog = 0; state.bpm = state.userBpm || st.bpm.def;
  renderStyle();
  if (state.playing && engine.ctx) engine.setStyle(st, levelsFor(st));
  save();
}

// Key/progression change in manual mode: rebuild the song live, keeping patterns.
function rebuild() {
  if (!state.playing || state.mode !== 'manual') return;
  const song = makeSong(style(), manualOpts(state.song));
  state.song = song; seq.song = song;
}

function setBpm(bpm) {
  const st = style();
  state.bpm = state.userBpm = Math.max(st.bpm.min - 10, Math.min(st.bpm.max + 10, bpm));
  if (state.song) { state.song.bpm = state.bpm; if (engine.ctx) engine.setTempo(state.bpm); }
  $('#bpm').textContent = state.bpm;
  save();
}

function setMode(mode) {
  state.mode = mode; save();
  renderMode();
  restart();
}

// ---- Rendering --------------------------------------------------------------
function renderMode() {
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === state.mode));
  $('#all-styles-row').hidden = state.mode !== 'radio';
  renderPool();
  $('#next').hidden = state.mode !== 'radio';
  session.setRadio(state.mode === 'radio');
}

// The checklist of styles in Radio's rotation (shown in Radio mode while hopping is on).
function renderPool() {
  $('#radio-pool').hidden = state.mode !== 'radio' || !state.allStyles;
  const on = STYLES.filter(s => !state.radioOff.includes(s.id)).length;
  $('#pool-title').textContent = `Styles in rotation (${on} of ${STYLES.length})`;
  $('#pool-list').innerHTML = STYLES.map(s => `
    <label class="check"><input type="checkbox" data-id="${s.id}"${state.radioOff.includes(s.id) ? '' : ' checked'}> ${s.name}</label>`).join('');
  $('#pool-hint').hidden = on > 0;
}

function renderTransport() {
  $('#play').textContent = !state.playing ? 'Play' : state.paused ? 'Resume' : 'Stop';
  if (!state.playing) { $('#section').textContent = 'Stopped'; $('#active').textContent = ''; }
}

function renderStyle() {
  const st = style();
  $('#style').innerHTML = STYLES.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  $('#style').value = st.id;
  $('#prog').innerHTML = st.progressions.map((p, i) => `<option value="${i}">${p.name}</option>`).join('');
  $('#key').innerHTML = KEY_NAMES.map((k, i) => `<option value="${i}">${k}</option>`).join('');

  const lv = levelsFor(st);
  $('#mixer').innerHTML = st.roles.map(r => `
    <div class="row" data-role="${r.id}">
      <span class="name">${r.label}</span>
      <select class="voice" aria-label="${r.label} voice">${r.voices.map(v => `<option>${v.name}</option>`).join('')}</select>
      <div class="level">
        <button data-d="-1" aria-label="${r.label} quieter">−</button>
        <output>${fmtDb(lv[r.id])}</output>
        <button data-d="1" aria-label="${r.label} louder">+</button>
      </div>
    </div>`).join('');
  if (!state.bpm) state.bpm = state.userBpm || st.bpm.def;
  syncControls();
}

const swingPct = () => Math.round((state.userSwing ?? style().swing) * 100);
function renderSwing() {
  $('#swing').value = swingPct();
  $('#swing-out').textContent = swingPct() + '%' + (state.userSwing == null ? ' (style default)' : '');
  $('#swing-reset').hidden = state.userSwing == null;
}

function syncControls() {
  const st = style();
  renderSwing();
  $('#bpm').textContent = state.bpm;
  $('#key').value = state.key;
  $('#prog').value = state.prog;
  document.querySelectorAll('.row').forEach(row => {
    const name = state.voices[row.dataset.role];
    if (name) row.querySelector('.voice').value = name;
  });
  const song = state.song;
  $('#title').textContent = song ? song.title : 'Ready';
  $('#meta').textContent = song ? `${KEY_NAMES[song.key]} · ${song.bpm} BPM · ${song.progression.name}` : st.name;
}

// ---- Events -----------------------------------------------------------------
$('#play').onclick = () => (state.paused ? resume() : state.playing ? stop() : play());
$('#next').onclick = nextSong;
$('#style').onchange = e => { selectStyle(e.target.value); restart(); };
$('#key').onchange = e => { state.key = +e.target.value; rebuild(); };
$('#prog').onchange = e => { state.prog = +e.target.value; rebuild(); };
$('#bpm-down').onclick = () => setBpm(state.bpm - 1);
$('#bpm-up').onclick = () => setBpm(state.bpm + 1);
seq.swing = state.userSwing;
$('#swing').oninput = e => { state.userSwing = e.target.value / 100; seq.swing = state.userSwing; save(); renderSwing(); };
$('#swing-reset').onclick = () => { state.userSwing = null; seq.swing = null; save(); renderSwing(); };
$('#all-styles').onchange = e => { state.allStyles = e.target.checked; save(); renderPool(); };
$('#pool-list').addEventListener('change', e => {
  const id = e.target.dataset.id;
  if (!id) return;
  state.radioOff = e.target.checked ? state.radioOff.filter(x => x !== id) : [...new Set([...state.radioOff, id])];
  save(); renderPool();
});
$('#pool-all').onclick = () => { state.radioOff = []; save(); renderPool(); };
$('#pool-none').onclick = () => { state.radioOff = STYLES.map(s => s.id); save(); renderPool(); };
$('#reverb').onchange = e => { state.reverb = e.target.checked; engine.reverbOn = state.reverb; save(); restart(); };
document.querySelectorAll('[data-mode]').forEach(b => (b.onclick = () => setMode(b.dataset.mode)));

$('#mixer').addEventListener('change', e => {
  if (!e.target.matches('.voice')) return;
  const id = e.target.closest('.row').dataset.role, role = style().roles.find(r => r.id === id);
  state.voices[id] = e.target.value;
  if (state.song) state.song.voices[id] = role.voices.find(v => v.name === e.target.value); // live swap
});

$('#mixer').addEventListener('click', e => {
  const btn = e.target.closest('button[data-d]');
  if (!btn) return;
  const row = btn.closest('.row'), id = row.dataset.role, lv = levelsFor(style());
  lv[id] = Math.max(OFF_DB, Math.min(MAX_DB, lv[id] + btn.dataset.d * STEP_DB));
  row.querySelector('output').textContent = fmtDb(lv[id]);
  engine.setLevel(id, lv[id]);
  save();
});

// ---- Init -------------------------------------------------------------------
$('#all-styles').checked = state.allStyles;
$('#reverb').checked = state.reverb;
engine.reverbOn = state.reverb;
selectStyle(state.styleId);
renderMode();
renderTransport();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');

document.addEventListener('visibilitychange', () => {
  log(`page ${document.visibilityState}`);
  if (document.hidden || !state.playing || state.paused) return;
  if (!state.yielded) session.kick();
  if (engine.ctx && engine.ctx.state === 'suspended') engine.ctx.resume().catch(() => {});
});
document.addEventListener('freeze', () => log('page freeze'));
document.addEventListener('resume', () => log('page resume'));
window.addEventListener('pagehide', () => { log('pagehide'); alive('pagehide'); });
window.addEventListener('error', e => log(`ERR ${e.message}`));
window.addEventListener('unhandledrejection', () => log('ERR unhandled rejection'));

const showLog = () => {
  const end = stats.ended ?? (stats.last || Date.now()); // no Stop recorded: measure to the last song
  const head = stats.start
    ? `SESSION: ${stats.songs} songs · ${fmtDur(end - stats.start)}${stats.ended ? ' (stopped)' : ''} · last song ${stats.last ? new Date(stats.last).toLocaleTimeString() : '–'}\n---\n`
    : '';
  $('#dbg').textContent = head + LOG.slice(-150).reverse().join('\n');
};

$('#ver').onclick = () => {
  $('#dbg').hidden = !$('#dbg').hidden;
  if (!$('#dbg').hidden) { showLog(); navigator.clipboard?.writeText(LOG.join('\n')).catch(() => {}); }
};
setInterval(() => { if (!$('#dbg').hidden && !document.hidden) showLog(); }, 1000);