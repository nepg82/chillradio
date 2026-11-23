// darksynth.js — ported from Chillforge. See PRIMER.md for the style schema.
// Heavy kick, gated snare, galloping distorted bass with a filter sweep, eighth-note arp.
import { scenes } from './scenes.js';

const c = (r, t) => ({ r, t });
const osc = (type, gain = 1, detune = 0, mult = 1) => ({ type, gain, detune, mult });
const DRUMS = ['kick', 'snare', 'hat'];
const G = { pad: ['pad'], drums: ['kick', 'hat'], bass: ['bass'], arp: ['arp'], snare: ['snare'] };
const padAmp = { a: 0.18, d: 0.1, s: 1, r: 0.75 };
const arpAmp = { a: 0.004, d: 0.21, s: 0.35, r: 0.09 };

export default {
  id: 'darksynth',
  name: 'Darksynth',
  bpm: { min: 90, max: 135, def: 112 },
  swing: 0,

  names: {
    adj: ['Black', 'Iron', 'Cold', 'Rust', 'Void', 'Crimson', 'Grim', 'Night', 'Static', 'Hollow'],
    noun: ['Machine', 'Pursuit', 'Abyss', 'Chrome', 'Reactor', 'Syndicate', 'Engine', 'Siren', 'Protocol', 'Wasteland'],
  },

  fx: {
    reverb: { seconds: 2.2, decay: 3 },
    delay: { beats: 0.75, feedback: 0.38, lp: 1800 },
  },

  progressions: [
    { name: 'Phrygian Dread',    scale: 'phrygian', chords: [c(0, 'minS'), c(1, 'majS'), c(0, 'minS'), c(10, 'majS')] }, // i bII i bVII
    { name: 'Harmonic Pursuit',  scale: 'minor',    chords: [c(0, 'minS'), c(5, 'minS'), c(8, 'majS'), c(7, 'majS')] },  // i iv VI V
    { name: 'Abyss',             scale: 'minor',    chords: [c(0, 'minS'), c(8, 'majS'), c(10, 'majS'), c(0, 'minS')] }, // i bVI bVII i
    { name: 'Midnight Chase',    scale: 'minor',    chords: [c(0, 'minS'), c(10, 'majS'), c(8, 'majS'), c(7, 'majS')] }, // i bVII bVI V
  ],

  roles: [
    {
      id: 'kick', label: 'Kick', part: 'drum', kind: 'kick', mix: 0,
      patterns: ['x..?..?.x.?...?.'],
      voices: [{ name: 'Hard Kick', p: { f0: 190, f1: 40, sweep: 0.09, decay: 0.5, gain: 0.7, click: 0.1 } }],
    },
    {
      id: 'snare', label: 'Snare', part: 'drum', kind: 'snare', mix: 0, send: { rev: 0.4 },
      patterns: ['....x.......x...'],
      voices: [
      	{ name: 'Gated Snare', p: { gate: 0.19, noiseFreq: 2200, q: 0.7, gain: 0.35, tone: 175, toneDecay: 0.11, toneGain: 0.19 } },
      	{ name: 'Big Snare', p: { noiseFreq: 2200, q: 0.7, decay: 0.17, gain: 0.5, tone: 190, toneDecay: 0.09, toneGain: 0.25 } },
      ],
    },
    {
      id: 'hat', label: 'Hats', part: 'drum', kind: 'hat', mix: 0,
      patterns: ['g,x,g,x,g,x,g,x,'],
      voices: [{ name: 'Tight Hats', p: { freq: 7500, decay: 0.04, openDecay: 0.1, gain: 0.14 } }],
    },
    {
      id: 'bass', label: 'Bass', part: 'bass', kind: 'synth', mix: -4, accent: true, drive: 5,
      patterns: ['r.rrr.rrr.rrr.rr', 'rrrrrrrrrrrrrrrr', 'rorororororororo', 'r.r.r.o.r.r.r.o.'], // gallop, driving, octave bounce, pulse
      voices: [{ name: 'Dark Saw', p: { osc: [osc('sawtooth')], filter: { sweep: [380, 1200], q: 3 }, amp: { a: 0.008, d: 0.24, s: 0.55, r: 0.12 }, gain: 0.34 } }],
    },
    {
      id: 'pad', label: 'Pad', part: 'chord', kind: 'synth', mix: -4, lo: 40, send: { rev: 0.4 },
      voices: [
        { name: 'Supersaw',   p: { osc: [osc('sawtooth', 1, -14), osc('sawtooth', 1, 0), osc('sawtooth', 1, 14)], filter: { freq: 1500 }, amp: padAmp, gain: 0.044 } },
        { name: 'Single Saw', p: { osc: [osc('sawtooth')], filter: { freq: 1500 }, amp: padAmp, gain: 0.09 } },
        { name: 'Glass Tri',  p: { osc: [osc('triangle')], filter: { freq: 1500 }, amp: padAmp, gain: 0.2 } },
      ],
    },
    {
      id: 'arp', label: 'Arp', part: 'arp', kind: 'synth', mix: -3, lo: 52, accent: true, noteLen: 1.6, send: { rev: 0.4, dly: 0.2 },
      patterns: ['0.1.2.3.4.5.6.7.6.5.4.3.2.1.0.1.', '~wander2', '~scatter2'], // eighth notes: up-down, walk, random
      voices: [
        { name: 'Saw Lead',    p: { osc: [osc('sawtooth')], filter: { freq: 3750 }, amp: arpAmp, gain: 0.058 } },
        { name: 'Square Lead', p: { osc: [osc('square')],   filter: { freq: 3750 }, amp: arpAmp, gain: 0.05 } },
        { name: 'Soft Tri',    p: { osc: [osc('triangle')], filter: { freq: 3750 }, amp: arpAmp, gain: 0.144 } },
        { name: 'Sine Lead',   p: { osc: [osc('sine')],     filter: { freq: 3750 }, amp: arpAmp, gain: 0.17 } },
      ],
    },
  ],

  radio: {
    groups: [G.pad, G.drums, G.bass, G.arp, G.snare],
    openers: [G.pad, G.drums, G.arp],
    dropout: 0,
    decorate: scenes([
      { mute: DRUMS, w: 3 }, { mute: ['arp'], w: 2 }, { mute: ['pad'], w: 2 },
      { mute: ['pad', 'arp'], w: 2 }, { mute: [...DRUMS, 'bass'], w: 1 },
    ], 0.25),
  },
};
