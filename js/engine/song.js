// song.js — builds a "song": every random choice that stays fixed while it plays
// (key, tempo, progression, voices, patterns, melodic motifs, title).
import { tools, CHORD_TYPES, scaleMidi } from './music.js';

// o = optional overrides: { key, bpm, progression, voices:{roleId:voiceName}, keep: previousSong }
// `keep` reuses the previous song's drum/bass/arp patterns and title.
export function makeSong(style, o = {}, rnd = Math.random) {
  const R = tools(rnd);
  const progression = o.progression || R.pick(style.progressions);
  const key = o.key ?? R.int(0, 11);
  const bpm = o.bpm ?? R.int(style.bpm.min, style.bpm.max);
  const voices = {}, patterns = {}, motifs = {};

  for (const role of style.roles) {
    voices[role.id] = role.voices.find(v => v.name === o.voices?.[role.id]) || R.pick(role.voices);
    if (role.patterns) patterns[role.id] = o.keep?.patterns[role.id] || R.pick(role.patterns);
    if (role.part === 'melody') {
      let last = ''; // signature of the previous chord's rhythm, so neighbouring chords never repeat it
      motifs[role.id] = progression.chords.map(ch => {
        const rhythm = makeRhythm(role, R, last);
        last = rhythm.map(([s]) => s).join();
        return makeMotif(role, key, ch, progression.scale, R, rhythm);
      });
    }
  }
  const title = o.keep?.title || `${R.pick(style.names.adj)} ${R.pick(style.names.noun)}`;
  return { style, key, bpm, progression, voices, patterns, motifs, title, rt: {} };
}

// Rhythm for one 2-bar motif: [[step, len], …] (steps are 16ths, 0–31).
// Generated from role.rhythm = { notes: [min, max] onsets per bar, fine: odds of 16th-note off-beats (0–1),
// rest: chance a note is shortened to leave a gap, maxLen: longest note in steps, hook: chance of using one
// of the hand-written role.rhythms instead }. Bar 2 answers bar 1 (keeps its first half, or is new), a
// motif never repeats the previous chord's rhythm, and its two bars are never identical.
function makeRhythm(role, R, prev) {
  const p = { notes: [2, 4], fine: 0.3, rest: 0.35, maxLen: 8, hook: 0.25, ...role.rhythm };
  const weight = s => (s === 0 ? 10 : s === 8 ? 7 : s % 4 === 0 ? 5 : s % 2 === 0 ? 3.5 : 3 * p.fine);
  const bar = () => { // onset steps within one bar (0–15)
    const set = new Set();
    if (R.chance(0.75)) set.add(0);
    const n = R.int(p.notes[0], p.notes[1]);
    while (set.size < n) {
      const open = [...Array(16).keys()].filter(s => !set.has(s));
      let r = R.rnd() * open.reduce((a, s) => a + weight(s), 0);
      set.add(open.find(s => (r -= weight(s)) < 0) ?? open[0]);
    }
    return [...set].sort((a, b) => a - b);
  };
  const timed = (steps, base) => steps.map((s, i) => {
    let len = Math.min(p.maxLen, (steps[i + 1] ?? 16) - s);
    if (len > 1 && R.chance(p.rest)) len = Math.max(1, Math.round(len / 2));
    return [base + s, len];
  });
  const sig = r => r.map(([s]) => s).join();
  let out;
  for (let tries = 0; tries < 8; tries++) {
    if (role.rhythms && R.chance(p.hook)) out = R.pick(role.rhythms);
    else {
      const b1 = bar();
      let b2 = R.chance(0.5) ? [...b1.filter(s => s < 8), ...bar().filter(s => s >= 8)] : bar();
      if (!b2.length) b2 = bar();
      out = [...timed(b1, 0), ...timed(b2, 16)];
    }
    const first = sig(out.filter(([s]) => s < 16)), second = sig(out.filter(([s]) => s >= 16).map(([s]) => [s - 16]));
    if (sig(out) !== prev && first !== second) break;
  }
  return out;
}

// One 2-bar motif: {step: {midi, len}}. Starts on a chord tone, then mostly steps.
function makeMotif(role, key, chord, scale, R, rhythm) {
  const pool = scaleMidi(key, scale, role.range[0], role.range[1]);
  const pcs = CHORD_TYPES[chord.t].map(i => (key + chord.r + i) % 12);
  const tones = pool.filter(m => pcs.includes(m % 12));
  const motif = {};
  let prev = R.pick(tones);
  rhythm.forEach(([s, len], i) => {
    const near = pool.filter(m => Math.abs(m - prev) <= 4 && m !== prev);
    prev = i === 0 || !near.length || R.chance(0.3) ? R.pick(tones) : R.pick(near);
    motif[s] = { midi: prev, len };
  });
  return motif;
}
