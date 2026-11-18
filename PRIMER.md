# Chill Radio — Project Primer

> **Purpose of this file:** hand it to a brand-new Claude session (with the files listed in
> "What to upload") and it should know the goal, history, architecture, current status, the open
> stability problem, and the rules we've set. **Claude: update this file at the end of every step**
> (changelog, status, build stamp, open issues) and give the user the updated copy.

Last updated: **Step 3a (fix) — build `261117-3a`, service-worker cache `chill-radio-v0.3.1`**

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
3. After every deploy, check the **build stamp** (since 2a the app fetches fresh files whenever it's online, so it should update on the next launch; the update to 2a itself may need one extra close-and-reopen) (top right of the app) matches what was pushed. If not, fully close and reopen the app once or twice (the service worker serves cached files until the new one activates).
4. Brave → Settings → Apps → Brave → Battery → **Unrestricted** (Motorola/Android otherwise kills background audio).
5. The real test: start **Radio** mode, lock the screen, let it run hours (overnight is ideal), Bluetooth connected if possible. Try play/pause/next from the headphones.
6. Afterward, **tap the build stamp**: it shows the event log and copies it to the clipboard. Paste the log into the chat — **whether it went well or badly**.

### What to upload to a new chat (always attach PRIMER.md)
| Task | Files to attach |
|---|---|
| Anything / general | `PRIMER.md` (+ `index.html`, `js/app.js` if UI-related) |
| New style ("make me a Vaporwave") | `PRIMER.md`, the closest existing style file (e.g. `js/styles/synthwave.js` for beat-driven styles, `js/styles/lofi.js` for chord/keys-driven ones; `chillwave.js` for motif melodies), `js/styles/scenes.js`, `js/engine/parts.js`, `js/engine/instruments.js`, `js/engine/radio.js`, `js/styles/index.js`. Remember to add the new file to `ASSETS` in `sw.js` |
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
| 1a | **Stability rework** of the voice engine (see §5) after the phone glitched; richer diagnostics; this primer | **Done.** User reported several hours on the phone behind the lock screen with no glitches (previously it failed). Promising, not yet proven by a full overnight run — keep checking logs |
| 2 | Port **Synthwave** and **Darksynth** from Chillforge into style files, with the engine additions they need (bass drive, filter sweep, arp random walks, scenes), following the graph rules | **Done — awaiting listening/phone test** |
| 3a | **Lofi** style (written from scratch, sound modelled on the loop machine) + user **Swing slider** | **Done — awaiting listening/phone test** |
| 3b | **Auto-cycle** (loop machine: regenerate the loop every N minutes). Intended for Manual mode, which otherwise loops one song forever; Radio mode already advances songs | Not started |
| ~~3c~~ | ~~Visualizer~~ | **Dropped by decision** (see §8). Revisit only if wanted |
| 4 | Sound & melody pass: layered detune, soft saturation, better reverb; melody generator with motif repetition/variation, rests, chord-tone targeting; maybe a brightness/warmth control for bone-conduction | Not started |

### Changelog
- **3a fix (`261117-3a`)** — Dissonant Lofi pads/keys. Cause: my port of the loop machine's chords kept the root (its `Q[q].slice(1)` *drops* it because the bass plays the root), so inversions put the root/octave next to the 7th/9th (half-step clusters like G–G#, B–C) in the low register. Fix: role flag `rootless: true` (lofi `keys` and `pad`), and `voiceLead()` now skips inversions with a half step between neighbours, or a whole step below MIDI 55, whenever a cleaner one exists. Verified over all 12 keys × 6 progressions × 2 registers: 0 clustered voicings (was 221 of 288 in a sample). Synthwave/Darksynth pad notes were checked too: clean spread triads, same as Chillforge. Remaining by-design clash candidates there: the pad's ~0.75 s release tail overlaps the next chord (worst in Darksynth's Phrygian Dread, E minor → F major) and the supersaw's ±14-cent detune beats. Easy to shorten if it bothers (`amp.r` on the pad voices).
- **3a (`261117-3`)** — **Lofi** style (`js/styles/lofi.js`) and a **Swing slider** (0–50% of a 16th; a value you set sticks across styles until you tap "Use style default"; stored as `userSwing`, applied via `Sequencer.swing`). Engine additions (graph rules respected; the only new persistent node is the optional style tone filter):
  - `voiceLead(prev, notes, lo)` in `music.js` + `voicing()` in `parts.js`: role flag `voiceLead: true` makes `chord` and `comp` roles move to the nearest inversion of each chord (computed once per chord, state in `song.rt[roleId]`). 9th chords sit above the octave, so inversions are re-sorted each rotation (a bug the tests caught).
  - New part **`comp`**: strummed chord stabs. Pattern digits = hit length in steps, `.` = rest. Notes carry `ev.dt` (seconds); the sequencer schedules at `t + dt`.
  - Bass: `role.lo` (lowest root) and `role.maxHold` (cap note length in steps). 
  - **Wobble**: voice `vibrato: { rate, depth, sync: true }` phase-locks the pitch curve to the audio clock, so all notes drift together like the loop machine's single shared LFO (0.35 Hz, ±14 cents) **without** any node-to-node connection (the loop machine's `wobG.connect(osc.detune)` is the pattern removed in 1a). Curve resolution is now `clamp(rate*12, 10, 60)` points/s (was a fixed 60).
  - `fx.tone`: optional style-wide low-pass (Lofi: 5500 Hz, as in the loop machine) between all channels/sends and the master.
- **2a (`261117-2a`)** — Service-worker fix. Symptom: on the phone (GitHub Pages) the new build stamp showed but the new styles didn't appear in the menu (a private tab was fine). Cause (most likely): `cache.addAll()` honours the browser HTTP cache, and GitHub Pages sends `max-age=600`, so a stale `index.js` was stored under the new cache name. Fix: install fetches with `cache: 'reload'`; fetch handler is now network-first (`no-cache` revalidation, 4 s timeout) with the cached copy as the offline fallback. Offline use still works; updates no longer depend on a cache-name bump landing cleanly. No audio/engine changes.
- **2 (`261117-2`)** — Added **Synthwave** and **Darksynth** (`js/styles/synthwave.js`, `darksynth.js`) and `js/styles/scenes.js`. Engine additions, all within the graph rules (no new per-note nodes; the only new persistent node is one WaveShaper on the Darksynth bass bus):
  - `BUS.synth(ctx, out, keep, role)`: optional `role.drive` puts a soft-clip WaveShaper (tanh, oversample 2x) in front of the role's shared filter. The bus input is then the shaper and the filter hangs off it as `.tone`; `synth()` writes notes to `out` and drives `out.tone || out`.
  - Synth `filter.sweep: [lo, hi]` (Hz): cutoff glides lo→hi→lo across the whole progression (bass events carry `pos` 0–1).
  - Parts: drum pattern chars `?` (35% chance, strong hit) and `,` (60% chance, ghost); bass `role.accent` (off-beat notes softer) and `pos`; chord/arp `role.lo` (lowest root); arp `role.noteLen` (steps) and `role.accent`; arp patterns `~wander`/`~scatter` (+ optional step interval digit, e.g. `~wander2`) random walks over two octaves of chord tones, with per-song state in `song.rt`.
  - Instruments: snare `gate` (seconds): held level then sharp cut (gated snare).
  - Theory: chord types `minS`/`majS` (spread triads: root, 5th, octave, 3rd — Chillforge's voicings).
  - `scenes(table, chance)` radio `decorate` helper: Chillforge's auto-mute scenes (weighted role sets muted for 1–2 phrases, decided once per progression pass, never the first/last main phrase, never the pass right after a scene). Synthwave/Darksynth use `dropout: 0` + scenes at 25% per pass (Chillforge's default "Occasional" was 15%; tune freely).
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
js/styles/chillwave.js  Chillwave (the template for new styles; melodic, uses motifs + dropout)
js/styles/synthwave.js  Synthwave (arp + bass + supersaw pad; uses scenes)
js/styles/darksynth.js  Darksynth (adds bass drive + sweep, gated snare, eighth-note arp)
js/styles/scenes.js     radio.decorate helper: Chillforge-style auto-mute scenes
js/styles/lofi.js       Lofi (swung boom-bap, voice-led strummed keys, pad, sparse melody, tone filter, wobble)
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
- **`part`** (parts.js → note events): `drum | bass | chord | comp | arp | melody`.
- **`kind`** (instruments.js → sound): `kick | snare | hat | synth`. Params:
  - kick `{f0,f1,sweep,decay,gain,lp?,click?}` · snare `{noiseFreq,q?,decay,gain,tone?,toneDecay?,toneGain?,clap?}` · hat `{freq,decay,openDecay,gain}`
  - synth `{ osc:[{type,gain,detune,mult}], filter:{type?,freq,q?,env?,decay?}, amp:{a,d,s,r}, vibrato?:{rate,depth}, gain }`
- **Role fields (Lofi):** `voiceLead: true` (chord/comp roles: nearest-inversion voicing, skipping clustered inversions), `rootless: true` (drop the chord root from the voicing; the bass plays it), `maxHold` (bass: cap note length in steps), and `lo` also applies to bass. Part `comp`: pattern digits are hit lengths in steps (`7.....3...3...3.`); the chord is strummed low→high. Events may carry `dt` (seconds offset).
- **Style fields:** `fx.tone` (Hz, optional style-wide low-pass). Voice `vibrato.sync: true` = phase-locked shared wobble (see changelog 3a).
- **Optional role fields:** `accent` (bass/arp: off-beat notes softer), `lo` (chord/arp: lowest root MIDI note), `noteLen` (arp: note length in steps), `drive` (synth: distortion amount in front of the shared filter, e.g. 5). Synth `filter` may also have `sweep: [lo, hi]`. Snare params may have `gate` (seconds).
- **Pattern characters:** drum `x g o . ? ,` (`?` = 35% strong hit, `,` = 60% ghost); bass `r 5 o .`; arp digits (index into chord tones, wrapping up an octave), `.`, or `~wander` / `~scatter` (+ step-interval digit) for random walks.
- **Chord types** also include `minS`/`majS` (spread triads). Transposable relative progressions only: Chillforge's progressions that differed only by key were merged (see §8).
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
- Step 2 port notes: Chillforge's four Synthwave progressions had the same shape in different keys, so Chill Radio has the two distinct ones (Neon Drive, Andalusian Night) plus two new ones (Sunset Strip, Midnight Run). Darksynth's four were all distinct and are ported. Kick/snare/hat are separate mixer roles (Chillforge had one Drums channel). Chillforge's per-style master low-pass (`cutoffMul`) isn't replicated; the cutoffs are baked into voice filters (pad 2600/1500 Hz, arp 4500/3750 Hz). Chillforge's `softtri` waveform isn't ported (voices use triangle). Chillforge's manual pulldowns (pad shape, arp pattern, lead shape, bassline, variation) are now random per-song picks among `patterns`/`voices`; voices can be swapped live in the UI. **Dubstep 2 was not ported.**
- Synthwave additions beyond Chillforge: four-on-the-floor kick pattern and octave-bounce bass pattern as variety.
- Likely first things to tune by ear (levels are approximations of Chillforge's, since Chill Radio's mixer is per role and its hat/snare kinds are slightly different): hat levels and open/closed balance, snare tone, bass vs kick balance, pad/arp reverb sends, scene frequency.
- Voice tuning pass planned after all steps (user will tune voicing options).
- **Visualizer: dropped (user decision, Step 3 planning).** The app mostly runs in a pocket behind the lock screen, so the CPU/battery cost and the build effort aren't worth it. If ever revisited: canvas only, must stop all drawing and timers when `document.hidden`, driven from the audio clock (the loop machine's was a fixed 3-row drum grid + chord bar with output-latency compensation), and it must never touch the audio graph.
- Lofi notes: Chill Radio phrases are 2 bars per chord (the loop machine used 1 bar), so patterns are 32 steps (two bars). The loop machine's per-bar random drum/bass/comp variation is replaced by per-song picks among two-bar patterns. Levels in the Lofi voices were derived from the loop machine's bus gains (chord bus ×0.5, drum bus ×0.9, etc.) and are approximations to tune by ear. Lofi's default swing is 20% (the loop machine's default).

## 9. Testing notes (for Claude)
- Node can sanity-check logic but not audio: copy the project, add `{"type":"module"}` package.json, `node --check` all modules, and run a fake-`AudioContext` test (count `createBiquadFilter` / `createOscillator` over thousands of ticks; the 1a invariant is that biquad count is **constant** while notes grow).
- Don't claim audio-quality or lock-screen results from Node: those only come from the user's laptop/phone.
