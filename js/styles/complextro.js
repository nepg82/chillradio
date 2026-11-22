// complextro.js — busy, glitchy, constantly changing electro house. See PRIMER.md for the style schema.
//
// The fast-moving part is plain data made at plan time in radio.decorate and read by the sequencer:
//   phrase.active        which roles play
//   phrase.pat[role]     pattern override for that phrase (fresh drums, bass, stabs and stutter hits every phrase)
//   phrase.mod[role]     { v: voice index per step (null = the role's chosen voice), o: octave shift per step,
//                          m: on/off mask per step } — sounds change every few beats and roles trade places
// Main is a series of 8-bar "passes" (Bass / Lead / Chaos / Glitch themes, never the same twice in a row);
// within a pass each phrase re-rolls who plays, and the last phrase is a fill. The wobble bass is one cutoff
// curve per bar on a shared filter (kind 'wobble'). No per-note filters or LFOs (graph rules, PRIMER §5).
const c = (r, t) => ({ r, t });
const osc = (type, gain = 1, detune = 0, mult = 1) => ({ type, gain, detune, mult });
const G = { drums: ['kick', 'hat'], sub: ['sub'], snare: ['snare'], stabs: ['stabs'], wob: ['wob'], fx: ['chop', 'blip'], leads: ['lead1', 'lead2'] };

// ---- pattern libraries (16 steps = one bar; two are joined into a 32-step phrase) ----------------------------------
const KICKS = ['x...x...x...x...', 'x...x...x...x...', 'x...x...x...x.x.', 'x...x...x..xx...', 'x...x.......x...']; // four on the floor, mostly
const CLAPS = ['....x.......x...', '....x.......x...', '....x.......x.x.', '....x.......x..x', '....x...x...x...'];
const HATS = ['..x...x...x...x.', '..x...x...x...x.', 'x.x.x.x.x.x.x.x.', 'xxxxxxxxxxxxxxxx', '..o...o...o...o.', '.x.xx.x..x.xx.x.', 'g.x.g.x.g.x.g.xo'];
const STABS = ['1..1..1.1..1..1.', '2.....2.2.....2.', '1.1.1.1.1.1.1.1.', '..1...1...1...1.', '1.1..1.1.1..1.1.', '1...1...1...11..'];
const ONSETS = [[0, 6, 8, 14], [0, 3, 6, 8, 11, 14], [0, 4, 8, 12], [0, 2, 4, 6, 8, 10, 12, 14], [0, 3, 8, 11], [0, 6, 10], [0, 1, 3, 6, 8, 9, 11, 14]];
const NOTES = 'rrrrrrbbf55jo'; // r root, b third, f fourth, 5 fifth, j seventh, o octave (weighted toward the root)
const STEPS = 32;

function patterns(R, fill) {
  const two = list => R.pick(list) + R.pick(list);
  const bassBar = () => { const on = R.pick(ONSETS); return Array.from({ length: 16 }, (_, s) => (on.includes(s) ? (s ? R.pick(NOTES) : 'r') : '.')).join(''); };
  const chopBar = (d, fillBar) => Array.from({ length: 16 }, (_, s) => (fillBar && s >= 10 ? '223344'[s - 10] : R.chance(d) ? R.pick('1122234') : '.')).join('');
  const wob = bassBar() + bassBar();
  return {
    kick: two(KICKS),
    snare: fill ? R.pick(CLAPS) + '....x.......xxxx' : two(CLAPS), // the fill is a 16th-note clap roll on the last beat
    hat: fill ? R.pick(HATS) + 'xxxxxxxxxxxxxxxx' : two(HATS),
    wob,
    sub: wob.replace(/[^.]/g, 'r'), // the sub follows the wobble bass's rhythm on the root
    stabs: two(STABS),
    chop: chopBar(0.2, false) + chopBar(0.25, fill),
    blip: R.pick(['~wander', '~wander2', '~scatter2']),
  };
}

// Per-step voice and octave changes: chunks of 2, 4 or 8 steps each get a random voice (or the role's own) and
// sometimes an octave jump.
function morph(role, R, octaves) {
  const v = new Array(STEPS).fill(null), o = new Array(STEPS).fill(0);
  for (let s = 0; s < STEPS;) {
    const n = Math.min(R.pick([4, 4, 8, 2, 8]), STEPS - s);
    const vi = R.chance(0.25) ? null : R.int(0, role.voices.length - 1);
    const oct = octaves && R.chance(0.3) ? R.pick([-12, 12]) : 0;
    for (let k = 0; k < n; k++) { v[s + k] = vi; o[s + k] = oct; }
    s += n;
  }
  return { v, o };
}

// Roles trade places: per beat (or half-beat) one role owns it (60%), two (about 30%) or all (the rest).
function trade(ids, R) {
  const m = Object.fromEntries(ids.map(id => [id, new Array(STEPS).fill(false)]));
  const unit = R.pick([4, 4, 2]);
  for (let s = 0; s < STEPS; s += unit) {
    const k = R.chance(0.6) ? 1 : R.chance(0.7) ? 2 : ids.length;
    R.shuffle(ids).slice(0, k).forEach(id => { for (let j = s; j < s + unit; j++) m[id][j] = true; });
  }
  return m;
}

// Odds that each role plays in a phrase, per theme. Hats always play; kick and snare default to always.
const THEMES = [
  { name: 'Bass',   trade: ['stabs', 'chop', 'blip'],
    p: { sub: 0.9, wob: 0.95, stabs: 0.6, chop: 0.5, blip: 0.2, lead1: 0.1, lead2: 0.15 } },
  { name: 'Lead',   trade: ['lead1', 'lead2', 'blip', 'stabs'],
    p: { sub: 0.8, wob: 0.6, stabs: 0.3, chop: 0.3, blip: 0.5, lead1: 0.9, lead2: 0.7 } },
  { name: 'Chaos',  trade: ['stabs', 'chop', 'blip', 'lead1', 'lead2'],
    p: { sub: 0.8, wob: 0.8, stabs: 0.8, chop: 0.8, blip: 0.8, lead1: 0.8, lead2: 0.8 } },
  { name: 'Glitch', trade: ['stabs', 'chop', 'blip', 'lead2', 'wob'],
    p: { kick: 0.85, snare: 0.6, sub: 0.4, wob: 0.3, stabs: 0.7, chop: 0.95, blip: 0.8, lead1: 0.3, lead2: 0.6 } },
];

export default {
  id: 'complextro',
  name: 'Complextro',
  bpm: { min: 124, max: 140, def: 130 },
  swing: 0,

  names: {
    adj: ['Fractured', 'Glitched', 'Hyper', 'Crunch', 'Pixel', 'Frantic', 'Spliced', 'Wired', 'Overclocked', 'Jagged'],
    noun: ['Circuit', 'Collision', 'Cascade', 'Scramble', 'Overdrive', 'Feedback', 'Mashup', 'Jumpcut', 'Glitchwork', 'Rewind'],
  },

  fx: {
    reverb: { seconds: 1.4, decay: 3, hp: 250 },
    delay: { beats: 0.75, feedback: 0.3, lp: 2800 },
  },

  progressions: [ // simple harmony on purpose; the sound design does the work
    { name: 'Anthem',    scale: 'minor', chords: [c(0, 'min'), c(8, 'maj'), c(3, 'maj'), c(10, 'maj')] },  // i VI III VII
    { name: 'Dark Drive', scale: 'minor', chords: [c(0, 'min'), c(10, 'maj'), c(8, 'maj'), c(10, 'maj')] }, // i VII VI VII
    { name: 'Tense',     scale: 'minor', chords: [c(0, 'min'), c(8, 'maj'), c(5, 'min'), c(7, 'maj')] },   // i VI iv V
    { name: 'Cinematic', scale: 'minor', chords: [c(0, 'min'), c(5, 'min'), c(8, 'maj'), c(7, 'maj')] },   // i iv VI V
    { name: 'Uplift',    scale: 'major', chords: [c(0, 'maj'), c(7, 'maj'), c(9, 'min'), c(5, 'maj')] },   // I V vi IV
    { name: 'Sit',       scale: 'minor', chords: [c(0, 'min'), c(0, 'min'), c(0, 'min'), c(10, 'maj')] },  // stays on i
  ],

  roles: [
    {
      id: 'kick', label: 'Kick', part: 'drum', kind: 'kick', mix: 0,
      patterns: ['x...x...x...x...'],
      voices: [
        { name: 'Punch Kick', p: { f0: 180, f1: 45, sweep: 0.08, decay: 0.4, gain: 0.75, click: 0.15 } },
        { name: 'Thump', p: { f0: 150, f1: 42, sweep: 0.1, decay: 0.5, gain: 0.8, lp: 900, click: 0.05 } },
      ],
    },
    {
      id: 'snare', label: 'Clap', part: 'drum', kind: 'snare', mix: 0, send: { rev: 0.25 },
      patterns: ['....x.......x...'],
      voices: [
        { name: 'Big Clap', p: { clap: true, noiseFreq: 1500, q: 0.9, decay: 0.2, gain: 0.3, tone: 190, toneDecay: 0.08, toneGain: 0.1 } },
        { name: 'Snap', p: { noiseFreq: 2200, q: 0.8, decay: 0.13, gain: 0.3, tone: 220, toneDecay: 0.07, toneGain: 0.12 } },
      ],
    },
    {
      id: 'hat', label: 'Hats', part: 'drum', kind: 'hat', mix: 0,
      patterns: ['..x...x...x...x.'],
      voices: [
        { name: 'Tight Hats', p: { freq: 7500, decay: 0.04, openDecay: 0.12, gain: 0.13 } },
        { name: 'Sizzle', p: { freq: 6500, decay: 0.06, openDecay: 0.2, gain: 0.12 } },
      ],
    },
    {
      id: 'sub', label: 'Sub', part: 'bass', kind: 'synth', mix: -4, lo: 28, maxHold: 6,
      patterns: ['r.....r.r.......'],
      voices: [{ name: 'Sine Sub', p: { osc: [osc('sine')], filter: { freq: 300 }, amp: { a: 0.01, d: 0.2, s: 0.9, r: 0.08 }, gain: 0.45 } }],
    },
    {
      id: 'wob', label: 'Wobble Bass', part: 'wobble', kind: 'wobble', mix: -3, drive: 6, lo: 36, maxHold: 6,
      rates: [1, 2, 2, 2, 3, 4], // wobble cycles per beat, one picked per bar
      patterns: ['r.....r.r.......r.....b.5.......'],
      voices: [
        { name: 'Growl', p: { osc: [osc('sawtooth', 1, -12), osc('sawtooth', 1, 12), osc('square', 0.5)], wob: { lo: 140, hi: 2600, q: 7 }, amp: { a: 0.005, d: 0.15, s: 0.85, r: 0.05 }, gain: 0.22 } },
        { name: 'Reese', p: { osc: [osc('sawtooth', 1, -25), osc('sawtooth'), osc('sawtooth', 1, 25)], wob: { lo: 100, hi: 1800, q: 5 }, amp: { a: 0.005, d: 0.15, s: 0.85, r: 0.05 }, gain: 0.2 } },
        { name: 'Hollow', p: { osc: [osc('square', 1, -8), osc('square', 1, 8)], wob: { lo: 180, hi: 3200, q: 9 }, amp: { a: 0.005, d: 0.15, s: 0.85, r: 0.05 }, gain: 0.2 } },
      ],
    },
    {
      id: 'stabs', label: 'Stabs', part: 'comp', kind: 'synth', mix: -5, drive: 4, lo: 50, voiceLead: true, strum: 0.004,
      patterns: ['1..1..1.1..1..1.'],
      voices: [
        { name: 'Saw Stab', p: { osc: [osc('sawtooth', 1, -8), osc('sawtooth', 1, 8)], filter: { freq: 2000, q: 2, env: 2600, decay: 0.09 }, amp: { a: 0.002, d: 0.06, s: 0.3, r: 0.05 }, gain: 0.14 } },
        { name: 'Square Bite', p: { osc: [osc('square', 1, -6), osc('sawtooth', 0.6, 6, 2)], filter: { freq: 2600, q: 3, env: 2000, decay: 0.07 }, amp: { a: 0.002, d: 0.06, s: 0.3, r: 0.05 }, gain: 0.12 } },
        { name: 'Pluck', p: { osc: [osc('sawtooth')], filter: { freq: 1000, q: 4, env: 3500, decay: 0.12 }, amp: { a: 0.001, d: 0.1, s: 0.1, r: 0.06 }, gain: 0.18 } },
        { name: 'Hollow Tri', p: { osc: [osc('triangle', 1, -8), osc('square', 0.5, 8)], filter: { freq: 2400, q: 1 }, amp: { a: 0.002, d: 0.12, s: 0.4, r: 0.08 }, gain: 0.16 } },
      ],
    },
    {
      id: 'chop', label: 'Stutter', part: 'chop', kind: 'synth', mix: -6, lo: 62, walk: 0.4, send: { rev: 0.15 },
      patterns: ['..2.......3.4...'],
      voices: [
        { name: 'Zap', p: { osc: [osc('square')], glide: { from: 3, time: 0.05 }, filter: { freq: 3000, q: 2 }, amp: { a: 0.001, d: 0.05, s: 0.4, r: 0.03 }, gain: 0.12 } },
        { name: 'Bleep', p: { osc: [osc('square', 1, 0, 2)], filter: { freq: 4000 }, amp: { a: 0.001, d: 0.04, s: 0.5, r: 0.02 }, gain: 0.1 } },
        { name: 'Chirp', p: { osc: [osc('sawtooth')], glide: { from: 0.5, time: 0.03 }, filter: { freq: 3500, q: 3 }, amp: { a: 0.001, d: 0.05, s: 0.4, r: 0.03 }, gain: 0.12 } },
        { name: 'Bite', p: { osc: [osc('sawtooth', 1, -10), osc('square', 0.7, 10)], filter: { freq: 2500, q: 4, env: 2000, decay: 0.05 }, amp: { a: 0.001, d: 0.05, s: 0.4, r: 0.03 }, gain: 0.12 } },
      ],
    },
    {
      id: 'lead1', label: 'Lead 1', part: 'melody', kind: 'synth', mix: -4, drive: 7, send: { rev: 0.3, dly: 0.25 },
      range: [64, 84],
      rhythm: { notes: [3, 6], fine: 0.5, rest: 0.25, maxLen: 4, hook: 0 },
      voices: [
        { name: 'Overdriven Saw', p: { osc: [osc('sawtooth', 1, -9), osc('sawtooth', 1, 9)], filter: { freq: 2800, q: 1.2 }, amp: { a: 0.006, d: 0.25, s: 0.55, r: 0.12 }, gain: 0.1 } },
        { name: 'Screamer', p: { osc: [osc('sawtooth'), osc('square', 0.6, 0, 2)], filter: { freq: 3400, q: 2 }, amp: { a: 0.004, d: 0.2, s: 0.6, r: 0.1 }, gain: 0.09 } },
        { name: 'Gritty Pulse', p: { osc: [osc('square', 1, -6), osc('square', 1, 6)], filter: { freq: 2400, q: 1 }, amp: { a: 0.005, d: 0.3, s: 0.5, r: 0.12 }, gain: 0.1 } },
        { name: 'Laser', p: { osc: [osc('sawtooth', 1, -9), osc('sawtooth', 1, 9)], glide: { from: 2, time: 0.04 }, filter: { freq: 3000, q: 1.5 }, amp: { a: 0.004, d: 0.2, s: 0.5, r: 0.1 }, gain: 0.1 } },
      ],
    },
    {
      id: 'lead2', label: 'Lead 2', part: 'melody', kind: 'synth', mix: -5, drive: 3, send: { rev: 0.25, dly: 0.35 },
      range: [52, 72],
      rhythm: { notes: [2, 5], fine: 0.6, rest: 0.3, maxLen: 3, hook: 0 },
      voices: [
        { name: 'Square Lead', p: { osc: [osc('square', 1, -4), osc('square', 1, 4)], filter: { freq: 3000, q: 1 }, amp: { a: 0.004, d: 0.2, s: 0.5, r: 0.1 }, gain: 0.1 } },
        { name: 'Bell', p: { osc: [osc('sine'), osc('sine', 0.4, 0, 2.76)], filter: { freq: 5000 }, amp: { a: 0.002, d: 0.4, s: 0.1, r: 0.3 }, gain: 0.2 } },
        { name: 'Thin Saw', p: { osc: [osc('sawtooth')], filter: { freq: 2000, q: 2 }, amp: { a: 0.004, d: 0.2, s: 0.5, r: 0.1 }, gain: 0.12 } },
        { name: 'Octave Pulse', p: { osc: [osc('square'), osc('square', 0.6, 0, 2)], filter: { freq: 3500, q: 1 }, amp: { a: 0.004, d: 0.15, s: 0.5, r: 0.08 }, gain: 0.09 } },
      ],
    },
    {
      id: 'blip', label: 'Blips', part: 'arp', kind: 'synth', mix: -7, lo: 72, noteLen: 0.8, accent: true, send: { dly: 0.3 },
      patterns: ['~wander', '~wander2', '~scatter2'],
      voices: [
        { name: 'Bleep', p: { osc: [osc('square')], filter: { freq: 4500, q: 1 }, amp: { a: 0.002, d: 0.06, s: 0.4, r: 0.04 }, gain: 0.1 } },
        { name: 'Pulse', p: { osc: [osc('square', 1, -7), osc('square', 1, 7)], filter: { freq: 4000, q: 1 }, amp: { a: 0.002, d: 0.06, s: 0.4, r: 0.04 }, gain: 0.08 } },
        { name: 'Chiptri', p: { osc: [osc('triangle')], filter: { freq: 5000 }, amp: { a: 0.002, d: 0.08, s: 0.4, r: 0.05 }, gain: 0.2 } },
      ],
    },
  ],

  radio: {
    groups: [G.drums, G.sub, G.snare, G.stabs, G.wob, G.fx, G.leads],
    openers: [G.drums, G.stabs],
    dropout: 0,
    decorate(plan, { song, R }) {
      const first = plan.findIndex(p => p.section === 'Main'), end = plan.map(p => p.section).lastIndexOf('Main');
      const role = id => song.style.roles.find(r => r.id === id);
      let theme = null;
      for (let i = 0; first + i <= end; i++) {
        const p = plan[first + i], fill = i % 4 === 3;
        if (i % 4 === 0) theme = i === 0 ? THEMES[0] : R.pick(THEMES.filter(t => t !== theme));
        const on = new Set(['hat']);
        for (const [id, odds] of Object.entries({ kick: 1, snare: 1, ...theme.p })) if (R.chance(odds)) on.add(id);
        if (fill) { on.add('snare'); on.add('chop'); }
        if (!['wob', 'stabs', 'chop', 'lead1', 'lead2', 'blip'].some(id => on.has(id))) on.add('stabs');
        p.section = theme.name;
        p.active = on;
        p.pat = patterns(R, fill);
        p.mod = {};
        for (const id of ['wob', 'stabs', 'chop', 'lead1', 'lead2', 'blip']) if (on.has(id)) p.mod[id] = morph(role(id), R, id !== 'wob');
        const tr = theme.trade.filter(id => on.has(id));
        if (tr.length > 1) { const m = trade(tr, R); for (const id of tr) p.mod[id] = { ...p.mod[id], m: m[id] }; }
      }
      // Chords: every pass starts on chord 0; the intro ends on the chord before it; the outro carries on.
      let prev = 0;
      plan.forEach((p, i) => {
        p.chord = i < first ? (((i - first) % 4) + 4) % 4 : i <= end ? (i - first) % 4 : (prev + 1) % 4;
        prev = p.chord;
      });
    },
  },
};
