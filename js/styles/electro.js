// electro.js — heavy electro house / brostep-flavoured. See PRIMER.md for the style schema.
// One low bass hit (an eighth note) on beat 1, then staccato sixteenth saws on the chord root for the rest
// of the bar. Kick on 1 and 3, clap on 2 and 4, eighth-note hats, overdriven melodic lead, saw pads.
//
// Form: radio.decorate replaces the Main section with a fixed 28-bar cycle that repeats —
//   Riff 8 bars · Variation 8 · Melody 8 · Breakdown (pads + hats) 4 — by choosing which roles play in
//   each 2-bar phrase. The Variation also overrides two patterns for its phrases (phrase.pat, read by
//   Sequencer.playStep). The cycle always starts on chord 0 of the progression.
const c = (r, t) => ({ r, t });
const osc = (type, gain = 1, detune = 0, mult = 1) => ({ type, gain, detune, mult });
const G = { pad: ['pad'], drums: ['kick', 'hat'], hit: ['hit'], stabs: ['stabs'], snare: ['snare'], lead: ['lead'] };
const padAmp = { a: 0.12, d: 0.1, s: 1, r: 0.6 };

const BASE = ['kick', 'snare', 'hat', 'hit', 'pad'];
const FORM = [ // n = phrases of 2 bars
  { name: 'Riff',      n: 4, roles: [...BASE, 'stabs'] },
  { name: 'Variation', n: 4, roles: [...BASE, 'stabs'], pat: { stabs: '.rrrorrr.rrrorrr', hat: 'x.x.x.x.x.x.x.o.' } },
  { name: 'Melody',    n: 4, roles: [...BASE, 'lead'] },
  { name: 'Breakdown', n: 2, roles: ['hat', 'pad'] },
];
const CYCLE = FORM.reduce((a, f) => a + f.n, 0); // 14 phrases = 28 bars

export default {
  id: 'electro',
  name: 'Electro',
  bpm: { min: 120, max: 140, def: 128 },
  swing: 0,

  names: {
    adj: ['Chrome', 'Toxic', 'Voltage', 'Rogue', 'Atomic', 'Turbo', 'Laser', 'Savage', 'Rapid', 'Brutal'],
    noun: ['Riot', 'Circuit', 'Strike', 'Overload', 'Assault', 'Fury', 'Breaker', 'Rampage', 'Meltdown', 'Blitz'],
  },

  fx: {
    reverb: { seconds: 1.8, decay: 3, hp: 200 },
    delay: { beats: 0.75, feedback: 0.3, lp: 2400 },
  },

  progressions: [
    { name: 'Voltage',  scale: 'minor',    chords: [c(0, 'min'), c(8, 'maj'), c(10, 'maj'), c(7, 'min')] },  // i bVI bVII v
    { name: 'Overload', scale: 'phrygian', chords: [c(0, 'min'), c(1, 'maj'), c(0, 'min'), c(10, 'maj')] },  // i bII i bVII
    { name: 'Circuit',  scale: 'minor',    chords: [c(0, 'min'), c(3, 'maj'), c(8, 'maj'), c(10, 'maj')] },  // i bIII bVI bVII
    { name: 'Rampage',  scale: 'minor',    chords: [c(0, 'min'), c(0, 'min'), c(8, 'maj'), c(10, 'maj')] },  // i i bVI bVII
  ],

  roles: [
    {
      id: 'kick', label: 'Kick', part: 'drum', kind: 'kick', mix: 0,
      patterns: ['x.......x.......'], // beats 1 and 3
      voices: [{ name: 'Punch Kick', p: { f0: 180, f1: 45, sweep: 0.08, decay: 0.42, gain: 0.75, click: 0.15 } }],
    },
    {
      id: 'snare', label: 'Clap', part: 'drum', kind: 'snare', mix: 0, send: { rev: 0.25 },
      patterns: ['....x.......x...'], // beats 2 and 4
      voices: [{ name: 'Big Clap', p: { clap: true, noiseFreq: 1500, q: 0.9, decay: 0.2, gain: 0.3, tone: 190, toneDecay: 0.08, toneGain: 0.1 } }],
    },
    {
      id: 'hat', label: 'Hats', part: 'drum', kind: 'hat', mix: 0,
      patterns: ['x.x.x.x.x.x.x.x.', 'x.g.x.g.x.g.x.g.'], // eighth notes
      voices: [{ name: 'Tight Hats', p: { freq: 7500, decay: 0.04, openDecay: 0.12, gain: 0.13 } }],
    },
    {
      id: 'hit', label: 'Bass Hit', part: 'bass', kind: 'synth', mix: -2, drive: 6, maxHold: 2, // an eighth note on beat 1
      patterns: ['r...............'],
      voices: [{ name: 'Heavy Hit', p: {
        osc: [osc('sawtooth', 1, -8), osc('sawtooth', 1, 8), osc('square', 0.7, 0, 0.5)],
        filter: { freq: 700, q: 2, env: 1800, decay: 0.15 },
        amp: { a: 0.003, d: 0.25, s: 0.8, r: 0.06 }, gain: 0.24 } }],
    },
    {
      id: 'stabs', label: 'Saw Stabs', part: 'bass', kind: 'synth', mix: -5, drive: 5, lo: 40, accent: true, // an octave above the hit
      patterns: ['.rrrrrrrrrrrrrrr'], // sixteenths on the root, the rest of the bar
      voices: [{ name: 'Buzz Saw', p: {
        osc: [osc('sawtooth', 1, -7), osc('sawtooth', 1, 7)],
        filter: { freq: 1200, q: 3, env: 2400, decay: 0.08 },
        amp: { a: 0.002, d: 0.05, s: 0.3, r: 0.03 }, gain: 0.2 } }],
    },
    {
      id: 'pad', label: 'Pad', part: 'chord', kind: 'synth', mix: -6, lo: 52, send: { rev: 0.35 },
      voices: [
        { name: 'Supersaw',  p: { osc: [osc('sawtooth', 1, -14), osc('sawtooth', 1, 0), osc('sawtooth', 1, 14)], filter: { freq: 1800 }, amp: padAmp, gain: 0.044 } },
        { name: 'Glass Tri', p: { osc: [osc('triangle')], filter: { freq: 1800 }, amp: padAmp, gain: 0.2 } },
      ],
    },
    {
      id: 'lead', label: 'Lead', part: 'melody', kind: 'synth', mix: -4, drive: 7, send: { rev: 0.3, dly: 0.25 },
      range: [64, 84],
      rhythm: { notes: [3, 6], fine: 0.55, rest: 0.25, maxLen: 4, hook: 0 }, // busy, driving, few rests
      voices: [
        { name: 'Overdriven Saw', p: { osc: [osc('sawtooth', 1, -9), osc('sawtooth', 1, 9)], filter: { freq: 2800, q: 1.2 }, amp: { a: 0.006, d: 0.25, s: 0.55, r: 0.12 }, gain: 0.1 } },
        { name: 'Screamer',       p: { osc: [osc('sawtooth', 1, 0), osc('square', 0.6, 0, 2)],  filter: { freq: 3400, q: 2 },   amp: { a: 0.004, d: 0.2,  s: 0.6,  r: 0.1  }, gain: 0.09 } },
        { name: 'Gritty Pulse',   p: { osc: [osc('square', 1, -6), osc('square', 1, 6)],         filter: { freq: 2400, q: 1 },   amp: { a: 0.005, d: 0.3,  s: 0.5,  r: 0.12 }, gain: 0.1 } },
      ],
    },
  ],

  radio: {
    groups: [G.pad, G.drums, G.hit, G.stabs, G.snare, G.lead],
    openers: [G.pad, G.drums],
    dropout: 0,
    decorate(plan) {
      const first = plan.findIndex(p => p.section === 'Main');
      const old = plan.filter(p => p.section === 'Main').length;
      const cycles = Math.max(2, Math.round(old / CYCLE)); // keep the song at roughly the usual 3–4 minutes
      const main = [];
      for (let k = 0; k < cycles; k++) for (const f of FORM) for (let i = 0; i < f.n; i++) main.push({ section: f.name, active: new Set(f.roles), pat: f.pat });
      plan.splice(first, old, ...main);
      // Chords: each cycle restarts on chord 0; the intro ends on the chord before it; the outro carries on.
      let prev = 0;
      plan.forEach((p, i) => {
        if (i < first) p.chord = (((i - first) % 4) + 4) % 4;
        else if (i < first + main.length) p.chord = ((i - first) % CYCLE) % 4;
        else p.chord = (prev + 1) % 4;
        prev = p.chord;
      });
    },
  },
};
