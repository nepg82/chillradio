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
    const d = last ? p.decay : 0.012;
    const n = noiseSrc(ctx, t + off, d + 0.05), g = ctx.createGain();
    decayEnv(g, t + off, ev.vel * p.gain, d);
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

function vibratoCurve(base, v, dur) {
  const n = Math.min(2000, Math.max(2, Math.ceil(dur * 60)));
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = base + v.depth * Math.sin(2 * Math.PI * v.rate * dur * i / (n - 1));
  return c;
}

function synth(ctx, tone, t, ev, p) {
  const { a = 0.01, d = 0.2, s = 0.6, r = 0.2 } = p.amp || {};
  const dur = Math.max(ev.dur, a + 0.02);
  const end = t + dur, stopAt = end + r * 2;
  const peak = ev.vel * (p.gain ?? 0.2);

  if (tone.lastT !== t) { // chord notes share one strike time, so the filter is set once per strike
    tone.lastT = t;
    const fp = p.filter || {}, base = fp.freq || 4000, type = fp.type || 'lowpass';
    if (tone.type !== type) tone.type = type;
    tone.Q.setValueAtTime(fp.q || 0.7, t);
    tone.frequency.setValueAtTime(base + (fp.env || 0), t);
    if (fp.env) tone.frequency.setTargetAtTime(base, t, (fp.decay || 0.3) / 3);
  }
  for (const spec of p.osc) {
    const o = ctx.createOscillator(), g = ctx.createGain(), pk = peak * (spec.gain ?? 1);
    o.type = spec.type;
    o.frequency.value = ev.freq * (spec.mult || 1);
    if (p.vibrato) o.detune.setValueCurveAtTime(vibratoCurve(spec.detune || 0, p.vibrato, stopAt - t), t, stopAt - t);
    else o.detune.value = spec.detune || 0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(pk, t + a);
    g.gain.setTargetAtTime(pk * s, t + a, d / 3);
    g.gain.setTargetAtTime(0, end, r / 3);
    o.connect(g).connect(tone);
    o.start(t); o.stop(stopAt);
  }
}

// Registry: styles reference these by name via role.kind. To add a new kind
// (e.g. a wobble bass), add a function here.
export const KINDS = { kick, snare, hat, synth };

// Buses: a kind that needs processing shared by all its notes declares it here. setStyle() calls
// BUS[kind](ctx, out, keep) once per role and passes the returned node to the kind as its `out`.
// Kinds without an entry just receive the role's gain node.
export const BUS = {
  synth(ctx, out, keep) {
    const f = keep(ctx.createBiquadFilter());
    f.type = 'lowpass'; f.frequency.value = 4000; f.Q.value = 0.7;
    f.connect(out);
    return f;
  },
};
