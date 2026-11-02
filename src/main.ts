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
import type { GameState, NightReport, Resources } from './game/types';
import { tap } from './feedback';
import { loadBest, loadGame, saveBest, saveGame } from './storage';
import { ICONS, cardSvg, heroIsland, hexPoints, pirateShip, tileSvg } from './art';
import { musicOn, play, soundOn, toggleMusic, toggleSfx, unlockAudio } from './audio';

const root = document.getElementById('app')!;
const SIZE = 30;
// Draw back rows first so the 3D tile sides overlap correctly.
const cells = gridCells(CONFIG.gridRadius).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
const RES = [
  ['food', 'food'], ['wood', 'wood'], ['stone', 'stone'],
  ['pearls', 'pearls'], ['pop', 'people'], ['def', 'defence'],
] as const;
const YIELD_ICON: Record<string, string> = { food: '🐟', wood: '🪵', stone: '🪨' };

let S: GameState;
let best = 0;
let selCard: number | null = null;
let pending: string | null = null;
let selTile: string | null = null;
let flash: Record<string, boolean> = {};
let justPlaced: string | null = null;
let justUpgraded: string | null = null;
let busy = false;

const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Sound may only start after a touch, so unlock it on the very first one.
document.addEventListener('pointerdown', unlockAudio, { once: true });

// ---------- screens ----------
function startScreen(hasSave: boolean): void {
  root.innerHTML = `
    <div class="start">
      ${heroIsland}
      <h1>${GAME_NAME}</h1>
      <p>Build your island, go fishing and keep the Fog Pirates away!</p>
      <div class="stack">
        ${hasSave ? '<button class="btn" id="sGo">Keep playing</button>' : ''}
        <button class="btn ${hasSave ? 'ghost' : ''}" id="sNew">New island</button>
        <button class="btn ghost" id="sHow">How to play</button>
      </div>
      ${best ? `<p class="best">Best score: <b>${best}</b></p>` : ''}
      <div class="sound-row">${soundButtons()}</div>
    </div>`;
  if (hasSave) $('sGo').onclick = () => { unlockAudio(); play('select'); tap(); gameScreen(); };
  $('sNew').onclick = () => { unlockAudio(); play('select'); tap(); S = newGame(); void saveGame(S); gameScreen(); };
  $('sHow').onclick = () => { unlockAudio(); play('tap'); howTo(); };
  wireSoundButtons();
}

function soundButtons(): string {
  return `<button class="icon-btn" id="tSfx" aria-pressed="${soundOn()}" aria-label="Sound effects">${soundOn() ? '🔊' : '🔈'}</button>
    <button class="icon-btn" id="tMusic" aria-pressed="${musicOn()}" aria-label="Music">${musicOn() ? '🎵' : '<s>🎵</s>'}</button>`;
}
function wireSoundButtons(): void {
  $('tSfx').onclick = () => { unlockAudio(); toggleSfx(); refreshSoundButtons(); };
  $('tMusic').onclick = () => { unlockAudio(); toggleMusic(); refreshSoundButtons(); };
}
function refreshSoundButtons(): void {
  const s = $('tSfx'), m = $('tMusic');
  s.innerHTML = soundOn() ? '🔊' : '🔈'; s.setAttribute('aria-pressed', String(soundOn()));
  m.innerHTML = musicOn() ? '🎵' : '<s>🎵</s>'; m.setAttribute('aria-pressed', String(musicOn()));
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
  $('mOk').onclick = () => { play('tap'); closeModal(); };
}

function gameScreen(): void {
  root.innerHTML = `
    <div class="app" id="game">
      <div class="topbar">
        <div class="brand" id="home" role="button" tabindex="0">${GAME_NAME}</div>
        <div class="top-right">
          <div class="daybox"><div><b id="dayLbl"></b> · score <b id="scoreLbl"></b></div><div class="dots" id="dots"></div></div>
          <div class="sound-row small-row">${soundButtons()}</div>
        </div>
      </div>
      <div class="hud"><div class="res" id="res"></div><div class="banner" id="banner"></div></div>
      <div class="board" id="board"></div>
      <div class="panel"><div class="info" id="info"></div><div class="hand" id="hand"></div><div class="actions" id="actions"></div></div>
    </div>
    <div class="overlay" id="overlay" hidden><div class="modal" id="modal"></div></div>`;
  $('home').onclick = () => { play('tap'); startScreen(true); };
  wireSoundButtons();
  selCard = pending = selTile = null;
  busy = false;
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
  document.getElementById('game')?.classList.remove('is-night');
  if (document.getElementById('board')) render();
}

// ---------- game flow ----------
async function doPlace(k: string): Promise<void> {
  if (selCard === null || busy) return;
  const [q, r] = parse(k);
  const report = place(S, selCard, q, r);
  play('place');
  tap();
  selCard = null; pending = null; selTile = k; flash = {}; justPlaced = k;
  void saveGame(S);
  render();
  if (report) await nightSequence(report);
}

/** Night falls: the board darkens, every tile shows what it made, and on pirate nights the ships sail in. */
async function nightSequence(rep: NightReport): Promise<void> {
  busy = true;
  await wait(350);
  const game = document.getElementById('game');
  game?.classList.add('is-night');
  play('night');
  tap(true);
  const svg = document.querySelector<SVGSVGElement>('#board svg');
  const fast = reduceMotion();
  // A dark veil over the island; numbers and ships are drawn on top of it so they stay bright.
  svg?.insertAdjacentHTML('beforeend', '<rect class="nightveil" x="-1000" y="-1000" width="2000" height="2000"/>');
  if (svg) {
    rep.yields.forEach(({ k, y }, i) => {
      const [q, r] = parse(k);
      const { x, y: py } = toPixel(q, r, SIZE);
      const txt = (Object.entries(y) as [keyof Resources, number][]).filter(([, n]) => n).map(([n, a]) => `+${a}${YIELD_ICON[n] ?? ''}`).join(' ');
      setTimeout(() => {
        svg.insertAdjacentHTML('beforeend', `<text class="float" x="${x}" y="${py - 10}">${txt}</text>`);
        if (i % 3 === 0) play('coin');
      }, fast ? 0 : 120 + i * 70);
    });
  }
  await wait(fast ? 600 : 1300 + rep.yields.length * 70);

  if (rep.isStorm && svg) {
    play('pirates');
    const R = CONFIG.gridRadius;
    const far = SIZE * Math.sqrt(3) * (R + 1.5);
    const near = SIZE * Math.sqrt(3) * 2.2;
    const angles = [-0.6, 1.4, 2.9].map(a => a + Math.random() * 0.6);
    const ships = angles.map(a => {
      const fx = Math.cos(a) * far, fy = Math.sin(a) * far * 0.8;
      const nx = Math.cos(a) * near, ny = Math.sin(a) * near * 0.8;
      const values = rep.stormWon ? `${fx} ${fy}; ${nx * 1.5} ${ny * 1.5}; ${fx * 1.3} ${fy * 1.3}` : `${fx} ${fy}; ${nx} ${ny}`;
      const flip = fx > 0 ? ' scale(-1,1)' : '';
      return `<g class="ship"><g><animateTransform attributeName="transform" type="translate" values="${values}" dur="${fast ? 0.5 : 2.2}s" fill="freeze"/><g transform="scale(1.1)${flip}">${pirateShip}</g></g></g>`;
    }).join('');
    svg.insertAdjacentHTML('beforeend', ships);
    if (rep.stormWon) {
      // Towers fire back.
      Object.entries(S.tiles).filter(([, v]) => v.t === 'tower').forEach(([k], i) => {
        const [q, r] = parse(k);
        const { x, y } = toPixel(q, r, SIZE);
        setTimeout(() => svg.insertAdjacentHTML('beforeend', `<circle class="boom" cx="${x}" cy="${y - 20}" r="6"/>`), 700 + i * 180);
      });
    }
    await wait(fast ? 600 : 2300);
    play(rep.stormWon ? 'victory' : 'defeat');
  }

  busy = false;
  if (rep.gameOver) { play('end'); showEnd(rep.lines, rep.title); return; }
  const next = isStormNight(S.day)
    ? `Watch out! The Fog Pirates come tonight (strength ${stormPower(S)}).`
    : 'Tonight the sea will be calm.';
  modal(`<div class="moon" aria-hidden="true">${rep.isStorm ? '🏴‍☠️' : '🌙'}</div><h2>${rep.title}</h2><ul>${rep.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul><div class="small">${next}</div><button class="btn" id="mOk">Start day ${S.day}</button>`);
  $('mOk').onclick = () => { play('select'); closeModal(); };
}

function showEnd(lines: string[], title = `Your island after ${CONFIG.days} days`): void {
  const sc = score(S);
  const isBest = sc > best;
  if (isBest) { best = sc; void saveBest(sc); }
  modal(`<div class="moon" aria-hidden="true">🏆</div><h2>${title}</h2><ul>${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
    <div><div class="small">Your score</div><div class="big">${sc}</div><div class="small">${isBest ? 'New best score!' : `Best score: ${best}`}</div></div>
    <button class="btn" id="mOk">New island</button>`);
  $('mOk').onclick = () => { play('select'); S = newGame(); void saveGame(S); closeModal(); };
}

function fish(): void {
  if (!canFish(S) || busy) return;
  play('cast');
  const f = CONFIG.fishing;
  const w = f.zoneBase + f.zonePerLevel * (bestDockLevel(S) - 1);
  const start = 0.1 + Math.random() * (0.8 - w);
  const speed = 0.0024 + Math.random() * 0.0008;
  const t0 = performance.now();
  let pos = 0, raf = 0, done = false;
  modal(`<h2>Fishing</h2>
    <div class="pond" aria-hidden="true"><div class="ripple"></div><div class="bobber"></div><div class="fishy">🐟</div></div>
    <div class="small">Tap <b>Catch!</b> when the line is in the green part. Hit the yellow middle for a pearl!</div>
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
    play(res.kind === 'good' ? 'catch' : res.kind);
    tap(res.kind !== 'miss');
    void saveGame(S);
    const pic = res.kind === 'perfect' ? '✨🐠✨' : res.kind === 'good' ? '🐟' : '💦';
    const msg = res.kind === 'perfect' ? `Perfect! A shiny pearl fish: +${res.food} food and +1 pearl.`
      : res.kind === 'good' ? `Nice catch: +${res.food} food.`
      : 'Oops, it got away. You found 1 tiny fish: +1 food.';
    modal(`<h2>Fishing</h2><div class="catch">${pic}</div><div>${msg}</div><div class="small">You can fish again tomorrow. A better dock makes the green part bigger.</div><button class="btn" id="mOk">Back to my island</button>`);
    $('mOk').onclick = () => { play('tap'); closeModal(); };
  };
}

// ---------- render ----------
const WAVES = Array.from({ length: 9 }, (_, i) => {
  const y = -170 + i * 42;
  const x = (i % 2) * 40 - 260;
  return `<path class="wave w${i % 3}" d="M${x} ${y} q15 -6 30 0 t30 0 t30 0" />
          <path class="wave w${(i + 1) % 3}" d="M${x + 260} ${y + 20} q15 -6 30 0 t30 0" />`;
}).join('');

function render(): void {
  const { pop, def } = totals(S);
  const vals: Record<string, number> = { ...S.res, pop, def };
  $('res').innerHTML = RES.map(([k, l]) =>
    `<div class="r${flash[k] ? ' flash' : ''}"><div class="i">${ICONS[k]}</div><div class="v">${vals[k]}</div><div class="l">${l}</div></div>`).join('');
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

  const cur = selCard !== null ? S.offers[selCard] : null;
  let sea = '', marks = '', land = '';
  for (const [q, r] of cells) {
    const { x, y } = toPixel(q, r, SIZE);
    const k = key(q, r);
    const v = S.tiles[k];
    if (v) {
      const cls = k === justPlaced ? 'drop' : k === justUpgraded ? 'pulse' : '';
      land += `<g data-k="${k}" transform="translate(${x},${y})" class="cell">${tileSvg(v.t, v.l, SIZE, cls)}`;
      if (selTile === k) land += `<polygon class="sel-ring" points="${hexPoints(0, 0, SIZE - 1)}"/>`;
      land += '</g>';
    } else {
      sea += `<polygon class="hex-sea" points="${hexPoints(x, y, SIZE - 2)}"/>`;
      if (pending === k && cur) {
        land += `<g data-k="${k}" transform="translate(${x},${y})" class="cell ghost">${tileSvg(cur, 1, SIZE)}</g>`;
      } else if (cur && canPlace(S, q, r, cur)) {
        marks += `<g data-k="${k}" class="cell"><polygon class="hex-valid" points="${hexPoints(x, y, SIZE - 3)}"/></g>`;
      } else {
        marks += `<g data-k="${k}" class="cell"><polygon class="hex-hit" points="${hexPoints(x, y, SIZE - 2)}"/></g>`;
      }
    }
  }
  justPlaced = null; justUpgraded = null;
  const R = CONFIG.gridRadius;
  const W = SIZE * Math.sqrt(3) * (2 * R + 1) + 8, H = SIZE * (3 * R + 2) + 16;
  $('board').innerHTML = `<svg viewBox="${-W / 2} ${-H / 2} ${W} ${H}" role="img" aria-label="Your island">
    <g class="waves">${WAVES}</g>${sea}${marks}${land}</svg>`;

  const info = $('info');
  let acts = '';
  if (S.over) {
    info.innerHTML = `Game over! Your score: <b>${score(S)}</b>.`;
  } else if (pending && cur) {
    const [q, r] = parse(pending);
    const y = formatYield(yieldOf(S, q, r, cur, 1));
    const what = y === 'nothing' ? TILES[cur].info : `It makes ${y} each night here.`;
    info.innerHTML = `<b>${TILES[cur].name}</b> here? ${what} Tap again to place it.`;
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
    } else acts += '<span class="small muted">Max level!</span>';
  } else {
    info.innerHTML = 'Pick a tile below and put it next to your island. Tap a tile on your island to upgrade it.';
  }
  acts += '<button class="btn ghost" id="aMenu" style="margin-left:auto">Menu</button>';
  $('actions').innerHTML = acts;

  const hasDock = bestDockLevel(S) > 0;
  $('hand').innerHTML = S.offers.map((t, i) =>
    `<button class="card${selCard === i ? ' on' : ''}" data-i="${i}"${S.over ? ' disabled' : ''}><span class="ci">${cardSvg(t)}</span><span class="cn">${TILES[t].name}</span></button>`).join('')
    + `<button class="btn fishbtn" id="aFish"${canFish(S) ? '' : ' disabled'} title="${!hasDock ? 'Build a dock first' : S.fished ? 'Again tomorrow' : 'Go fishing'}"><span>🎣</span>${S.fished ? 'tomorrow' : 'fish'}</button>`;

  $('hand').querySelectorAll<HTMLButtonElement>('.card').forEach(b => {
    b.onclick = () => {
      if (busy) return;
      const i = Number(b.dataset.i);
      selCard = selCard === i ? null : i; pending = null; selTile = null; flash = {};
      play(selCard === null ? 'tap' : 'select'); tap(); render();
    };
  });
  $('aFish').onclick = fish;
  $('aMenu').onclick = () => { play('tap'); startScreen(true); };
  document.getElementById('aPlace')?.addEventListener('click', () => { if (pending) void doPlace(pending); });
  document.getElementById('aCancel')?.addEventListener('click', () => { play('tap'); pending = null; render(); });
  document.getElementById('aUp')?.addEventListener('click', () => {
    if (selTile && upgrade(S, selTile)) { play('upgrade'); tap(true); justUpgraded = selTile; void saveGame(S); render(); }
  });
  $('board').querySelectorAll<SVGGElement>('g[data-k]').forEach(g => {
    g.addEventListener('click', () => {
      if (S.over || busy) return;
      const k = g.dataset.k!;
      const [q, r] = parse(k);
      if (S.tiles[k]) { play('tap'); selTile = selTile === k ? null : k; selCard = null; pending = null; flash = {}; render(); return; }
      if (cur && canPlace(S, q, r, cur)) {
        if (pending === k) void doPlace(k);
        else { play('tap'); pending = k; tap(); render(); }
      } else if (cur) play('error');
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
