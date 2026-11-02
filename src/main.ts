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
import { GAME_NAME } from './game/brand';
import type { GameState, NightReport } from './game/types';
import { tap } from './feedback';
import { loadBest, loadGame, saveBest, saveGame } from './storage';

const root = document.getElementById('app')!;
const cells = gridCells(CONFIG.gridRadius);
const RES = [
  ['food', '🐟', 'food'], ['wood', '🪵', 'wood'], ['stone', '🧱', 'stone'],
  ['pearls', '🦪', 'pearls'], ['pop', '👥', 'people'], ['def', '🛡️', 'defence'],
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
      <h1>${GAME_NAME}</h1>
      <p>Build your island, go fishing and keep the Fog Pirates away!</p>
      <div class="stack">
        ${hasSave ? '<button class="btn" id="sGo">Keep playing</button>' : ''}
        <button class="btn ${hasSave ? 'ghost' : ''}" id="sNew">New island</button>
        <button class="btn ghost" id="sHow">How to play</button>
      </div>
      ${best ? `<p>Best score: <b>${best}</b></p>` : ''}
    </div>`;
  if (hasSave) $('sGo').onclick = () => { tap(); gameScreen(); };
  $('sNew').onclick = () => { tap(); S = newGame(); void saveGame(S); gameScreen(); };
  $('sHow').onclick = () => howTo();
}

function howTo(): void {
  modal(`<h2>How to play</h2><div class="howto"><ul>
    <li>Pick a tile and put it next to your island. Tap a yellow spot two times.</li>
    <li>After ${CONFIG.turnsPerDay} turns it gets dark. Your island makes food, wood and stone, and your people eat.</li>
    <li>Tap a tile on your island to make it bigger and better.</li>
    <li>Some nights the Fog Pirates come. Towers keep them away.</li>
    <li>Build a dock to go fishing once a day.</li>
    <li>After ${CONFIG.days} days you get your score. More people and pearls means more points!</li>
  </ul></div><button class="btn" id="mOk">Let's play!</button>`);
  $('mOk').onclick = closeModal;
}

function gameScreen(): void {
  root.innerHTML = `
    <div class="app">
      <div class="topbar">
        <div class="brand" id="home" role="button" tabindex="0">${GAME_NAME}</div>
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
  if (S.over) showEnd(['This island is finished.']);
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
    ? `Watch out! The Fog Pirates come tonight (strength ${stormPower(S)}).`
    : 'Tonight the sea will be calm.';
  modal(`<h2>${rep.title}</h2><ul>${rep.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul><div class="small">${next}</div><button class="btn" id="mOk">Start day ${S.day}</button>`);
  $('mOk').onclick = closeModal;
}

function showEnd(lines: string[], title = `Your island after ${CONFIG.days} days`): void {
  const sc = score(S);
  const isBest = sc > best;
  if (isBest) { best = sc; void saveBest(sc); }
  modal(`<h2>${title}</h2><ul>${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
    <div><div class="small">Your score</div><div class="big">${sc}</div><div class="small">${isBest ? 'New best score!' : `Best score: ${best}`}</div></div>
    <button class="btn" id="mOk">New island</button>`);
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
  modal(`<h2>Fishing</h2><div class="small">Tap <b>Catch!</b> when the line is in the green part. Hit the yellow middle for a pearl!</div>
    <div class="track"><div class="zone" style="left:${start * 100}%;width:${w * 100}%"><div class="perfect"></div></div><div class="marker" id="mk"></div></div>
    <button class="btn" id="mOk">Catch!</button>`);
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
    const msg = res.kind === 'perfect' ? `Perfect! A shiny pearl fish: +${res.food} food and +1 pearl.`
      : res.kind === 'good' ? `Nice catch: +${res.food} food.`
      : 'Oops, it got away. You found 1 tiny fish: +1 food.';
    modal(`<h2>Fishing</h2><div>${msg}</div><div class="small">You can fish again tomorrow. A better dock makes the green part bigger.</div><button class="btn" id="mOk">Back to my island</button>`);
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
  const vals: Record<string, number> = { ...S.res, pop, def };
  $('res').innerHTML = RES.map(([k, i, l]) =>
    `<div class="r${flash[k] ? ' flash' : ''}"><div class="i">${i}</div><div class="v">${vals[k]}</div><div class="l">${l}</div></div>`).join('');
  $('dayLbl').textContent = `Day ${S.day} of ${CONFIG.days}`;
  $('scoreLbl').textContent = String(score(S));
  const inDay = S.turn % CONFIG.turnsPerDay;
  $('dots').innerHTML = Array.from({ length: CONFIG.turnsPerDay }, (_, i) =>
    `<div class="dot${i < inDay ? ' done' : ''}${i === CONFIG.turnsPerDay - 1 ? ' night' : ''}"></div>`).join('');
  const ban = $('banner');
  const left = CONFIG.turnsPerDay - inDay;
  if (isStormNight(S.day)) {
    ban.className = 'banner storm';
    ban.innerHTML = `<span>🏴‍☠️ Pirates tonight: strength ${stormPower(S)}</span><span>your defence ${def}</span>`;
  } else {
    ban.className = 'banner';
    ban.innerHTML = `<span>🌙 ${left} ${left === 1 ? 'turn' : 'turns'} until night</span><span>people need ${pop} food</span>`;
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
      svg += `<g data-k="${k}"><polygon class="hex-land${selTile === k ? ' sel' : ''}" points="${hexPts(x, y, size - 1.5)}" fill="${T.color}"/>`;
      svg += `<text class="tile-icon" x="${x}" y="${y - 2}">${T.icon}</text>`;
      if (v.t !== 'ruin') for (let i = 0; i < v.l; i++) svg += `<circle class="pip" cx="${x - (v.l - 1) * 5 + i * 10}" cy="${y + 17}" r="3.2"/>`;
      svg += '</g>';
    } else {
      const ok = cur !== null && canPlace(S, q, r, cur);
      const isP = pending === k;
      svg += `<g data-k="${k}"><polygon class="${isP ? 'hex-pending' : ok ? 'hex-valid' : 'hex-sea'}" points="${hexPts(x, y, size - 2)}"/>`;
      if (isP && cur) svg += `<text class="tile-icon" x="${x}" y="${y - 3}" style="opacity:.75">${TILES[cur].icon}</text>`;
      svg += '</g>';
    }
  }
  const R = CONFIG.gridRadius;
  const W = size * Math.sqrt(3) * (2 * R + 1) + 8, H = size * (3 * R + 2) + 8;
  $('board').innerHTML = `<svg viewBox="${-W / 2} ${-H / 2} ${W} ${H}" role="img" aria-label="Your island">${svg}</svg>`;

  const info = $('info');
  let acts = '';
  if (S.over) {
    info.innerHTML = `Game over! Your score: <b>${score(S)}</b>.`;
  } else if (pending && cur) {
    const [q, r] = parse(pending);
    info.innerHTML = `A <b>${TILES[cur].name}</b> here gives ${formatYield(yieldOf(S, q, r, cur, 1))} each night. Tap again to place it.`;
    acts += '<button class="btn" id="aPlace">Place</button><button class="btn ghost" id="aCancel">Other spot</button>';
  } else if (cur) {
    info.innerHTML = `<b>${TILES[cur].name}</b>: ${TILES[cur].info} Pick a yellow spot.`;
  } else if (selTile && S.tiles[selTile]) {
    const v = S.tiles[selTile];
    const [q, r] = parse(selTile);
    const T = TILES[v.t];
    const c = upgradeCost(v);
    const lvl = v.t === 'ruin' ? '' : ` (level ${v.l})`;
    const now = ['field', 'forest', 'quarry', 'dock'].includes(v.t) ? ` Now: ${formatYield(yieldOf(S, q, r, v.t, v.l))}.` : '';
    info.innerHTML = `<b>${T.name}${lvl}</b>: ${T.info}${now}`;
    if (c) {
      const txt = Object.entries(c).map(([n, a]) => `${a} ${n}`).join(', ');
      acts += `<button class="btn" id="aUp"${canPay(S, c) ? '' : ' disabled'}>${v.t === 'ruin' ? 'Rebuild' : 'Upgrade'}: ${txt}</button>`;
    } else acts += '<span class="small" style="color:var(--muted)">Max level!</span>';
  } else {
    info.innerHTML = 'Pick a tile below and put it next to your island. Tap a tile on your island to upgrade it.';
  }
  acts += '<button class="btn ghost" id="aMenu" style="margin-left:auto">Menu</button>';
  $('actions').innerHTML = acts;

  const hasDock = bestDockLevel(S) > 0;
  $('hand').innerHTML = S.offers.map((t, i) =>
    `<button class="card${selCard === i ? ' on' : ''}" data-i="${i}"${S.over ? ' disabled' : ''}><span class="ci">${TILES[t].icon}</span><span class="cn">${TILES[t].name}</span></button>`).join('')
    + `<button class="btn fishbtn" id="aFish"${canFish(S) ? '' : ' disabled'} title="${!hasDock ? 'Build a dock first' : S.fished ? 'Again tomorrow' : 'Go fishing'}"><span>🎣</span>${S.fished ? 'tomorrow' : 'fish'}</button>`;

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
