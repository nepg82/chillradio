// parts.js — turns a pattern + chord into note events for one 16th-note step.
// A style's role picks one via `part: 'drum' | 'bass' | 'chord' | 'arp' | 'melody'`.
// To add a new behaviour (e.g. a wobble bass), add a function here.
// Every part receives a context object c = { song, role, pat, s, chord, ci, stepDur }
//   s = step within the 2-bar phrase (0–31), ci = chord index in the progression.
import { CHORD_TYPES, chordMidi, mtof, fold, voiceLead } from './music.js';

// Steps from s until the next non-rest character (cyclic).
const hold = (pat, s) => {
  let n = 1;
  while (n < pat.length && pat[(s + n) % pat.length] === '.') n++;
  return n;
};

// Voice-led voicing for a role (role.voiceLead): computed once per chord, then reused for the whole phrase.
// role.rootless drops the root (the bass plays it), as jazz/lofi comping does.
function voicing(song, role, chord, ci, s) {
  const st = (song.rt[role.id] ||= {});
  if (st.ci !== ci || s < st.s) { st.notes = voiceLead(st.notes, chordMidi(song.key, chord, 0).slice(role.rootless ? 1 : 0), role.lo ?? 50); st.ci = ci; }
  st.s = s;
  return st.notes;
}

export const PARTS = {
  // x = hit, g = ghost (quiet), o = open (hats), . = rest
  // ? = maybe (35% chance, strong), , = maybe-ghost (60% chance, quiet)
  drum({ pat, s }) {
    const ch = pat[s % pat.length];
    if (ch === '.' || (ch === '?' && Math.random() > 0.35) || (ch === ',' && Math.random() > 0.6)) return [];
    const vel = ch === 'g' || ch === ',' ? 0.4 : ch === '?' ? 0.7 : 0.85 + Math.random() * 0.15;
    return [{ vel, open: ch === 'o' }];
  },

  // r = root, b = the chord's third, f = fourth, 5 = fifth, j = minor seventh, o = octave up, . = rest. Notes hold until the next hit.
  // role.accent: off-beat notes are softer. Events carry `pos` (0-1 through the progression) for filter sweeps.
  bass({ song, role, pat, s, chord, ci, stepDur }) {
    const ch = pat[s % pat.length], off = ch === 'b' ? CHORD_TYPES[chord.t][1] : { r: 0, f: 5, 5: 7, j: 10, o: 12 }[ch];
    if (off === undefined) return [];
    const root = fold(song.key + chord.r, role.lo ?? 28);
    return [{ freq: mtof(root + off), dur: Math.min(hold(pat, s), role.maxHold ?? 99) * stepDur * 0.92, vel: role.accent && s % 4 ? 0.76 : 1,
      pos: (ci * 32 + s) / (32 * song.progression.chords.length) }];
  },

  // Sustained chord, struck once per 2-bar phrase.
  chord({ song, role, s, chord, ci, stepDur }) {
    if (s) return [];
    return (role.voiceLead ? voicing(song, role, chord, ci, s) : chordMidi(song.key, chord, role.lo ?? 55)).map(m => ({ freq: mtof(m), dur: 32 * stepDur, vel: 0.8 }));
  },

  // Digits index into the chord tones (wrapping up an octave); . = rest.
  // '~wander' / '~scatter' (optionally + step interval, e.g. '~wander2') walk randomly through two octaves
  // of chord tones. role.lo = lowest root, role.noteLen = steps, role.accent = louder on the beat.
  arp({ song, role, pat, s, chord, stepDur }) {
    const tones = chordMidi(song.key, chord, role.lo ?? 60);
    const dur = (role.noteLen ?? 1.5) * stepDur;
    const vel = role.accent ? (s % 4 === 0 ? 0.9 : 0.68) : 0.8;
    const walk = /^~(wander|scatter)(\d)?$/.exec(pat);
    if (walk) {
      if (s % +(walk[2] || 1)) return [];
      const pool = [...new Set([...tones, ...tones.map(m => m + 12)])].sort((a, b) => a - b), n = pool.length;
      const st = (song.rt[role.id] ||= { last: null });
      let i = -1, best = Infinity;
      if (st.last !== null) pool.forEach((m, k) => { const d = Math.abs(m - st.last); if (d < best) { best = d; i = k; } });
      let j;
      if (i < 0) j = Math.floor(Math.random() * n);
      else if (walk[1] === 'scatter') { do { j = Math.floor(Math.random() * n); } while (j === i && n > 1); }
      else { // wander: mostly neighbours, sometimes a repeat, a skip or a leap
        const r = Math.random(), dist = r < 0.5 ? 1 : r < 0.65 ? 0 : r < 0.9 ? 2 : 3 + Math.floor(Math.random() * 2);
        const dir = Math.random() < 0.5 ? 1 : -1;
        j = i + dir * dist;
        if (j < 0 || j >= n) j = i - dir * dist;
        j = Math.max(0, Math.min(n - 1, j));
      }
      st.last = pool[j];
      return [{ freq: mtof(pool[j]), dur, vel }];
    }
    const ch = pat[s % pat.length];
    if (ch === '.') return [];
    const i = +ch;
    return [{ freq: mtof(tones[i % tones.length] + 12 * Math.floor(i / tones.length)), dur, vel }];
  },

  // Plucked chord stabs. Each digit is a hit whose value is its length in steps; . = rest.
  // The chord is strummed low to high a few ms apart (ev.dt). Use with role.voiceLead + role.lo.
  comp({ song, role, pat, s, chord, ci, stepDur }) {
    const d = +pat[s % pat.length];
    if (!d) return [];
    const k = role.strum ?? 0.014; // seconds between strummed notes (role.strum: 0.003 = tight stab)
    return voicing(song, role, chord, ci, s).map((m, n) => ({ freq: mtof(m), dur: d * stepDur, vel: 0.8, dt: n * k + Math.random() * k * 0.57 }));
  },

  // Pre-generated motif per chord (see song.js).
  melody({ song, role, ci, s, stepDur }) {
    const n = song.motifs[role.id][ci][s];
    return n ? [{ freq: mtof(n.midi), dur: n.len * stepDur * 0.95, vel: 0.9 }] : [];
  },

  // Wobble bass (kind 'wobble'): the bass part's notes plus one control event at the start of every bar that
  // tells the kind which cutoff curve to schedule. role.rates = candidate wobble speeds in cycles per beat
  // (1 = quarter notes, 2 = eighths, 3 = triplets, 4 = sixteenths; 0 = hold open), one picked per bar.
  wobble(c) {
    const evs = PARTS.bass(c);
    if (c.s % 16) return evs;
    const rates = c.role.rates ?? [1, 2, 2, 3, 4], tk = c.role.talk; // role.talk = { chance, points }: this bar "talks" instead of wobbling
    const ctl = { ctl: true, rate: rates[Math.floor(Math.random() * rates.length)], dur: 16 * c.stepDur };
    if (tk && Math.random() < tk.chance) { // random walk of vowel-like cutoff targets, one per eighth note, favouring the extremes
      const VOWELS = [0.08, 0.2, 0.45, 0.7, 0.9, 1];
      ctl.pts = Array.from({ length: tk.points ?? 8 }, () => VOWELS[Math.floor(Math.random() * VOWELS.length)]);
    }
    evs.unshift(ctl);
    return evs;
  },

  // Stutter / glitch hits. Pattern digit 1–4 = that many equal repeats inside the step (1 = one 16th,
  // 2 = two 32nds, …), . = rest. Pitch is the chord root (role.lo), or with chance role.walk a random chord
  // tone, one octave higher a quarter of the time. Repeats share the pitch and fade slightly.
  chop({ song, role, pat, s, chord, stepDur }) {
    const n = +pat[s % pat.length];
    if (!n) return [];
    const tones = chordMidi(song.key, chord, role.lo ?? 60);
    const walk = Math.random() < (role.walk ?? 0.35);
    const m = walk ? tones[Math.floor(Math.random() * tones.length)] + (Math.random() < 0.25 ? 12 : 0) : tones[0];
    return Array.from({ length: n }, (_, i) => ({ freq: mtof(m), dur: stepDur / n * 0.7, vel: 0.9 - i * 0.12, dt: i * stepDur / n }));
  },
};
