// synthwave.js — ported from Chillforge. See PRIMER.md for the style schema.
// Straight 80s feel: kick on 1 and 3, big snare on 2 and 4, pulsing saw bass, supersaw pad, 16th-note arp.
import { scenes } from './scenes.js';

const c = (r, t) => ({ r, t }); // chord: root offset from the key, chord type (minS/majS = spread triads)
const osc = (type, gain = 1, detune = 0, mult = 1) => ({ type, gain, detune, mult });
const DRUMS = ['kick', 'snare', 'hat'];
const G = { pad: ['pad'], drums: ['kick', 'hat'], bass: ['bass'], arp: ['arp'], snare: ['snare'] };
const padAmp = { a: 0.18, d: 0.1, s: 1, r: 0.75 };
const arpAmp = { a: 0.004, d: 0.21, s: 0.35, r: 0.09 };

export default {
  id: 'synthwave',
  name: 'Synthwave',
  bpm: { min: 85, max: 125, def: 108 },
  swing: 0,

  names: {
    adj: ['Neon', 'Chrome', 'Midnight', 'Laser', 'Turbo', 'Electric', 'Sunset', 'Retro', 'Digital', 'Violet'],
    noun: ['Drive', 'Grid', 'Highway', 'Arcade', 'Skyline', 'Overdrive', 'Horizon', 'Boulevard', 'Circuit', 'Nights'],
  },

  fx: {
    reverb: { seconds: 2.2, decay: 3 },
    delay: { beats: 0.75, feedback: 0.38, lp: 1800 },
  },

  // Chillforge's four were the same shape in different keys (keys are random here), so two are ported
  // as-is and two (Sunset Strip, Midnight Run) are new in the same spirit.
  progressions: [
    { name: 'Neon Drive',       scale: 'minor', chords: [c(0, 'minS'), c(8, 'majS'), c(3, 'majS'), c(10, 'majS')] }, // i VI III VII
    { name: 'Andalusian Night', scale: 'minor', chords: [c(0, 'minS'), c(10, 'majS'), c(8, 'majS'), c(7, 'majS')] }, // i VII VI V
    { name: 'Sunset Strip',     scale: 'minor', chords: [c(0, 'minS'), c(8, 'majS'), c(5, 'minS'), c(7, 'majS')] }, // i VI iv V
    { name: 'Midnight Run',     scale: 'minor', chords: [c(0, 'minS'), c(3, 'majS'), c(8, 'majS'), c(10, 'majS')] }, // i III VI VII
  ],

  roles: [
    {
      id: 'kick', label: 'Kick', part: 'drum', kind: 'kick', mix: 0,
      patterns: ['x.......x.?...?.', 'x...x...x...x...'], // Chillforge's, then four-on-the-floor
      voices: [{ name: 'Synth Kick', p: { f0: 140, f1: 42, sweep: 0.12, decay: 0.42, gain: 0.55 } }],
    },
    {
      id: 'snare', label: 'Snare', part: 'drum', kind: 'snare', mix: 0, send: { rev: 0.35 },
      patterns: ['....x.......x...'],
      voices: [{ name: 'Big Snare', p: { noiseFreq: 2200, q: 0.7, decay: 0.17, gain: 0.5, tone: 190, toneDecay: 0.09, toneGain: 0.25 } }],
    },
    {
      id: 'hat', label: 'Hats', part: 'drum', kind: 'hat', mix: 0,
      patterns: ['x,o,x,o,x,o,x,o,'],
      voices: [{ name: 'Crisp 80s', p: { freq: 7500, decay: 0.04, openDecay: 0.11, gain: 0.11 } }],
    },
    {
      id: 'bass', label: 'Bass', part: 'bass', kind: 'synth', mix: -2, accent: true,
      patterns: ['r.r.r.o.r.r.r.o.', 'rorororororororo'], // pulse, octave bounce
      voices: [{ name: 'Saw Bass', p: { osc: [osc('sawtooth')], filter: { freq: 650, q: 3 }, amp: { a: 0.008, d: 0.24, s: 0.55, r: 0.12 }, gain: 0.34 } }],
    },
    {
      id: 'pad', label: 'Pad', part: 'chord', kind: 'synth', mix: -3, lo: 40, send: { rev: 0.35 },
      voices: [
        { name: 'Supersaw',   p: { osc: [osc('sawtooth', 1, -14), osc('sawtooth', 1, 0), osc('sawtooth', 1, 14)], filter: { freq: 2600 }, amp: padAmp, gain: 0.044 } },
        { name: 'Single Saw', p: { osc: [osc('sawtooth')], filter: { freq: 2600 }, amp: padAmp, gain: 0.09 } },
        { name: 'Glass Tri',  p: { osc: [osc('triangle')], filter: { freq: 2600 }, amp: padAmp, gain: 0.2 } },
      ],
    },
    {
      id: 'arp', label: 'Arp', part: 'arp', kind: 'synth', mix: -2, lo: 52, accent: true, noteLen: 0.8, send: { rev: 0.35, dly: 0.25 },
      patterns: ['0123456765432101', '~wander', '~scatter'], // up-down, random walk, fully random
      voices: [
        { name: 'Saw Lead',    p: { osc: [osc('sawtooth')],  filter: { freq: 4500 }, amp: arpAmp, gain: 0.058 } },
        { name: 'Square Lead', p: { osc: [osc('square')],    filter: { freq: 4500 }, amp: arpAmp, gain: 0.05 } },
        { name: 'Soft Tri',    p: { osc: [osc('triangle')],  filter: { freq: 4500 }, amp: arpAmp, gain: 0.144 } },
        { name: 'Sine Lead',   p: { osc: [osc('sine')],      filter: { freq: 4500 }, amp: arpAmp, gain: 0.17 } },
      ],
    },
  ],

  radio: {
    groups: [G.pad, G.drums, G.bass, G.arp, G.snare],
    openers: [G.pad, G.drums, G.arp],
    dropout: 0,
    decorate: scenes([
      { mute: DRUMS, w: 3 }, { mute: ['arp'], w: 3 }, { mute: ['pad'], w: 2 },
      { mute: [...DRUMS, 'bass'], w: 1 }, { mute: ['pad', 'arp'], w: 1 },
    ], 0.25),
  },
};
