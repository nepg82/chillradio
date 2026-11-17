# Chill Radio — Project Primer

> **Purpose of this file:** hand it to a brand-new Claude session (with the files listed in
> "What to upload") and it should know the goal, history, architecture, current status, the open
> stability problem, and the rules we've set. **Claude: update this file at the end of every step**
> (changelog, status, build stamp, open issues) and give the user the updated copy.

Last updated: **Step 1a — build `261116-1a`, service-worker cache `chill-radio-v0.1.1`**

---

## 1. For the human: how to use this project

### Run locally (layout / sound check on the laptop)
1. Unzip, open a terminal in the `chill-radio` folder.
2. `python3 -m http.server 8080`, then open `http://localhost:8080`.
   (Needs a server: the app uses ES modules, so double-clicking `index.html` won't work. The
   service worker deliberately does nothing on `localhost`, so files are always fresh.)

### Deploy and test on the phone (Android, Brave)
1. Push the folder to its own GitHub repo, enable GitHub Pages (HTTPS is required for the service worker).
2. Open the Pages URL in Brave, install as a PWA. Use a different repo/path than Synth Radio / Chillforge so they stay separate installs.
3. After every deploy, check the **build stamp** (top right of the app) matches what was pushed. If not, fully close and reopen the app once or twice (the service worker serves cached files until the new one activates).
4. Brave → Settings → Apps → Brave → Battery → **Unrestricted** (Motorola/Android otherwise kills background audio).
5. The real test: start **Radio** mode, lock the screen, let it run hours (overnight is ideal), Bluetooth connected if possible. Try play/pause/next from the headphones.
6. Afterward, **tap the build stamp**: it shows the event log and copies it to the clipboard. Paste the log into the chat — **whether it went well or badly**.

### What to upload to a new chat (always attach PRIMER.md)
| Task | Files to attach |
|---|---|
| Anything / general | `PRIMER.md` (+ `index.html`, `js/app.js` if UI-related) |
| New style ("make me a Synthwave") | `PRIMER.md`, `js/styles/chillwave.js` (the template), `js/engine/parts.js`, `js/engine/instruments.js`, `js/engine/radio.js`, `js/styles/index.js` |
| Stability / glitch investigation | `PRIMER.md`, `js/engine/audio.js`, `js/engine/instruments.js`, `js/engine/sequencer.js`, `js/app.js`, `js/mediasession.js`, **plus the log text** from the phone |
| UI / look | `PRIMER.md`, `index.html`, `css/style.css`, `js/app.js` |
| Not sure | Zip the whole folder (it's small, ~100 KB without icons) |

**Starter message for a new chat:**
> I'm continuing the Chill Radio project (offline generative lofi/chillwave PWA). PRIMER.md and the
> relevant source files are attached. Please read PRIMER.md first, tell me in 2–3 sentences where we
> are, then we'll continue with: *(next step / problem)*.

### Housekeeping
- Every code change: Claude bumps the build stamp (`index.html`, `#ver`) and the service-worker cache name (`sw.js`).
- App icons live at `app-icons/app-icon-192.png` and `app-icon-512.png` (the CSS background and manifest depend on those exact paths). The current icons are **placeholders**; replace with your own anytime.
- Palette: cyan `#7ef7fc` (primary actions/focus), purple `#fb18f9` (active mode/section), yellow `#fddd0c` (build stamp, tempo). Dark purple-black background.

---

## 2. The goal and the user's situation

An **offline-capable generative lofi/chill music PWA** with pads, drums, bass and melody channels, used
all day and especially at night (sleep) through **Bluetooth bone-conduction headphones** on an
**Android phone (Motorola moto one 5G) in Brave mobile**. No tape/vinyl noise. It must survive **hours
behind the lock screen** and respond to Bluetooth play/pause/next. Sound should feel organic, not
"cheap". The user wants to hand Claude **one style's file** and ask for a new style.

### Lineage: four earlier apps (zip of them was reviewed in session 1)
| App | What it contributed / its problems |
|---|---|
| **Chillforge** (single HTML + manifest + service worker) | The only one that **never** failed through the lock screen for hours. Styles: Chillwave, Synthwave, Darksynth, Dubstep 2 (bass drive/waveshaper, supersaw pad, arp patterns, scenes). Sound is a bit "cheap". Its graph is built **once** with shared filters; notes are just oscillator+gain. |
| **Synth Radio** (modular, multi-file) | Best UX and cleanest sound: chord progressions, all 12 keys, multiple voices per instrument, polish. **Base of Chill Radio.** Used to glitch → die after a track or so. |
| **Lofi loop machine** (single HTML) | Wanted: the **visualizer**, the **Swing** slider, **Auto-cycle**. Its sound (voice-led 9th chords, detune wobble, ~5.5 kHz low-pass + compressor) is liked. Also unstable over long sessions. |
| **PulseForge** | Dropped; nothing unique. |

---

## 3. Roadmap and status

| Step | Content | Status |
|---|---|---|
| 1 | Scaffold Chill Radio from Synth Radio; scheduler `try/catch`; hidden lookahead 1.5 s; drop forced 32 kHz; stereo reverb + toggle; diagnostics; new palette; rename | **Done** (built, laptop-tested) |
| 1a | **Stability rework** of the voice engine (see §5) after the phone glitched; richer diagnostics; this primer | **Done — awaiting overnight phone test** |
| 2 | Port **Synthwave** and **Darksynth** from Chillforge into style files; needs engine additions (bass drive/waveshaper, supersaw, arp patterns, scenes) — as new `KINDS`/`PARTS`/`BUS` entries, following the graph rules | Not started. **Hold until the 1a phone result is known**, or proceed if user prefers |
| 3 | **Lofi** style from the loop machine; Swing as a real slider (now a fixed per-style constant); **Auto-cycle** for Manual mode; generalize the **visualizer** to any style's roles | Not started |
| 4 | Sound & melody pass: layered detune, soft saturation, better reverb; melody generator with motif repetition/variation, rests, chord-tone targeting; maybe a brightness/warmth control for bone-conduction | Not started |

### Changelog
- **1a (`261116-1a`)** — Voice engine rewrite: per-note `BiquadFilterNode` and per-note vibrato LFO removed. Synth roles now have one **shared tone filter** (built once, `BUS.synth`) driven once per strike; vibrato is a `setValueCurveAtTime` pitch curve per oscillator; each oscillator has its own envelope gain. Per-song gain stages are no longer recreated per song: they're **persistent per-role gains** that are faded for "Next song" and reset by `newSong(at)`. Note: filter envelope is now shared across simultaneous/overlapping notes of a role (fine for chords, slightly different for overlapping bass/lead releases). New diagnostics (see §7). Release time ×2 instead of ×1.5 (smaller stop pop).
- **1 (`261116-1`)** — Scaffold, scheduler fault isolation (a throwing note is logged and skipped, clock always advances), hidden lookahead 1.5 s, removed forced `sampleRate: 32000`, reverb re-enabled (stereo IR) behind a checkbox, liveness/heartbeat/freeze/error logging, tap-build-stamp-to-copy-log, cyan/purple/yellow palette, storage keys renamed `chillradio-*`.

---

## 4. Architecture (what each file does)

```
index.html           UI markup, build stamp (#ver), registers sw.js
sw.js                offline cache (bump CACHE name on every change; no-op on localhost)
manifest.json        PWA metadata (icons at app-icons/)
css/style.css        all styling (palette variables at the top)
app-icons/           app-icon-192.png, app-icon-512.png
js/app.js            UI + glue: state, play/stop/pause, radio/manual modes, controls, diagnostics log
js/mediasession.js   lock-screen survival: silent looping WAV + navigator.mediaSession handlers + audio-focus yield logic
js/engine/audio.js   AudioEngine: one AudioContext, master chain, per-role channel graph (setStyle), play(), fade/newSong
js/engine/sequencer.js  look-ahead scheduler (Web Worker ticker, 50 ms; 0.5 s lookahead visible / 1.5 s hidden)
js/engine/instruments.js  sound generators (KINDS: kick, snare, hat, synth) + shared buses (BUS)
js/engine/parts.js   note generators (PARTS: drum, bass, chord, arp, melody)
js/engine/song.js    makeSong(): all random choices fixed for one song (key, bpm, progression, voices, patterns, motifs, title)
js/engine/radio.js   planRadio(): song + arranger (intro/main/outro, role groups entering/dropping out)
js/engine/music.js   theory helpers (chord types, scales, mtof, tools(rnd))
js/styles/index.js   registry of styles (STYLES array)
js/styles/chillwave.js  the Chillwave style (the template for new styles)
```

**Signal flow:** note → (`KINDS` function creates oscillators/noise) → role bus (`outs[role]`: shared tone filter for
synths, else the role's song gain) → `songGains[role]` → role channel gain (user mixer level) → dry to master + sends to reverb
(`rev`) and tempo-synced delay (`dly`) → master (compressor/limiter) → output. Master → `ctx.destination`.

**Playback flow:** Play tap → `mediasession.start()` (silent audio element; must be synchronous in the tap) →
`engine.start()` → `engine.setStyle()` builds the graph → `nextRadio()` or `startManual()` → `Sequencer.start()` ticks from a
Worker, each tick schedules notes ahead of the audio clock → at song end, a gap on the audio clock, then `onEnd` starts the next song.

---

## 5. THE open problem: glitch/death over long sessions (read this first when debugging)

**Symptoms (observed on the phone with Synth Radio and with Chill Radio step 1):** after a long time behind the lock
screen: dropouts in quiet intros → skipping → skips get longer → silence. The UI keeps animating and counting phrases
(so the main thread, Worker ticker and scheduler are fine and the AudioContext reports running). Unlocking does not fix it.
It **never recovers within the same track; skipping to a new track fixes it.** The log showed nothing relevant (no errors).
On the laptop (20+ min) it was fine.

**Therefore:** the *audio rendering thread* degrades, and the state that causes it is scoped to something torn down on a
new song. Ruled out / unlikely: scheduler exceptions (hardened in step 1, no effect), forced 32 kHz sample rate, reverb
convolver (failed with it disabled), browser throttling, audio-focus loss.

**Leading theory (unproven):** *per-note* `BiquadFilterNode`s (and per-note LFO → `detune` connections) — Synth Radio created
one filter + LFO per tonal note; the Lofi loop machine created a filter per noise hit; Chillforge (stable) creates filters only
once on shared buses (its Dubstep 2 style is the exception and has not been run for hours). Thousands of short-lived chains
hanging off a long-lived node may accumulate on the audio thread. The on-and-off silence during sparse intros is the part this
explains least.

**Step 1a** removed those patterns. **The overnight phone test of 1a decides what's next:**
- Survives → theory confirmed; continue with Step 2, keeping the graph rules below.
- Fails → next suspects: the shared feedback delay loop / denormals in quiet passages, compressor state, persistent per-role gains, sparse-intro behavior (try playing with Reverb off, or inspect `lag=` / `fb=` in the log; consider voice pooling or a Chillforge-style full rebuild per song).

### Audio graph rules (all new styles/kinds MUST follow these)
1. **Notes are transient sources feeding long-lived destinations. Never the reverse.** No per-note filters, no per-note LFOs, no connecting a persistent node's output into a per-note param (e.g. a shared LFO → `osc.detune`).
2. **Shared processing is built once in `setStyle()`** via `BUS[kind]` (e.g. a role's tone filter); it's driven with automation once per strike (dedupe on strike time, as `synth()` does with `tone.lastT`).
3. Per-note vibrato/pitch motion = `setValueCurveAtTime` on that oscillator's own param.
4. Per-hit noise: one `AudioBufferSource` from a shared cached buffer through a *shared* filter (`sharedFilter(ctx, out, type, freq)`), never a new filter per hit.
5. Everything created per note must stop itself (`osc.stop`, source `stop`); stop times include the full release tail.
6. Nodes created in `setStyle`/`BUS` go through `keep()` so `_teardown` can disconnect them.
7. The scheduler must never be able to stall: per-event `try/catch`, clock always advances (already in `sequencer.js`).

---

## 6. Style data reference (a style is plain data: `js/styles/<id>.js`, registered in `styles/index.js`)

```js
export default {
  id, name,
  bpm: { min, max, def },
  swing: 0.14,                 // off-beat 16th delay as a fraction of a 16th (planned: user slider in Step 3)
  names: { adj: [...], noun: [...] },          // song titles
  fx: { reverb: { seconds, decay }, delay: { beats, feedback, lp } },
  progressions: [ { name, scale: 'minor'|'major'|'dorian'|..., chords: [ {r: semitones from key, t: chordType}, ... ] } ],
                               // each chord lasts one phrase (2 bars); chordType keys live in music.js CHORD_TYPES
  roles: [ {
    id, label, part, kind, mix /*dB*/, send: { rev, dly }?,
    patterns: ['x...','...'],  // 16 or 32 chars; chosen per song. drum: x hit, g ghost, o open(hat), . rest
                               // bass: r root, 5 fifth, o octave, . rest   arp: digit = chord-tone index, . rest
    rhythms: [[[step,len],...]], range: [lo,hi],  // melody part only
    voices: [ { name, p: <params for the kind> } ],  // one voice picked per song, swappable live in the UI
  } ],
  radio: { groups: [[roleIds]...], openers: [[...]], dropout: 0.35, decorate?(plan, {song,R,groups}) },
};
```
- **`part`** (parts.js → note events): `drum | bass | chord | arp | melody`.
- **`kind`** (instruments.js → sound): `kick | snare | hat | synth`. Params:
  - kick `{f0,f1,sweep,decay,gain,lp?,click?}` · snare `{noiseFreq,q?,decay,gain,tone?,toneDecay?,toneGain?,clap?}` · hat `{freq,decay,openDecay,gain}`
  - synth `{ osc:[{type,gain,detune,mult}], filter:{type?,freq,q?,env?,decay?}, amp:{a,d,s,r}, vibrato?:{rate,depth}, gain }`
- **New behaviour** = add a function to `PARTS` (note generation) or `KINDS` (+ `BUS` if it needs shared processing) and reference it from the style. Keep the graph rules (§5).
- Radio mode: `radio.groups` enter together in the intro and leave in the outro; one `openers` group starts; `dropout` is the chance a main phrase mutes 1–2 groups; `decorate` can add builds/drops.

---

## 7. Diagnostics: reading the log (tap the build stamp; also copied to clipboard)

| Line | Meaning |
|---|---|
| `session start/stopped: N songs in Xh Ym` | Session boundaries |
| `PREV SESSION ENDED WHILE PLAYING … discarded=…` | At boot: the page was killed while playing (browser/OS killed it) |
| `song #N "Title" BPM (prev song notes=K)` | New song; K = notes scheduled in the previous song (look for the count at which glitches begin) |
| `hb ctx=… ct=… vis=… lag=…ms notes=total/song fb=…/…ms lat=…ms mem=…` | Heartbeat every 2 min. **`lag`** = audio clock vs wall clock (ms; grows if the audio thread stalls). **`notes`** = notes scheduled this session / this song. **`fb=events/ms`** = browser underrun ("fallback frames") counters if Brave exposes `playoutStats` (`po=n/a` if not). `ctx=` should be `running` |
| `ctx suspended/running/interrupted` | AudioContext state changes |
| `RESYNC N ms behind at phrase P` | Scheduler woke up late and skipped ahead |
| `ERR step N: …` | A note threw and was skipped (throttled to 1 per 5 s) |
| `page freeze/resume`, `pagehide`, `page hidden/visible`, `media session: …`, `handoff N ms …`, `song setup N ms` | Lifecycle / lock-screen events |

**What to look for after a bad session:** does `lag` or `fb` start climbing before the audible glitch? At what `notes=…/…` count (per song or total)? Does it begin right after a particular event (screen lock, song handoff)?

---

## 8. Open questions / decisions log
- Base architecture decision (session 1): build on **Synth Radio's modular structure**, port Chillforge's stability discipline and styles; Pulseforge dropped.
- App name: **Chill Radio** (alternatives floated: Nightshift Radio, Lowlight FM, Hush FM).
- Has the user ever left Chillforge's *Dubstep 2* running for hours? (It uses per-hit filters — a useful data point for the theory.)
- Voice tuning pass planned after all steps (user will tune voicing options).
- Visualizer for Step 3 must be generic over a style's roles (the loop machine's is a fixed 3-row drum grid + chord bar, synced to the audio clock with output-latency compensation).

## 9. Testing notes (for Claude)
- Node can sanity-check logic but not audio: copy the project, add `{"type":"module"}` package.json, `node --check` all modules, and run a fake-`AudioContext` test (count `createBiquadFilter` / `createOscillator` over thousands of ticks; the 1a invariant is that biquad count is **constant** while notes grow).
- Don't claim audio-quality or lock-screen results from Node: those only come from the user's laptop/phone.
