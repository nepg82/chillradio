// scenes.js — Radio "variation" for styles that want it (ported from Chillforge's auto-mute scenes).
// Use as a style's radio.decorate:  decorate: scenes([{ mute: ['arp'], w: 3 }, ...], 0.25)
// At the start of every 4th main phrase (a pass through the progression) there is a `chance` of a
// scene: a weighted set of roles is muted for 1–2 phrases (2–4 bars). The first main phrase, the last
// one, and the pass right after a scene always play in full.
export const scenes = (table, chance = 0.25) => (plan, { R }) => {
  const main = plan.filter(p => p.section === 'Main');
  const total = table.reduce((a, s) => a + s.w, 0);
  let skip = 1;
  for (let k = 0; k < main.length; k += 4) {
    if (skip) { skip--; continue; }
    if (!R.chance(chance)) continue;
    let r = R.rnd() * total;
    const { mute } = table.find(s => (r -= s.w) < 0) || table[0];
    const len = R.pick([1, 2]);
    for (let j = k; j < k + len && j < main.length - 1; j++) mute.forEach(id => main[j].active.delete(id));
    skip = 1;
  }
};
