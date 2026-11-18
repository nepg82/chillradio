// lofi.js — Lofi hip-hop. Written from scratch for Chill Radio, sound modelled on the "Lofi loop machine".
// Soft swung boom-bap drums, a sine bass, voice-led 7th/9th chord stabs (strummed), a warm pad and a
// sparse melody. A slow shared pitch wobble (0.35 Hz, ±14 cents, phase-locked to the audio clock) drifts
// the keys, pad and lead together, and the whole mix is low-passed at 5.5 kHz.
// See PRIMER.md for the style schema.

const c = (r, t) => ({ r, t });
const osc = (type, gain = 1, detune = 0, mult = 1) => ({ type, gain, detune, mult });
const bars = (...b) => b.join(''); // patterns are two bars (32 steps)
const wobble = { rate: 0.35, depth: 14, sync: true };
const G = { pad: ['pad'], drums: ['kick', 'hat'], bass: ['bass'], keys: ['keys'], snare: ['snare'], lead: ['lead'] };

export default {
  id: 'lofi',
  name: 'Lofi',
  bpm: { min: 60, max: 90, def: 76 },
  swing: 0.2,

  names: {
    adj: ['Rainy', 'Dusty', 'Late', 'Quiet', 'Soft', 'Paper', 'Slow', 'Warm', 'Hazy', 'Sleepy'],
    noun: ['Window', 'Coffee', 'Bus', 'Sunday', 'Afternoon', 'Balcony', 'Library', 'Kettle', 'Lamp', 'Blanket'],
  },

  fx: {
    tone: 5500,
    reverb: { seconds: 2.0, decay: 3 },
    delay: { beats: 0.75, feedback: 0.3, lp: 1600 },
  },

  progressions: [
    { name: 'Slow Rain',     scale: 'minor',  chords: [c(0, 'min9'), c(8, 'maj7'), c(3, 'maj7'), c(10, 'dom7')] },
    { name: 'Hazy ii-V-I',   scale: 'major',  chords: [c(2, 'min9'), c(7, 'dom7'), c(0, 'maj9'), c(9, 'min7')] },
    { name: 'Late Bus',      scale: 'major',  chords: [c(0, 'maj9'), c(9, 'min7'), c(2, 'min9'), c(7, 'dom7')] },
    { name: 'Dusty Keys',    scale: 'dorian', chords: [c(0, 'min9'), c(5, 'dom7'), c(0, 'min9'), c(10, 'maj7')] },
    { name: 'Half Light',    scale: 'major',  chords: [c(5, 'maj9'), c(4, 'min7'), c(2, 'min9'), c(0, 'maj7')] },
    { name: 'Sunday Window', scale: 'minor',  chords: [c(0, 'min7'), c(5, 'min9'), c(8, 'maj7'), c(7, 'dom7')] },
  ],

  roles: [
    {
      id: 'kick', label: 'Kick', part: 'drum', kind: 'kick', mix: 0,
      patterns: [
        bars('x......?..?.....', 'x.........x.....'),
        bars('x.........x.....', 'x......?..?.....'),
        bars('x.....?...x.....', 'x.....?..?x?....'),
      ],
      voices: [{ name: 'Soft Kick', p: { f0: 150, f1: 58, sweep: 0.1, decay: 0.27, gain: 0.8 } }],
    },
    {
      id: 'snare', label: 'Snare', part: 'drum', kind: 'snare', mix: 0, send: { rev: 0.25 },
      patterns: [
        bars('....x.......x...', '....x.......x...'),
        bars('....x....g..x...', '....x.......x..g'),
      ],
      voices: [{ name: 'Dusty Snare', p: { noiseFreq: 1900, q: 0.7, decay: 0.2, gain: 0.5, tone: 185, toneDecay: 0.09, toneGain: 0.3 } }],
    },
    {
      id: 'hat', label: 'Hats', part: 'drum', kind: 'hat', mix: 0,
      patterns: [
        bars('x.g.x.g.x.g.x.g.', 'x.g.x.g,x.g.x.g.'),
        bars('x,g.x.g.x.g.x,g.', 'x.g.x.g.x.g.x.g.'),
      ],
      voices: [{ name: 'Soft Hats', p: { freq: 4800, decay: 0.05, openDecay: 0.12, gain: 0.21 } }],
    },
    {
      id: 'bass', label: 'Bass', part: 'bass', kind: 'synth', mix: 0, lo: 36, maxHold: 5,
      patterns: [
        bars('r.........r.....', 'r...............'),
        bars('r.........5.....', 'r..........r....'),
        bars('r..........5....', 'r.........r.....'),
      ],
      voices: [
        { name: 'Sine Sub',  p: { osc: [osc('sine')],     filter: { freq: 700, q: 0.7 }, amp: { a: 0.02, d: 0.1, s: 1, r: 0.24 }, gain: 0.45 } },
        { name: 'Soft Tri',  p: { osc: [osc('triangle')], filter: { freq: 600, q: 0.7 }, amp: { a: 0.02, d: 0.1, s: 1, r: 0.24 }, gain: 0.4 } },
      ],
    },
    {
      id: 'keys', label: 'Keys', part: 'comp', kind: 'synth', mix: 0, lo: 50, voiceLead: true, send: { rev: 0.2 },
      patterns: [
        bars('7.....3...3...3.', '7.....3...3.....'),
        bars('7.....3...3.....', '7.........3...3.'),
        bars('7.....3.......3.', '7.....3...3...3.'),
        bars('7...............', '7.....3...3.....'),
      ],
      voices: [
        { name: 'Warm Keys',  p: { osc: [osc('triangle'), osc('sine', 0.22, 5, 2)], filter: { freq: 1800 }, vibrato: wobble, amp: { a: 0.012, d: 0.75, s: 0.45, r: 0.36 }, gain: 0.1 } },
        { name: 'Sine Keys',  p: { osc: [osc('sine'), osc('sine', 0.22, 5, 2)],     filter: { freq: 1800 }, vibrato: wobble, amp: { a: 0.012, d: 0.75, s: 0.45, r: 0.36 }, gain: 0.11 } },
        { name: 'Mellow Sq',  p: { osc: [osc('square'), osc('sine', 0.22, 5, 2)],   filter: { freq: 1500 }, vibrato: wobble, amp: { a: 0.012, d: 0.75, s: 0.45, r: 0.36 }, gain: 0.05 } },
      ],
    },
    {
      id: 'pad', label: 'Pad', part: 'chord', kind: 'synth', mix: 0, lo: 38, voiceLead: true, send: { rev: 0.35 },
      voices: [
        { name: 'Warm Tri',  p: { osc: [osc('triangle', 1, -7), osc('triangle', 1, 7)], filter: { freq: 1000, q: 0.3 }, vibrato: wobble, amp: { a: 0.6, d: 0.1, s: 1, r: 1.05 }, gain: 0.0625 } },
        { name: 'Sine Pad',  p: { osc: [osc('sine', 1, -7), osc('sine', 1, 7)],         filter: { freq: 1000, q: 0.3 }, vibrato: wobble, amp: { a: 0.6, d: 0.1, s: 1, r: 1.05 }, gain: 0.08 } },
        { name: 'Dusty Saw', p: { osc: [osc('sawtooth', 1, -7), osc('sawtooth', 1, 7)], filter: { freq: 700, q: 0.3 },  vibrato: wobble, amp: { a: 0.6, d: 0.1, s: 1, r: 1.05 }, gain: 0.03 } },
      ],
    },
    {
      id: 'lead', label: 'Lead', part: 'melody', kind: 'synth', mix: -4, send: { rev: 0.4, dly: 0.3 },
      range: [64, 81],
      rhythms: [
        [[0, 4], [6, 2], [8, 6], [16, 4], [22, 2], [24, 8]],
        [[0, 6], [8, 4], [12, 4], [16, 8], [28, 4]],
        [[2, 4], [8, 2], [10, 6], [18, 4], [24, 6]],
      ],
      voices: [
        { name: 'Rhodes',     p: { osc: [osc('sine'), osc('triangle', 0.3, 0, 2)], filter: { freq: 3000 }, vibrato: wobble, amp: { a: 0.01, d: 0.6, s: 0.2, r: 0.5 }, gain: 0.2 } },
        { name: 'Soft Tri',   p: { osc: [osc('triangle')], filter: { freq: 2200 }, vibrato: wobble, amp: { a: 0.03, d: 0.3, s: 0.6, r: 0.5 }, gain: 0.2 } },
        { name: 'Muted Pluck', p: { osc: [osc('triangle'), osc('sine', 0.4, 0, 2)], filter: { freq: 1800, env: 1500, decay: 0.2 }, amp: { a: 0.005, d: 0.4, s: 0, r: 0.3 }, gain: 0.22 } },
        { name: 'Tape Sine',  p: { osc: [osc('sine'), osc('triangle', 0.2, 0, 2)], filter: { freq: 3000 }, vibrato: { rate: 4.5, depth: 15 }, amp: { a: 0.05, d: 0.3, s: 0.7, r: 0.5 }, gain: 0.2 } },
      ],
    },
  ],

  radio: {
    groups: [G.pad, G.drums, G.bass, G.keys, G.snare, G.lead],
    openers: [G.pad, G.drums, G.keys],
    dropout: 0.3,
  },
};
