// instruments.js — generic sound generators ("kinds"). Styles supply parameter
// presets; nothing here knows about any particular genre.
// Every kind has the same signature: (ctx, out, t, ev, p)  [see BUS at the bottom for `out`]
//   ctx = AudioContext, out = destination node, t = start time,
//   ev  = event {freq, dur, vel, open}, p = preset params from the style.

const noiseCache = new WeakMap();

function noiseBuffer(ctx) {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return b;
}

function noiseSrc(ctx, t, dur) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx);
  s.start(t, Math.random()); // random offset so hits differ slightly
  s.stop(t + dur);
  return s;
}

const decayEnv = (g, t, peak, decay) => {
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
};

function filter(ctx, type, freq, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  return f;
}

// One shared filter per (destination, type, freq, q); drum hits feed it instead of each making their own.
const sharedCache = new WeakMap();
function sharedFilter(ctx, out, type, freq, q = 0.7) {
  let m = sharedCache.get(out);
  if (!m) sharedCache.set(out, (m = new Map()));
  const key = `${type}|${freq}|${q}`;
  let f = m.get(key);
  if (!f) { f = filter(ctx, type, freq, q); f.connect(out); m.set(key, f); }
  return f;
}

// ---- Drums ----------------------------------------------------------------

function kick(ctx, out, t, ev, p) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = p.type || 'sine';
  o.frequency.setValueAtTime(p.f0, t);
  o.frequency.exponentialRampToValueAtTime(p.f1, t + p.sweep);
  decayEnv(g, t, ev.vel * p.gain, p.decay);
  o.connect(g);
  g.connect(p.lp ? sharedFilter(ctx, out, 'lowpass', p.lp) : out);
  o.start(t); o.stop(t + p.decay + 0.05);
  if (p.click) { // short noise transient
    const n = noiseSrc(ctx, t, 0.02), cg = ctx.createGain();
    decayEnv(cg, t, ev.vel * p.click, 0.015);
    n.connect(cg).connect(sharedFilter(ctx, out, 'highpass', 2000));
  }
}

function snare(ctx, out, t, ev, p) {
  const bursts = p.clap ? [0, 0.011, 0.022] : [0];
  bursts.forEach((off, i) => {
    const last = i === bursts.length - 1;
    const d = last ? (p.gate || p.decay) : 0.012;
    const n = noiseSrc(ctx, t + off, d + 0.05), g = ctx.createGain();
    if (p.gate && last) { // gated: held level, then cut sharply (the reverb send supplies the tail)
      const pk = ev.vel * p.gain;
      g.gain.setValueAtTime(pk, t + off);
      g.gain.linearRampToValueAtTime(pk * 0.69, t + off + d * 0.84);
      g.gain.linearRampToValueAtTime(0.0001, t + off + d);
    } else decayEnv(g, t + off, ev.vel * p.gain, d);
    n.connect(g).connect(sharedFilter(ctx, out, 'bandpass', p.noiseFreq, p.q || 0.8));
    });
  if (p.tone) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(p.tone, t);
    o.frequency.exponentialRampToValueAtTime(p.tone * 0.6, t + p.toneDecay);
    decayEnv(g, t, ev.vel * p.toneGain, p.toneDecay);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + p.toneDecay + 0.05);
  }
}

function hat(ctx, out, t, ev, p) {
  const d = ev.open ? p.openDecay : p.decay;
  const n = noiseSrc(ctx, t, d + 0.05), g = ctx.createGain();
  decayEnv(g, t, ev.vel * p.gain, d);
  n.connect(g).connect(sharedFilter(ctx, out, 'highpass', p.freq));
}

// ---- Subtractive synth (bass / pad / lead / arp / anything tonal) ----------
// p = { osc:[{type, detune, mult, gain}], filter:{type,freq,q,env,decay},
//       amp:{a,d,s,r}, vibrato:{rate,depth}, gain }
// Per note this creates ONLY oscillators, one gain each. The filter is the role's shared tone
// filter (built once by BUS.synth) and is driven once per strike; vibrato is a pitch curve
// scheduled on each oscillator. No per-note filters, LFOs or param connections (PRIMER.md,
// "Audio graph rules"): notes are transient SOURCES into long-lived destinations, never the reverse.

// Pitch curve for one oscillator. v.sync = true locks the phase to the audio clock, so every note
// wobbles together like one shared LFO (tape-style wow) without wiring anything between nodes.
function vibratoCurve(base, v, dur, t0) {
  const pps = Math.min(60, Math.max(10, v.rate * 12));
  const n = Math.min(2000, Math.max(2, Math.ceil(dur * pps)));
  const ph = v.sync ? 2 * Math.PI * v.rate * t0 : 0;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = base + v.depth * Math.sin(2 * Math.PI * v.rate * dur * i / (n - 1) + ph);
  return c;
}

function synth(ctx, out, t, ev, p) {
  const tone = out.tone || out; // `out` is the bus input; its shared filter (if the bus has a shaper in front) is out.tone
  const { a = 0.01, d = 0.2, s = 0.6, r = 0.2 } = p.amp || {};
  const dur = Math.max(ev.dur, a + 0.02);
  const end = t + dur, stopAt = end + r * 2;
  const peak = ev.vel * (p.gain ?? 0.2);

  if (tone.lastT !== t) { // chord notes share one strike time, so the filter is set once per strike
    tone.lastT = t;
    const fp = p.filter || {}, type = fp.type || 'lowpass';
    // fp.sweep = [lo, hi] Hz: the cutoff glides lo -> hi -> lo across the progression (ev.pos is 0..1)
    const base = fp.sweep && ev.pos != null ? fp.sweep[0] * (fp.sweep[1] / fp.sweep[0]) ** (1 - Math.abs(2 * ev.pos - 1)) : fp.freq || 4000;
    if (tone.type !== type) tone.type = type;
    tone.Q.setValueAtTime(fp.q || 0.7, t);
    tone.frequency.setValueAtTime(base + (fp.env || 0), t);
    if (fp.env) tone.frequency.setTargetAtTime(base, t, (fp.decay || 0.3) / 3);
  }
  for (const spec of p.osc) {
    const o = ctx.createOscillator(), g = ctx.createGain(), pk = peak * (spec.gain ?? 1);
    o.type = spec.type;
    const f0 = ev.freq * (spec.mult || 1);
    if (p.glide) { // optional per-note pitch glide: starts p.glide.from × the note, lands on it after p.glide.time s
      o.frequency.setValueAtTime(f0 * p.glide.from, t);
      o.frequency.exponentialRampToValueAtTime(f0, t + p.glide.time);
    } else o.frequency.value = f0;
    if (p.vibrato) o.detune.setValueCurveAtTime(vibratoCurve(spec.detune || 0, p.vibrato, stopAt - t, t), t, stopAt - t);
    else o.detune.value = spec.detune || 0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(pk, t + a);
    g.gain.setTargetAtTime(pk * s, t + a, d / 3);
    g.gain.setTargetAtTime(0, end, r / 3);
    o.connect(g).connect(out);
    o.start(t); o.stop(stopAt);
  }
}

// ---- Wobble bass (Step 6) ---------------------------------------------------
// Notes are oscillators into the role's shared drive → lowpass (BUS.wobble is BUS.synth). The part emits one
// control event per bar ({ctl:true, rate, dur}); it schedules ONE cutoff curve on that shared filter, cancelling
// first so curves never overlap. No per-note filters or LFOs. p.wob = { lo, hi, q }: cutoff range (Hz) and Q.
// ev.rate = wobble cycles per beat (0 = hold the filter half-open). The curve starts fully open each bar.
function wobble(ctx, out, t, ev, p) {
  const tone = out.tone || out, w = p.wob;
  if (ev.ctl) {
    const f = tone.frequency;
    tone.Q.setValueAtTime(w.q, t);
    f.cancelScheduledValues(t);
    if (ev.pts) { // "talking" bass (Step 7): one smooth cutoff curve through the bar's vowel points (each 0–1 on the lo→hi log scale)
      const seg = 20, k = ev.pts.length, n = (k - 1) * seg + 1, c = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const g = Math.min(k - 2, Math.floor(i / seg)), u = (i - g * seg) / seg, e = 0.5 - 0.5 * Math.cos(Math.PI * u);
        c[i] = w.lo * (w.hi / w.lo) ** (ev.pts[g] + (ev.pts[g + 1] - ev.pts[g]) * e);
      }
      f.setValueCurveAtTime(c, t, ev.dur * 0.998);
    } else if (!ev.rate) f.setValueAtTime(w.hi * 0.6, t);
    else {
      const cycles = ev.rate * 4, n = Math.round(cycles * 24) + 1, c = new Float32Array(n);
      for (let i = 0; i < n; i++) c[i] = w.lo * (w.hi / w.lo) ** (0.5 + 0.5 * Math.cos(2 * Math.PI * cycles * i / (n - 1)));
      f.setValueCurveAtTime(c, t, ev.dur * 0.998);
    }
    // Pump (Step 7): p.pump = { depth, release } ducks the role's persistent pump gain on every beat, like a
    // sidechain from a four-on-the-floor kick. One curve per bar on ONE persistent gain, cancelled first so
    // curves never overlap. depth = how far it ducks (0–1), release = fraction of a beat to recover.
    const pg = tone.pump;
    if (pg && p.pump) {
      const per = 16, n = per * 4 + 1, c = new Float32Array(n), { depth = 0.85, release = 0.6 } = p.pump;
      for (let i = 0; i < n; i++) {
        const fr = (i / per) % 1, u = Math.min(1, fr / release);
        c[i] = i === n - 1 ? 1 : 1 - depth * (1 - u) * (1 - u);
      }
      pg.gain.cancelScheduledValues(t);
      pg.gain.setValueCurveAtTime(c, t, ev.dur * 0.998);
    }
    return;
  }
  const { a = 0.005, d = 0.1, s = 0.9, r = 0.04 } = p.amp || {};
  const dur = Math.max(ev.dur, a + 0.02), end = t + dur, stopAt = end + r * 2, peak = ev.vel * (p.gain ?? 0.2);
  for (const spec of p.osc) {
    const o = ctx.createOscillator(), g = ctx.createGain(), pk = peak * (spec.gain ?? 1);
    o.type = spec.type;
    o.frequency.value = ev.freq * (spec.mult || 1);
    o.detune.value = spec.detune || 0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(pk, t + a);
    g.gain.setTargetAtTime(pk * s, t + a, d / 3);
    g.gain.setTargetAtTime(0, end, r / 3);
    o.connect(g).connect(out);
    o.start(t); o.stop(stopAt);
  }
}

// Registry: styles reference these by name via role.kind. To add a new kind
// (e.g. a wobble bass), add a function here.
export const KINDS = { kick, snare, hat, synth, wobble };

// Buses: a kind that needs processing shared by all its notes declares it here. setStyle() calls
// BUS[kind](ctx, out, keep) once per role and passes the returned node to the kind as its `out`.
// Kinds without an entry just receive the role's gain node.
// Soft-clip curve for `drive` (cached per amount; output kept near the clean level).
const driveCache = {};
const driveCurve = k => driveCache[k] ||= Float32Array.from({ length: 2048 }, (_, i) => Math.tanh(k * ((i / 2047) * 2 - 1)) * 0.35);

export const BUS = {
  // role.drive (optional): distortion in front of the shared filter (distort first, then filter).
  synth(ctx, out, keep, role = {}) {
    const f = keep(ctx.createBiquadFilter());
    f.type = 'lowpass'; f.frequency.value = 4000; f.Q.value = 0.7;
    f.connect(out);
    if (!role.drive) return f;
    const sh = keep(ctx.createWaveShaper());
    sh.curve = driveCurve(role.drive); sh.oversample = '2x';
    sh.connect(f);
    sh.tone = f;
    return sh;
  },
};

// The wobble bus is the synth bus (drive → filter), plus, when role.pump is set, one persistent pump gain after
// the filter (Step 7). The filter keeps the pump node as `.pump`; the wobble kind automates it once per bar.
BUS.wobble = (ctx, out, keep, role = {}) => {
  if (!role.pump) return BUS.synth(ctx, out, keep, role);
  const pg = keep(ctx.createGain());
  pg.gain.value = 1; pg.connect(out);
  const bus = BUS.synth(ctx, pg, keep, role);
  (bus.tone || bus).pump = pg;
  return bus;
};
