// The ore ladder's colour roles (PRD sec 26): tier twins of the ore sprite's roles, derived from the tier-1 colours.
// Run from the repo root. Idempotent: re-derives every t2/t3 role from its tier-1 source.
import { readFileSync, writeFileSync } from 'node:fs';
const f = 'packages/content/assets/palette.json';
const text = readFileSync(f, 'utf8');
const p = JSON.parse(text);
const toHsl = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const l = (mx + mn) / 2; const d = mx - mn;
  return { s: d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), l };
};
const toHex = (h, s, l) => {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
};
const HUE = { 2: 212, 3: 268 };
// The ORE glows in its substance's colour; the ROCK that carries it takes a tint, so the whole formation reads at a glance.
const ORE = /^terrain\.ore_slate\.(ore|mineral|ore_shine_\d)$/;
const ROCK = /^terrain\.ore_slate\.(slate|facet|cleft|wall)$/;
const FLAT = /^terrain\.ore\.(mid|lit)$/;
const out = {};
for (const [k, v] of Object.entries(p.roles)) {
  if (/^terrain\.ore[23]\.|^terrain\.ore_slate\.t[23]\./.test(k)) continue; // re-derived below, beside its source
  out[k] = v;
  const ore = ORE.exec(k), rock = ROCK.exec(k), flat = FLAT.exec(k);
  if (!ore && !rock && !flat) continue;
  const { s, l } = toHsl(v);
  for (const tier of [2, 3]) {
    const name = flat ? `terrain.ore${tier}.${flat[1]}` : `terrain.ore_slate.t${tier}.${(ore ?? rock)[1]}`;
    out[name] = rock ? toHex(HUE[tier], 0.42, l) : toHex(HUE[tier], Math.min(1, Math.max(0.85, s * 1.5)), Math.min(0.82, l + 0.08));
  }
}
p.roles = out;
const indent = /\n( +)"roles"/.exec(text)?.[1].length ?? 2;
writeFileSync(f, JSON.stringify(p, null, indent) + (text.endsWith('\n') ? '\n' : ''));
for (const k of Object.keys(out)) if (/ore[23]\.|\.t[23]\./.test(k)) console.log(k, out[k]);
