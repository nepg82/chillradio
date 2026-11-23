// electrohouse.js — Knife Party-style electro house (the "Bonfire" sound). See PRIMER.md for the style schema.
//
// The star is ONE low, distorted saw bass riff that "talks": a resonant low-pass that sweeps through vowel-like
// positions inside every bar (kind 'wobble', part 'wobble', ctl event with `pts`), a sine sub that follows the
// riff, and an octave-up saw layer. The bass bus carries a persistent pump gain that ducks on every beat like a
// sidechain from the kick (role.pump + voice p.pump). Drums stay simple and supportive: four-on-the-floor kick,
// clap on 2 and 4, off-beat open hats. No arps, no plucks, no vocals.
//
// Form: radio.decorate replaces Main with a repeating 24-bar cycle of 2-bar phrases —
//   Drop A 4 phrases (8 bars) · Drop B 4 · Breakdown 2 (pad + lead) · Build 2 (clap roll, 16th hats, zaps, last
//   beat silent) — then the next Drop A hits. Two riffs are made per song (A and B) and reused every cycle, so the
//   drop has an identity; the last phrase of each drop gets a fresh second half. Every cycle starts on chord 0.
const c = (r, t) => ({ r, t });
const osc = (type, gain = 1, detune = 0, mult = 1) => ({ type, gain, detune, mult });
const G = { drums: ['kick', 'hat'], sub: ['sub'], clap: ['snare'], bass: ['wob', 'layer'], pad: ['pad'], lead: ['lead'], fx: ['zap'] };
const padAmp = { a: 0.15, d: 0.1, s: 1, r: 0.6 };
const PUMP = { depth: 0.85, release: 0.55 };

// ---- patterns (16 steps = one bar; two are joined for the 32-step phrase) -----------------------------------------
const KICK = 'x...x...x...x...', CLAP = '....x.......x...';
const HAT_OFF = '..o...o...o...o.', HAT_B = 'x.o.x.o.x.o.x.o.', HAT_8 = 'x.x.x.x.x.x.x.x.', HAT_16 = 'xxxxxxxxxxxxxxxx';
const ONSETS = [ // syncopated bass onsets within one bar
  [0, 3, 6, 10, 12, 15], [0, 3, 6, 8, 11, 14], [0, 2, 3, 6, 8, 10, 11, 14], [0, 3, 7, 10, 12, 15],
  [0, 6, 8, 14], [0, 3, 6, 9, 12], [0, 1, 3, 6, 8, 11, 14], [0, 4, 6, 10, 14],
];
const NOTES = 'rrrrrrbf5j'; // weighted hard toward the root

const bar = (R, tail) => { // 16 chars; `tail` = true: free notes everywhere after the first hit
  const on = R.pick(ONSETS);
  return Array.from({ length: 16 }, (_, s) => (on.includes(s) ? (!s ? 'r' : R.pick(NOTES)) : '.')).join('');
};
const riff = R => { const a = bar(R); return a + (R.chance(0.5) ? a.slice(0, 8) + bar(R).slice(8) : bar(R)); };
const fresh = (r, R) => r.slice(0, 16) + r.slice(16, 24) + bar(R).slice(8); // same riff, new second half of bar 2
const roots = r => r.replace(/[^.]/g, 'r');
const two = p => p + p;

const BASE_RIFF = 'r..r..r.r.....r.r..r..r.r...b.5.';

// One plan entry. i = phrase index inside its section; n = section length.
function drop(name, rf, hats, i, n, R, zap) {
  const r = i === n - 1 ? fresh(rf, R) : rf;
  const roles = ['kick', 'snare', 'hat', 'sub', 'wob', 'layer'];
  const pat = { kick: two(KICK), snare: two(CLAP), hat: two(hats), wob: r, layer: r, sub: roots(r) };
  if (zap) { roles.push('zap'); pat.zap = '..2.......3.4...' + '....2.......3...'; }
  return { section: name, active: new Set(roles), pat };
}

function buildPhrase(i) {
  const last = i === 1;
  const roles = ['kick', 'snare', 'hat', 'zap', 'pad'];
  const pat = last
    ? { kick: two(HAT_8), snare: HAT_8 + 'xxxxxxxxxxxx....', hat: two(HAT_16), zap: '3.3.3.3.3.3.3.3.' + '4444444444444444' }
    : { kick: two(KICK), snare: '....x...x...x...' + HAT_8, hat: two(HAT_16), zap: '2...2...2...2...' + '3...3...3...3...' };
  const p = { section: 'Build', active: new Set(roles), pat };
  if (last) { // the last beat is a one-beat gap before the drop: mask every role on steps 28–31
    const m = Array.from({ length: 32 }, (_, s) => s < 28);
    p.mod = Object.fromEntries(roles.map(id => [id, { m }]));
  }
  return p;
}

const SECTIONS = [ // [name, phrases]
  ['Drop A', 4], ['Drop B', 4], ['Breakdown', 2], ['Build', 2],
];
const CYCLE = SECTIONS.reduce((a, [, n]) => a + n, 0); // 12 phrases = 24 bars

export default {
  id: 'electrohouse',
  name: 'Electro House',
  bpm: { min: 124, max: 130, def: 128 },
  swing: 0,

  names: {
    adj: ['Ember', 'Scorched', 'Molten', 'Feral', 'Savage', 'Blistering', 'Rabid', 'Smoldering', 'Ruthless', 'Cinder'],
    noun: ['Fuse', 'Furnace', 'Riot', 'Siege', 'Growl', 'Warhead', 'Inferno', 'Mayhem', 'Hellfire', 'Stampede'],
  },

  fx: {
    reverb: { seconds: 1.4, decay: 3, hp: 250 },
    delay: { beats: 0.75, feedback: 0.3, lp: 2600 },
  },

  progressions: [ // simple and dark, with long stays on i so the riff owns the drop
    { name: 'Kindle',  scale: 'minor', chords: [c(0, 'min'), c(0, 'min'), c(8, 'maj'), c(10, 'maj')] },  // i i VI VII
    { name: 'Slag',    scale: 'minor', chords: [c(0, 'min'), c(0, 'min'), c(0, 'min'), c(10, 'maj')] },  // i i i VII
    { name: 'Pyre',    scale: 'minor', chords: [c(0, 'min'), c(10, 'maj'), c(8, 'maj'), c(10, 'maj')] }, // i VII VI VII
    { name: 'Ignite',  scale: 'minor', chords: [c(0, 'min'), c(8, 'maj'), c(3, 'maj'), c(10, 'maj')] },  // i VI III VII
    { name: 'Scorch',  scale: 'phrygian', chords: [c(0, 'min'), c(1, 'maj'), c(0, 'min'), c(10, 'maj')] }, // i bII i VII
  ],

  roles: [
    {
      id: 'kick', label: 'Kick', part: 'drum', kind: 'kick', mix: 0,
      patterns: [two(KICK)],
      voices: [
        { name: 'Punch Kick', p: { f0: 180, f1: 45, sweep: 0.08, decay: 0.4, gain: 0.78, click: 0.15 } },
        { name: 'Thump', p: { f0: 150, f1: 42, sweep: 0.1, decay: 0.48, gain: 0.82, lp: 900, click: 0.05 } },
      ],
    },
    {
      id: 'snare', label: 'Clap', part: 'drum', kind: 'snare', mix: 0, send: { rev: 0.22 },
      patterns: [two(CLAP)],
      voices: [{ name: 'Big Clap', p: { clap: true, noiseFreq: 1500, q: 0.9, decay: 0.2, gain: 0.3, tone: 190, toneDecay: 0.08, toneGain: 0.1 } }],
    },
    {
      id: 'hat', label: 'Hats', part: 'drum', kind: 'hat', mix: -1,
      patterns: [two(HAT_OFF)],
      voices: [
        { name: 'Open Offbeat', p: { freq: 7000, decay: 0.04, openDecay: 0.14, gain: 0.13 } },
        { name: 'Sizzle', p: { freq: 6500, decay: 0.06, openDecay: 0.2, gain: 0.12 } },
      ],
    },
    {
      id: 'sub', label: 'Sub', part: 'wobble', kind: 'wobble', mix: -4, lo: 28, maxHold: 4, pump: true,
      rates: [0], // no filter motion: hold the cutoff low
      patterns: [roots(BASE_RIFF)],
      voices: [{ name: 'Sine Sub', p: { osc: [osc('sine')], wob: { lo: 150, hi: 250, q: 0.7 }, pump: PUMP, amp: { a: 0.008, d: 0.2, s: 0.95, r: 0.06 }, gain: 0.46 } }],
    },
    {
      id: 'wob', label: 'Talking Bass', part: 'wobble', kind: 'wobble', mix: -2, drive: 7, lo: 36, maxHold: 4, pump: true,
      rates: [1, 2, 2, 4], talk: { chance: 0.75, points: 8 }, // 75% of bars talk (vowel sweeps), the rest wobble
      patterns: [BASE_RIFF],
      voices: [
        { name: 'Talker', p: { osc: [osc('sawtooth', 1, -12), osc('sawtooth', 1, 12), osc('square', 0.5, 0, 0.5)], wob: { lo: 120, hi: 2400, q: 9 }, pump: PUMP, amp: { a: 0.004, d: 0.15, s: 0.9, r: 0.05 }, gain: 0.22 } },
        { name: 'Snarl',  p: { osc: [osc('sawtooth', 1, -18), osc('sawtooth', 1, 18), osc('sawtooth', 0.4, 0, 2)], wob: { lo: 150, hi: 3000, q: 10 }, pump: PUMP, amp: { a: 0.004, d: 0.15, s: 0.9, r: 0.05 }, gain: 0.2 } },
        { name: 'Rasp',   p: { osc: [osc('sawtooth', 1, -8), osc('sawtooth', 1, 8), osc('square', 0.6)], wob: { lo: 180, hi: 2200, q: 12 }, pump: PUMP, amp: { a: 0.004, d: 0.15, s: 0.9, r: 0.05 }, gain: 0.2 } },
      ],
    },
    {
      id: 'layer', label: 'Saw Layer', part: 'bass', kind: 'synth', mix: -7, drive: 6, lo: 48, maxHold: 3, // the riff an octave up
      patterns: [BASE_RIFF],
      voices: [
        { name: 'Buzz', p: { osc: [osc('sawtooth', 1, -10), osc('sawtooth', 1, 10)], filter: { freq: 1500, q: 2, env: 1400, decay: 0.1 }, amp: { a: 0.003, d: 0.1, s: 0.7, r: 0.04 }, gain: 0.11 } },
        { name: 'Edge', p: { osc: [osc('sawtooth', 1, -6), osc('square', 0.6, 6)], filter: { freq: 1900, q: 3, env: 1800, decay: 0.08 }, amp: { a: 0.003, d: 0.1, s: 0.6, r: 0.04 }, gain: 0.1 } },
      ],
    },
    {
      id: 'pad', label: 'Pad', part: 'chord', kind: 'synth', mix: -6, lo: 52, send: { rev: 0.35 },
      voices: [
        { name: 'Dark Supersaw', p: { osc: [osc('sawtooth', 1, -14), osc('sawtooth', 1, 0), osc('sawtooth', 1, 14)], filter: { freq: 1700 }, amp: padAmp, gain: 0.044 } },
        { name: 'Glass Tri', p: { osc: [osc('triangle')], filter: { freq: 1800 }, amp: padAmp, gain: 0.2 } },
      ],
    },
    {
      id: 'lead', label: 'Lead', part: 'melody', kind: 'synth', mix: -5, drive: 5, send: { rev: 0.3, dly: 0.3 },
      range: [60, 79],
      rhythm: { notes: [2, 4], fine: 0.35, rest: 0.3, maxLen: 6, hook: 0 }, // sparse breakdown melody
      voices: [
        { name: 'Saw Lead', p: { osc: [osc('sawtooth', 1, -9), osc('sawtooth', 1, 9)], filter: { freq: 2800, q: 1.2 }, amp: { a: 0.006, d: 0.25, s: 0.6, r: 0.14 }, gain: 0.1 } },
        { name: 'Pulse Lead', p: { osc: [osc('square', 1, -6), osc('square', 1, 6)], filter: { freq: 2400, q: 1 }, amp: { a: 0.005, d: 0.3, s: 0.5, r: 0.14 }, gain: 0.1 } },
      ],
    },
    {
      id: 'zap', label: 'Build Zaps', part: 'chop', kind: 'synth', mix: -7, lo: 62, walk: 0.3, send: { rev: 0.15 },
      patterns: ['..2.......3.4...' + '....2.......3...'],
      voices: [
        { name: 'Zap', p: { osc: [osc('square')], glide: { from: 3, time: 0.05 }, filter: { freq: 3000, q: 2 }, amp: { a: 0.001, d: 0.05, s: 0.4, r: 0.03 }, gain: 0.12 } },
        { name: 'Chirp', p: { osc: [osc('sawtooth')], glide: { from: 0.5, time: 0.03 }, filter: { freq: 3500, q: 3 }, amp: { a: 0.001, d: 0.05, s: 0.4, r: 0.03 }, gain: 0.12 } },
      ],
    },
  ],

  radio: {
    groups: [G.drums, G.sub, G.clap, G.bass, G.pad, G.lead, G.fx],
    openers: [G.drums, G.pad],
    dropout: 0,
    decorate(plan, { R }) {
      const first = plan.findIndex(p => p.section === 'Main');
      const old = plan.filter(p => p.section === 'Main').length;
      const cycles = Math.max(2, Math.round(old / CYCLE)); // keep the song at roughly the usual 3–4 minutes
      const riffA = riff(R), riffB = riff(R);
      const main = [];
      for (let k = 0; k < cycles; k++) {
        for (const [name, n] of SECTIONS) {
          for (let i = 0; i < n; i++) {
            if (name === 'Drop A') main.push(drop(name, riffA, HAT_OFF, i, n, R, false));
            else if (name === 'Drop B') main.push(drop(name, riffB, HAT_B, i, n, R, true));
            else if (name === 'Breakdown') main.push({ section: name, active: new Set(['pad', 'lead', 'hat']), pat: { hat: two(HAT_8) } });
            else main.push(buildPhrase(i));
          }
        }
      }
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
