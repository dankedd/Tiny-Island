import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/800.css';
import '@fontsource/nunito/500.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import './styles.css';
import { CONFIG } from './game/config';
import { gridCells, key, parse, toPixel } from './game/hex';
import {
  canFish, canPay, canPlace, bestDockLevel, formatYield, isStormNight, newGame, place,
  resolveFish, score, stormPower, totals, upgrade, upgradeCost, yieldOf,
} from './game/rules';
import { TILES } from './game/tiles';
import type { GameState, NightReport } from './game/types';
import { tap } from './feedback';
import { loadBest, loadGame, saveBest, saveGame } from './storage';

const root = document.getElementById('app')!;
const cells = gridCells(CONFIG.gridRadius);
const RES = [
  ['voedsel', '🐟', 'voedsel'], ['hout', '🪵', 'hout'], ['steen', '🧱', 'steen'],
  ['parels', '🦪', 'parels'], ['bew', '👥', 'bewoners'], ['def', '🛡️', 'verdediging'],
] as const;

let S: GameState;
let best = 0;
let selCard: number | null = null;
let pending: string | null = null;
let selTile: string | null = null;
let flash: Record<string, boolean> = {};

const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// ---------- screens ----------
function startScreen(hasSave: boolean): void {
  root.innerHTML = `
    <div class="start">
      <div class="island" aria-hidden="true">🏝️</div>
      <h1>Eilandrijk</h1>
      <p>Bouw je eiland tegel voor tegel, vis in de baai en houd de Nevelrovers buiten.</p>
      <div class="stack">
        ${hasSave ? '<button class="btn" id="sGo">Verder spelen</button>' : ''}
        <button class="btn ${hasSave ? 'ghost' : ''}" id="sNew">Nieuw eiland</button>
        <button class="btn ghost" id="sHow">Hoe speel je?</button>
      </div>
      ${best ? `<p>Record: <b>${best}</b></p>` : ''}
    </div>`;
  if (hasSave) $('sGo').onclick = () => { tap(); gameScreen(); };
  $('sNew').onclick = () => { tap(); S = newGame(); void saveGame(S); gameScreen(); };
  $('sHow').onclick = () => howTo();
}

function howTo(): void {
  modal(`<h2>Hoe speel je?</h2><div class="howto"><ul>
    <li>Kies elke beurt één van drie tegels en leg hem aan je eiland. Tik twee keer op een geel vak om te plaatsen.</li>
    <li>Na ${CONFIG.turnsPerDay} beurten valt de nacht: je eiland levert grondstoffen op en je bewoners eten.</li>
    <li>Tik op een tegel op je eiland om hem te upgraden met hout, steen en parels.</li>
    <li>Elke ${CONFIG.stormEvery}e nacht vallen de Nevelrovers aan. Wachttorens houden ze tegen.</li>
    <li>Met een steiger kun je één keer per dag vissen.</li>
    <li>Na ${CONFIG.days} dagen telt je score: bewoners, parels en niveaus.</li>
  </ul></div><button class="btn" id="mOk">Begrepen</button>`);
  $('mOk').onclick = closeModal;
}

function gameScreen(): void {
  root.innerHTML = `
    <div class="app">
      <div class="topbar">
        <div class="brand" id="home" role="button" tabindex="0">Eilandrijk</div>
        <div class="daybox"><div><b id="dayLbl"></b> · score <b id="scoreLbl"></b></div><div class="dots" id="dots"></div></div>
      </div>
      <div style="display:grid;gap:6px"><div class="res" id="res"></div><div class="banner" id="banner"></div></div>
      <div class="board" id="board"></div>
      <div class="panel"><div class="info" id="info"></div><div class="hand" id="hand"></div><div class="actions" id="actions"></div></div>
    </div>
    <div class="overlay" id="overlay" hidden><div class="modal" id="modal"></div></div>`;
  $('home').onclick = () => startScreen(true);
  selCard = pending = selTile = null;
  render();
  if (S.over) showEnd(['Dit eiland is klaar.']);
}

// ---------- modal ----------
function ensureOverlay(): void {
  if (!document.getElementById('overlay')) {
    root.insertAdjacentHTML('beforeend', '<div class="overlay" id="overlay" hidden><div class="modal" id="modal"></div></div>');
  }
}
function modal(html: string): void {
  ensureOverlay();
  $('modal').innerHTML = html;
  $('overlay').hidden = false;
  setTimeout(() => document.getElementById('mOk')?.focus(), 30);
}
function closeModal(): void {
  $('overlay').hidden = true;
  if (document.getElementById('board')) render();
}

// ---------- game flow ----------
function doPlace(k: string): void {
  if (selCard === null) return;
  const [q, r] = parse(k);
  const report = place(S, selCard, q, r);
  tap();
  selCard = null; pending = null; selTile = k; flash = {};
  void saveGame(S);
  render();
  if (report) showNight(report);
}

function showNight(rep: NightReport): void {
  tap(true);
  if (rep.gameOver) { showEnd(rep.lines, rep.title); return; }
  const next = isStormNight(S.day)
    ? `Let op: vannacht komt een stormnacht met kracht ${stormPower(S)}.`
    : 'Morgen is het rustig op zee.';
  modal(`<h2>${rep.title}</h2><ul>${rep.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul><div class="small">${next}</div><button class="btn" id="mOk">Begin dag ${S.day}</button>`);
  $('mOk').onclick = closeModal;
}

function showEnd(lines: string[], title = `Je rijk na ${CONFIG.days} dagen`): void {
  const sc = score(S);
  const isBest = sc > best;
  if (isBest) { best = sc; void saveBest(sc); }
  modal(`<h2>${title}</h2><ul>${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
    <div><div class="small">Eindscore</div><div class="big">${sc}</div><div class="small">${isBest ? 'Nieuw record!' : `Record: ${best}`}</div></div>
    <button class="btn" id="mOk">Nieuw eiland</button>`);
  $('mOk').onclick = () => { S = newGame(); void saveGame(S); closeModal(); };
}

function fish(): void {
  if (!canFish(S)) return;
  const f = CONFIG.fishing;
  const w = f.zoneBase + f.zonePerLevel * (bestDockLevel(S) - 1);
  const start = 0.1 + Math.random() * (0.8 - w);
  const speed = 0.0024 + Math.random() * 0.0008;
  const t0 = performance.now();
  let pos = 0, raf = 0, done = false;
  modal(`<h2>Vissen</h2><div class="small">Tik op <b>Binnenhalen</b> als het streepje in het groene vak staat. Het gele midden levert misschien een parel op.</div>
    <div class="track"><div class="zone" style="left:${start * 100}%;width:${w * 100}%"><div class="perfect"></div></div><div class="marker" id="mk"></div></div>
    <button class="btn" id="mOk">Binnenhalen</button>`);
  const mk = $('mk');
  const loop = (now: number) => {
    pos = (Math.sin((now - t0) * speed - Math.PI / 2) + 1) / 2;
    mk.style.left = `${pos * 100}%`;
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  $('mOk').onclick = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    const res = resolveFish(S, (pos - start) / w);
    tap(res.kind !== 'miss');
    void saveGame(S);
    const msg = res.kind === 'perfect' ? `Perfect! Een glanzende parelvis: +${res.food} voedsel en +1 parel.`
      : res.kind === 'good' ? `Mooie vangst: +${res.food} voedsel.`
      : 'Hij glipte weg. Je hield 1 klein visje over: +1 voedsel.';
    modal(`<h2>Vissen</h2><div>${msg}</div><div class="small">Morgen kun je weer vissen. Een hogere steiger maakt het groene vak breder.</div><button class="btn" id="mOk">Terug naar je eiland</button>`);
    $('mOk').onclick = closeModal;
  };
}

// ---------- render ----------
function hexPts(cx: number, cy: number, s: number): string {
  const p: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    p.push(`${(cx + s * Math.cos(a)).toFixed(1)},${(cy + s * Math.sin(a)).toFixed(1)}`);
  }
  return p.join(' ');
}

function render(): void {
  const { pop, def } = totals(S);
  const vals: Record<string, number> = { ...S.res, bew: pop, def };
  $('res').innerHTML = RES.map(([k, i, l]) =>
    `<div class="r${flash[k] ? ' flash' : ''}"><div class="i">${i}</div><div class="v">${vals[k]}</div><div class="l">${l}</div></div>`).join('');
  $('dayLbl').textContent = `Dag ${S.day} van ${CONFIG.days}`;
  $('scoreLbl').textContent = String(score(S));
  const inDay = S.turn % CONFIG.turnsPerDay;
  $('dots').innerHTML = Array.from({ length: CONFIG.turnsPerDay }, (_, i) =>
    `<div class="dot${i < inDay ? ' done' : ''}${i === CONFIG.turnsPerDay - 1 ? ' night' : ''}"></div>`).join('');
  const ban = $('banner');
  const left = CONFIG.turnsPerDay - inDay;
  if (isStormNight(S.day)) {
    ban.className = 'banner storm';
    ban.innerHTML = `<span>🌩️ Stormnacht vannacht: kracht ${stormPower(S)}</span><span>jouw verdediging ${def}</span>`;
  } else {
    ban.className = 'banner';
    ban.innerHTML = `<span>🌙 Nog ${left} ${left === 1 ? 'beurt' : 'beurten'} tot de nacht</span><span>nodig: ${pop} voedsel</span>`;
  }

  const size = 30;
  const cur = selCard !== null ? S.offers[selCard] : null;
  let svg = '';
  for (const [q, r] of cells) {
    const { x, y } = toPixel(q, r, size);
    const k = key(q, r);
    const v = S.tiles[k];
    if (v) {
      const T = TILES[v.t];
      svg += `<g data-k="${k}"><polygon class="hex-land${selTile === k ? ' sel' : ''}" points="${hexPts(x, y, size - 1.5)}" fill="${T.kleur}"/>`;
      svg += `<text class="tile-icon" x="${x}" y="${y - 2}">${T.icoon}</text>`;
      if (v.t !== 'ruine') for (let i = 0; i < v.l; i++) svg += `<circle class="pip" cx="${x - (v.l - 1) * 5 + i * 10}" cy="${y + 17}" r="3.2"/>`;
      svg += '</g>';
    } else {
      const ok = cur !== null && canPlace(S, q, r, cur);
      const isP = pending === k;
      svg += `<g data-k="${k}"><polygon class="${isP ? 'hex-pending' : ok ? 'hex-valid' : 'hex-sea'}" points="${hexPts(x, y, size - 2)}"/>`;
      if (isP && cur) svg += `<text class="tile-icon" x="${x}" y="${y - 3}" style="opacity:.75">${TILES[cur].icoon}</text>`;
      svg += '</g>';
    }
  }
  const R = CONFIG.gridRadius;
  const W = size * Math.sqrt(3) * (2 * R + 1) + 8, H = size * (3 * R + 2) + 8;
  $('board').innerHTML = `<svg viewBox="${-W / 2} ${-H / 2} ${W} ${H}" role="img" aria-label="Je eiland">${svg}</svg>`;

  const info = $('info');
  let acts = '';
  if (S.over) {
    info.innerHTML = `Het spel is voorbij. Eindscore <b>${score(S)}</b>.`;
  } else if (pending && cur) {
    const [q, r] = parse(pending);
    info.innerHTML = `<b>${TILES[cur].naam}</b> hier levert ${formatYield(yieldOf(S, q, r, cur, 1))} per nacht. Tik nog een keer op het vak of op Plaatsen.`;
    acts += '<button class="btn" id="aPlace">Plaatsen</button><button class="btn ghost" id="aCancel">Ander vak</button>';
  } else if (cur) {
    info.innerHTML = `<b>${TILES[cur].naam}</b>: ${TILES[cur].uitleg} Kies een geel vak aan je kust.`;
  } else if (selTile && S.tiles[selTile]) {
    const v = S.tiles[selTile];
    const [q, r] = parse(selTile);
    const T = TILES[v.t];
    const c = upgradeCost(v);
    const lvl = v.t === 'ruine' ? '' : ` (niveau ${v.l})`;
    const now = ['akker', 'bos', 'steen', 'steiger'].includes(v.t) ? ` Nu: ${formatYield(yieldOf(S, q, r, v.t, v.l))}.` : '';
    info.innerHTML = `<b>${T.naam}${lvl}</b>: ${T.uitleg}${now}`;
    if (c) {
      const txt = Object.entries(c).map(([n, a]) => `${a} ${n}`).join(', ');
      acts += `<button class="btn" id="aUp"${canPay(S, c) ? '' : ' disabled'}>${v.t === 'ruine' ? 'Herbouw' : 'Upgrade'}: ${txt}</button>`;
    } else acts += '<span class="small" style="color:var(--muted)">Maximaal niveau.</span>';
  } else {
    info.innerHTML = 'Kies een van de drie tegels hieronder en leg hem aan je eiland. Tik op een tegel op het eiland om hem te upgraden.';
  }
  acts += '<button class="btn ghost" id="aMenu" style="margin-left:auto">Menu</button>';
  $('actions').innerHTML = acts;

  const hasDock = bestDockLevel(S) > 0;
  $('hand').innerHTML = S.offers.map((t, i) =>
    `<button class="card${selCard === i ? ' on' : ''}" data-i="${i}"${S.over ? ' disabled' : ''}><span class="ci">${TILES[t].icoon}</span><span class="cn">${TILES[t].naam}</span></button>`).join('')
    + `<button class="btn fishbtn" id="aFish"${canFish(S) ? '' : ' disabled'} title="${!hasDock ? 'Bouw eerst een steiger' : S.fished ? 'Morgen weer' : 'Ga vissen'}"><span>🎣</span>${S.fished ? 'morgen' : 'vissen'}</button>`;

  $('hand').querySelectorAll<HTMLButtonElement>('.card').forEach(b => {
    b.onclick = () => { const i = Number(b.dataset.i); selCard = selCard === i ? null : i; pending = null; selTile = null; flash = {}; tap(); render(); };
  });
  $('aFish').onclick = fish;
  $('aMenu').onclick = () => startScreen(true);
  document.getElementById('aPlace')?.addEventListener('click', () => pending && doPlace(pending));
  document.getElementById('aCancel')?.addEventListener('click', () => { pending = null; render(); });
  document.getElementById('aUp')?.addEventListener('click', () => {
    if (selTile && upgrade(S, selTile)) { tap(true); void saveGame(S); render(); }
  });
  $('board').querySelectorAll<SVGGElement>('g[data-k]').forEach(g => {
    g.addEventListener('click', () => {
      if (S.over) return;
      const k = g.dataset.k!;
      const [q, r] = parse(k);
      if (S.tiles[k]) { selTile = selTile === k ? null : k; selCard = null; pending = null; flash = {}; render(); return; }
      if (cur && canPlace(S, q, r, cur)) {
        if (pending === k) doPlace(k);
        else { pending = k; tap(); render(); }
      }
    });
  });
}

// ---------- boot ----------
(async () => {
  best = await loadBest();
  const saved = await loadGame();
  S = saved ?? newGame();
  startScreen(!!saved && !saved.over && saved.turn > 0);
})();
