import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/800.css';
import '@fontsource/nunito/500.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import './styles.css';
import { CONFIG } from './game/config';
import { DIRS, key, neighbours, parse, toPixel as hexToPixel } from './game/hex';
import {
  boatProblem, build, buildCost, buyBoat, canFish, canPay, economy, fishZone, fleetText, formatYield, isStormNight,
  clearProblem, clearTile, explore, exploreNeed, exploreProblem, explorersToSend, freePeople, isOpen,
  network, newGame, nextPirateNight, pirateFleet, placeProblem, resolveFish, score, sleep, stormPower,
  terrainAt, upgrade, upgradeCost, upgradeProblem,
} from './game/rules';
import { BUILDINGS, BUILD_MENU, TERRAIN_INFO } from './game/tiles';
import { GAME_NAME } from './game/brand';
import type { BoatType, BuildableType, Cost, GameState, NightReport, Resources } from './game/types';
import { tap } from './feedback';
import { MISSIONS, checkMissions, currentMission, type Mission } from './game/missions';
import { comic } from './comic';
import { loadBest, loadGame, saveBest, saveGame } from './storage';
import { ICONS, S, boatSvg, buildingSvg, cloudLayer, decorLayer, heroIsland, hexPoints, menuIcon, pathLayer, pirateShip, terrainLayer } from './art';
import { musicOn, play, soundOn, toggleMusic, toggleSfx, unlockAudio } from './audio';

const root = document.getElementById('app')!;
const YIELD_ICON: Record<string, string> = { food: '🐟', wood: '🪵', stone: '🪨', pearls: '🦪' };
const BOATS: BoatType[] = ['rowboat', 'fishingboat', 'sailboat'];

let G: GameState;
let best = 0;
let tool: BuildableType | null = null;
let pending: string | null = null;
let sel: string | null = null;
let hint = '';
let justBuilt: string | null = null;
let justUpgraded: string | null = null;
let busy = false;
let built = '';
let cloudsLeaving: number | null = null;
let lastDecor = '', lastClouds = '';
const cam = { x: 0, y: 0, z: 1 };

const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const px = (k: string) => { const [q, r] = parse(k); return hexToPixel(q, r, S); };
const nbKeys = (k: string) => neighbours(...parse(k)).map(([a, b]) => key(a, b));

document.addEventListener('pointerdown', unlockAudio, { once: true });

// ---------- screens ----------
function startScreen(hasSave: boolean): void {
  root.innerHTML = `
    <div class="start">
      ${heroIsland}
      <h1>${GAME_NAME}</h1>
      <p>Build a village on your island, go fishing and keep the Fog Pirates away!</p>
      <div class="stack">
        ${hasSave ? '<button class="btn" id="sGo">Keep playing</button>' : ''}
        <button class="btn ${hasSave ? 'ghost' : ''}" id="sNew">New island</button>
        <button class="btn ghost" id="sHow">How to play</button>
      </div>
      ${best ? `<p class="best">Best score: <b>${best}</b></p>` : ''}
      <div class="sound-row">${soundButtons()}</div>
    </div>`;
  if (hasSave) $('sGo').onclick = () => { unlockAudio(); play('select'); tap(); gameScreen(); };
  $('sNew').onclick = () => { unlockAudio(); play('select'); tap(); G = newGame(); void saveGame(G); gameScreen(); };
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
    <li>Follow the missions at the top. Each mission gives a reward and unlocks new buildings.</li>
    <li>Start with a lumber camp next to a forest and a quarry next to rocks. They give you wood and stone.</li>
    <li>Build paths from your town square. Buildings only work when a path leads to them.</li>
    <li>Houses give you people. People work in farms, lumber camps, quarries and docks.</li>
    <li>Fields grow food when a farm is close by. Fields next to each other join up.</li>
    <li>Most of the island is hidden in the clouds. Tap the clouds and send explorers to find new land.</li>
    <li>Need room? Tap a forest or rocks to chop or break them. You get wood or stone back.</li>
    <li>You can do ${CONFIG.actionsPerDay} things a day. Then night falls, your island makes things and your people eat.</li>
    <li>From night ${CONFIG.firstPirateNight} the Fog Pirates come every ${CONFIG.stormEvery} nights, in bigger ships each time. Towers keep them away.</li>
    <li>Drag to look around the island. Pinch or use + and − to zoom.</li>
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
      <div class="hud"><div class="res" id="res"></div><div class="mission" id="mission"></div><div class="banner" id="banner"></div></div>
      <div class="board" id="board">
        <svg id="svg" role="img" aria-label="Your island">
          <g class="waves" id="waves"></g><g id="terrain"></g><g id="decor"></g><g id="paths"></g><g id="overlay"></g><g id="buildings"></g><g id="clouds"></g><g id="marks"></g><g id="fx"></g>
        </svg>
        <div class="zoom"><button class="icon-btn" id="zIn" aria-label="Zoom in">+</button><button class="icon-btn" id="zOut" aria-label="Zoom out">−</button><button class="icon-btn" id="zHome" aria-label="Back to the town square">⌂</button></div>
      </div>
      <div class="panel"><div class="info" id="info"></div><div id="tools"></div></div>
    </div>
    <div class="overlay" id="overlay-modal" hidden><div class="modal" id="modal"></div></div>`;
  $('home').onclick = () => { play('tap'); startScreen(true); };
  wireSoundButtons();
  tool = pending = sel = null; hint = ''; busy = false;
  drawWaves();
  terrainDirty = true; lastDecor = ''; lastClouds = '';
  setupCamera();
  render();
  if (G.over) showEnd(['This island is finished.']);
}

// ---------- modal ----------
function modal(html: string): void {
  if (!document.getElementById('overlay-modal')) root.insertAdjacentHTML('beforeend', '<div class="overlay" id="overlay-modal" hidden><div class="modal" id="modal"></div></div>');
  $('modal').innerHTML = html;
  $('overlay-modal').hidden = false;
  setTimeout(() => document.getElementById('mOk')?.focus(), 30);
}
function closeModal(): void {
  $('overlay-modal').hidden = true;
  document.getElementById('game')?.classList.remove('is-night');
  const fx = document.getElementById('fx');
  if (fx) fx.innerHTML = '';
  if (document.getElementById('svg')) render();
}

// ---------- camera: drag to pan, pinch or buttons to zoom ----------
/** How far the island reaches from the town square, in pixels. */
const WORLD = () => {
  let m = 0;
  for (const k of Object.keys(G.terrain)) {
    if (G.terrain[k] === 'sea') continue;
    const { x, y } = px(k);
    m = Math.max(m, Math.abs(x), Math.abs(y));
  }
  return m + S * 3;
};
let terrainDirty = true;

function applyCamera(): void {
  const svg = document.getElementById('svg');
  if (!svg) return;
  const w = svg.clientWidth || 360, h = svg.clientHeight || 400;
  // You can only look as far as the edge of the clouds.
  const b = openBounds();
  const halfW = (w * cam.z) / 2, halfH = (h * cam.z) / 2;
  const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
  cam.x = clamp(cam.x, b.x0 + halfW, b.x1 - halfW);
  cam.y = clamp(cam.y, b.y0 + halfH, b.y1 - halfH);
  svg.setAttribute('viewBox', `${cam.x - (w * cam.z) / 2} ${cam.y - (h * cam.z) / 2} ${w * cam.z} ${h * cam.z}`);
}
function zoomBy(f: number): void {
  const svg = $('svg');
  const minZ = (S * Math.sqrt(3) * 4.5) / (svg.clientWidth || 360);
  const b = openBounds();
  const maxZ = Math.max(minZ, Math.min((b.x1 - b.x0) / (svg.clientWidth || 360), (b.y1 - b.y0) / (svg.clientHeight || 400)));
  cam.z = Math.max(minZ, Math.min(maxZ, cam.z * f));
  applyCamera();
}
/** The open land plus a strip of cloud around it: the part of the world you can look at. */
let boundsCache: { key: string; b: { x0: number; x1: number; y0: number; y1: number } } | null = null;
function openBounds() {
  const k = G.open.join(',');
  if (boundsCache?.key === k) return boundsCache.b;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const c of Object.keys(G.region)) {
    if (!isOpen(G, c)) continue;
    const { x, y } = px(c);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const m = S * 3.2;
  boundsCache = { key: k, b: { x0: x0 - m, x1: x1 + m, y0: y0 - m, y1: y1 + m } };
  return boundsCache.b;
}

function homeCamera(): void {
  const svg = $('svg');
  cam.x = 0; cam.y = 0;
  cam.z = (S * Math.sqrt(3) * 8.5) / (svg.clientWidth || 360);
  applyCamera();
}

function setupCamera(): void {
  const svg = $('svg') as unknown as SVGSVGElement;
  homeCamera();
  new ResizeObserver(applyCamera).observe(svg);
  $('zIn').onclick = () => { play('tap'); zoomBy(0.8); };
  $('zOut').onclick = () => { play('tap'); zoomBy(1.25); };
  $('zHome').onclick = () => { play('tap'); homeCamera(); };
  const pts = new Map<number, { x: number; y: number }>();
  let moved = 0, pinch = 0;
  svg.addEventListener('pointerdown', e => {
    svg.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) moved = 0;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); moved = 99; }
  });
  svg.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    if (pts.size === 1) {
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 8) { cam.x -= dx * cam.z; cam.y -= dy * cam.z; applyCamera(); }
    } else if (pts.size === 2) {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0 && d > 0) zoomBy(pinch / d);
      pinch = d;
      return;
    }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  const end = (e: PointerEvent) => {
    const wasTap = pts.size === 1 && moved <= 8;
    pts.delete(e.pointerId);
    if (wasTap && e.type === 'pointerup') onBoardTap(e.clientX, e.clientY);
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('wheel', e => { e.preventDefault(); zoomBy(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
}

function clientToHex(cx: number, cy: number): string {
  const svg = $('svg') as unknown as SVGSVGElement;
  const pt = svg.createSVGPoint();
  pt.x = cx; pt.y = cy;
  const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
  const qf = ((Math.sqrt(3) / 3) * p.x - (1 / 3) * p.y) / S;
  const rf = ((2 / 3) * p.y) / S;
  let q = Math.round(qf), r = Math.round(rf);
  const s = Math.round(-qf - rf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - (-qf - rf));
  if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
  return key(q, r);
}

// ---------- tapping the island ----------
function onBoardTap(cx: number, cy: number): void {
  if (busy || G.over) return;
  const k = clientToHex(cx, cy);
  if (!(k in G.terrain)) return;
  if (tool) {
    const problem = placeProblem(G, k, tool);
    if (problem) { hint = problem; pending = null; play('error'); render(); return; }
    if (pending === k) { void doBuild(k); return; }
    pending = k; hint = ''; play('tap'); tap(); render();
    return;
  }
  sel = sel === k ? null : k;
  hint = '';
  play('tap');
  render();
}

// ---------- actions ----------
async function doBuild(k: string): Promise<void> {
  if (!tool || busy) return;
  const t = tool;
  const rep = build(G, k, t);
  play('place'); tap();
  justBuilt = k; pending = null; hint = '';
  if (t !== 'road') {
    tool = null; sel = null; hint = '';
    built = `${BUILDINGS[t].name} built!`;
  }
  await afterAction(rep);
}

/** Every action ends here: check missions, save, draw, and start the night if the day is over. */
async function afterAction(rep: NightReport | null): Promise<void> {
  const done = rep ? [] : checkMissions(G);
  void saveGame(G);
  render();
  if (done.length) await missionDone(done);
  if (rep) await nightSequence(rep);
}

function missionDone(done: Mission[]): Promise<void> {
  play('end'); tap(true);
  const next = currentMission(G);
  return new Promise(res => {
    modal(`<div class="moon" aria-hidden="true">⭐</div><h2>Mission complete!</h2>
      ${done.map(m => `<div class="mission-done"><b>${esc(m.text)}</b>${Object.keys(m.reward).length ? `<div class="reward">Reward: ${costHtml(m.reward, false)}</div>` : ''}${m.done ? `<div>${esc(m.done)}</div>` : ''}</div>`).join('')}
      ${next ? `<div class="small">Next mission: ${esc(next.text)}</div>` : '<div class="small">You finished every mission. Amazing!</div>'}
      <button class="btn" id="mOk">Great!</button>`);
    $('mOk').onclick = () => { play('tap'); closeModal(); res(); };
  });
}

async function doExplore(k: string): Promise<void> {
  if (busy) return;
  const id = G.region[k];
  const sent = explorersToSend(G, k);
  const rep = explore(G, k);
  tap(true);
  if (G.open.includes(id)) {
    play('upgrade');
    sel = null;
    cloudsLeaving = id;
    built = `The clouds are gone! Your ${sent} explorers found new land.`;
  } else {
    play('select');
    hint = '';
  }
  await afterAction(rep);
}

async function doClear(k: string): Promise<void> {
  if (busy) return;
  const was = terrainAt(G, k);
  const rep = clearTile(G, k);
  play(was === 'forest' ? 'place' : 'error'); tap(true);
  terrainDirty = true;
  sel = null;
  await afterAction(rep);
}

async function doUpgrade(k: string): Promise<void> {
  const rep = upgrade(G, k);
  play('upgrade'); tap(true);
  justUpgraded = k;
  await afterAction(rep);
}

async function doBoat(k: string, b: BoatType): Promise<void> {
  const rep = buyBoat(G, k, b);
  play('catch'); tap(true);
  justUpgraded = k;
  await afterAction(rep);
}

async function doSleep(): Promise<void> {
  if (busy) return;
  tool = null; pending = null; sel = null;
  render();
  await nightSequence(sleep(G));
}

/** Night falls: the island darkens, every building shows what it made, and on pirate nights the ships sail in. */
async function nightSequence(rep: NightReport): Promise<void> {
  busy = true;
  void saveGame(G);
  await wait(350);
  $('game').classList.add('is-night');
  play('night');
  tap(true);
  const fx = $('fx');
  const fast = reduceMotion();
  fx.innerHTML = '<rect class="nightveil" x="-3000" y="-3000" width="6000" height="6000"/>';
  rep.yields.forEach(({ k, y }, i) => {
    const { x, y: py } = px(k);
    const txt = (Object.entries(y) as [keyof Resources, number][]).filter(([, n]) => n).map(([n, a]) => `+${a}${YIELD_ICON[n] ?? ''}`).join(' ');
    setTimeout(() => {
      fx.insertAdjacentHTML('beforeend', `<text class="float" x="${x}" y="${py - 14}">${txt}</text>`);
      if (i % 3 === 0) play('coin');
    }, fast ? 0 : 120 + i * 80);
  });
  await wait(fast ? 600 : 1400 + rep.yields.length * 80);

  if (rep.isStorm) {
    await comic(rep, G.day - (rep.gameOver ? 0 : 1));
    const far = WORLD() * 0.95;
    const near = S * Math.sqrt(3) * 4.2;
    const ships = rep.ships ?? ['sloop'];
    const angles = ships.map((_, i) => -0.6 + i * 2.1 + Math.random() * 0.6);
    fx.insertAdjacentHTML('beforeend', angles.map((a, i) => {
      const fx1 = Math.cos(a) * far, fy1 = Math.sin(a) * far;
      const nx = Math.cos(a) * near, ny = Math.sin(a) * near;
      const values = rep.stormWon ? `${fx1} ${fy1}; ${nx * 1.4} ${ny * 1.4}; ${fx1 * 1.2} ${fy1 * 1.2}` : `${fx1} ${fy1}; ${nx} ${ny}`;
      const flip = fx1 > 0 ? ' scale(-1,1)' : '';
      return `<g class="ship"><g><animateTransform attributeName="transform" type="translate" values="${values}" dur="${fast ? 0.5 : 2.2}s" fill="freeze"/><g transform="scale(1.6)${flip}">${pirateShip(ships[i])}</g></g></g>`;
    }).join(''));
    if (rep.stormWon) {
      Object.entries(G.b).filter(([, v]) => v.t === 'tower').forEach(([k], i) => {
        const { x, y } = px(k);
        setTimeout(() => fx.insertAdjacentHTML('beforeend', `<circle class="boom" cx="${x}" cy="${y - 30}" r="8"/>`), 700 + i * 180);
      });
    }
    await wait(fast ? 600 : 2300);
  }

  busy = false;
  if (rep.gameOver) { play('end'); showEnd(rep.lines, rep.title); return; }
  const done = checkMissions(G);
  void saveGame(G);
  const pn = nextPirateNight(G.day);
  const next = isStormNight(G.day)
    ? `Watch out! The Fog Pirates come tonight with ${fleetText(pirateFleet(G).ships)} (strength ${stormPower(G)}).`
    : pn ? `Tonight the sea will be calm. Pirates come on night ${pn}.` : 'Tonight the sea will be calm.';
  modal(`<div class="moon" aria-hidden="true">${rep.isStorm ? '🏴‍☠️' : '🌙'}</div><h2>${rep.title}</h2><ul>${rep.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul><div class="small">${next}</div><button class="btn" id="mOk">Start day ${G.day}</button>`);
  $('mOk').onclick = () => { play('select'); closeModal(); if (done.length) void missionDone(done); };
}

function showEnd(lines: string[], title = `Your island after ${CONFIG.days} days`): void {
  const sc = score(G);
  const isBest = sc > best;
  if (isBest) { best = sc; void saveBest(sc); }
  modal(`<div class="moon" aria-hidden="true">🏆</div><h2>${title}</h2><ul>${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
    <div><div class="small">Your score</div><div class="big">${sc}</div><div class="small">${isBest ? 'New best score!' : `Best score: ${best}`}</div></div>
    <button class="btn" id="mOk">New island</button>`);
  $('mOk').onclick = () => { play('select'); G = newGame(); void saveGame(G); closeModal(); gameScreen(); };
}

function fish(): void {
  if (!canFish(G) || busy) return;
  play('cast');
  const w = fishZone(G);
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
    const res = resolveFish(G, (pos - start) / w);
    play(res.kind === 'good' ? 'catch' : res.kind);
    tap(res.kind !== 'miss');
    void saveGame(G);
    const pic = res.kind === 'perfect' ? '✨🐠✨' : res.kind === 'good' ? '🐟' : '💦';
    const msg = res.kind === 'perfect' ? `Perfect! A shiny pearl fish: +${res.food} food and +1 pearl.`
      : res.kind === 'good' ? `Nice catch: +${res.food} food.`
      : 'Oops, it got away. You found 1 tiny fish: +1 food.';
    modal(`<h2>Fishing</h2><div class="catch">${pic}</div><div>${msg}</div><div class="small">You can fish again tomorrow. Better docks and boats make the green part bigger.</div><button class="btn" id="mOk">Back to my island</button>`);
    $('mOk').onclick = () => { play('tap'); closeModal(); };
  };
}

// ---------- drawing ----------
function drawWaves(): void {
  const lim = WORLD() * 1.6;
  let w = '';
  for (let y = -lim, i = 0; y < lim; y += 46, i++) {
    for (let x = -lim + (i % 2) * 60; x < lim; x += 170) {
      w += `<path class="wave w${Math.abs(i + Math.round(x / 170)) % 3}" d="M${x.toFixed(0)} ${y.toFixed(0)} q15 -6 30 0 t30 0" />`;
    }
  }
  $('waves').innerHTML = w;
}

const costHtml = (c: Cost, check = true) => (Object.entries(c) as [keyof Resources, number][])
  .map(([k, n]) => `<span class="cost${check && G.res[k] < n ? ' short' : ''}">${check ? '' : '+'}${n}<i>${ICONS[k]}</i></span>`).join('');

function render(): void {
  const e = economy(G);
  // HUD
  const vals: [string, string, string][] = [
    ['food', String(G.res.food), 'food'], ['wood', String(G.res.wood), 'wood'], ['stone', String(G.res.stone), 'stone'],
    ['pearls', String(G.res.pearls), 'pearls'], ['pop', `${e.people}<small>/${e.jobs}</small>`, 'people/jobs'], ['def', String(e.defence), 'defence'],
  ];
  $('res').innerHTML = vals.map(([k, v, l]) => `<div class="r${k === 'pop' && e.work < 1 ? ' warn' : ''}"><div class="i">${ICONS[k]}</div><div class="v">${v}</div><div class="l">${l}</div></div>`).join('');
  $('dayLbl').textContent = `Day ${G.day} of ${CONFIG.days}`;
  $('scoreLbl').textContent = String(score(G));
  $('dots').innerHTML = Array.from({ length: CONFIG.actionsPerDay }, (_, i) => `<div class="dot${i < G.actions ? ' done' : ''}"></div>`).join('');
  const left = CONFIG.actionsPerDay - G.actions;
  const ban = $('banner');
  const pn = nextPirateNight(G.day);
  const warn = isStormNight(G.day) ? `🏴‍☠️ ${fleetText(pirateFleet(G).ships)} tonight · ${stormPower(G)} vs your ${e.defence}`
    : `🔨 ${left} ${left === 1 ? 'build' : 'builds'} left${pn ? ` · pirates night ${pn}` : ''}`;
  ban.className = `banner${isStormNight(G.day) ? ' storm' : ''}`;
  const m = currentMission(G);
  $('mission').innerHTML = m
    ? `<span class="mtag">Mission ${G.mission + 1}/${MISSIONS.length}</span> ${esc(m.text)}${m.progress ? ` <b>${m.progress(G)}</b>` : ''}<span class="mreward">${costHtml(m.reward, false)}</span>`
    : '<span class="mtag">Missions</span> All done! Build the best island you can.';
  ban.innerHTML = `<span>${warn}</span><span class="ban-right">eat ${e.people}🐟 <button class="btn sleep" id="aSleep"${G.over || busy ? ' disabled' : ''}>Sleep 🌙</button></span>`;
  $('aSleep').onclick = () => { play('select'); void doSleep(); };

  // Paths and buildings
  if (terrainDirty) { $('terrain').innerHTML = terrainLayer(G.terrain, px); terrainDirty = false; }
  const decorKey = Object.keys(G.b).sort().join(';') + '|' + G.stats.cleared;
  if (decorKey !== lastDecor) { $('decor').innerHTML = decorLayer(G.terrain, new Set(Object.keys(G.b)), px); lastDecor = decorKey; }
  const cloudKey = G.open.join(',') + '|' + cloudsLeaving;
  if (cloudKey !== lastClouds) { $('clouds').innerHTML = cloudLayer(G.terrain, G.region, G.open, px, cloudsLeaving); lastClouds = cloudKey; }
  cloudsLeaving = null;
  $('paths').innerHTML = pathLayer(G.b, nbKeys, px, network(G));
  // Flat fields first, then everything else from back to front.
  const flatFirst = (k: string) => (G.b[k].t === 'field' ? 0 : 1);
  const order = Object.keys(G.b).filter(k => G.b[k].t !== 'road').sort((a, b) => flatFirst(a) - flatFirst(b) || px(a).y - px(b).y);
  $('buildings').innerHTML = order.map(k => {
    const v = G.b[k];
    const { x, y } = px(k);
    const cls = k === justBuilt ? 'drop' : k === justUpgraded ? 'pulse' : '';
    const idle = v.t !== 'plaza' && v.t !== 'field' && !e.connected.has(k);
    const [q, r] = parse(k);
    const joins = v.t === 'field' ? DIRS.map(([dq, dr]) => G.b[key(q + dq, r + dr)]?.t === 'field') : undefined;
    const stars = ['plaza', 'ruin', 'field'].includes(v.t) ? '' : `<g class="stars">${Array.from({ length: v.l }, (_, i) =>
      `<path transform="translate(${(i - (v.l - 1) / 2) * 9},${S * 0.72}) scale(.55)" d="M0 -7 L2 -2 L7 -2 L3 1.5 L4.5 7 L0 4 L-4.5 7 L-3 1.5 L-7 -2 L-2 -2 Z" fill="#ffd34d" stroke="#7a5a10" stroke-width="1.2"/>`).join('')}</g>`;
    return `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)})"><g class="bld ${cls}${idle ? ' idle' : ''}">${buildingSvg(v, { farmed: v.t === 'field' ? e.farmed.has(k) : undefined, joins, life: !idle && !reduceMotion() })}</g>${stars}</g>`;
  }).join('');
  justBuilt = null; justUpgraded = null;

  // Where can I build? Pending ghost? Selection?
  let over = '', marks = '';
  if (tool) {
    for (const k of Object.keys(G.terrain)) {
      if (placeProblem(G, k, tool)) continue;
      const { x, y } = px(k);
      over += `<polygon class="spot${pending === k ? ' pending' : ''}" points="${hexPoints(x, y, S - 3)}"/>`;
    }
    if (pending) {
      const { x, y } = px(pending);
      let ghost = '';
      if (tool === 'road') ghost = '<circle r="8" fill="#e3cc9c"/>';
      else {
        const tmp = structuredClone(G);
        tmp.actions = 0;
        build(tmp, pending, tool);
        ghost = buildingSvg(tmp.b[pending]);
      }
      marks += `<g transform="translate(${x},${y})" class="ghosting">${ghost}</g>`;
    }
  }
  if (sel) {
    const { x, y } = px(sel);
    marks += `<polygon class="sel-ring" points="${hexPoints(x, y, S - 1)}"/>`;
  }
  $('overlay').innerHTML = over;
  $('marks').innerHTML = marks;

  renderPanel(e);
}

function renderPanel(e: ReturnType<typeof economy>): void {
  const info = $('info');
  const tools = $('tools');
  if (G.over) {
    info.innerHTML = `Game over! Your score: <b>${score(G)}</b>.`;
    tools.innerHTML = '<div class="actions"><button class="btn" id="aNew">New island</button><button class="btn ghost" id="aMenu" style="margin-left:auto">Menu</button></div>';
    $('aNew').onclick = () => { G = newGame(); void saveGame(G); gameScreen(); };
    $('aMenu').onclick = () => startScreen(false);
    return;
  }

  // A building tool is picked.
  if (tool) {
    const B = BUILDINGS[tool];
    info.innerHTML = hint ? `<span class="warn-text">${esc(hint)}</span>`
      : pending ? `Build a <b>${B.name}</b> here? ${pendingPreview(pending, tool)} Tap again or press Build.`
      : `<b>${B.name}</b> ${costHtml(buildCost(tool))}<br>${B.info} Tap a green spot.`;
    tools.innerHTML = `<div class="actions">${pending ? '<button class="btn" id="aBuild">Build</button>' : ''}<button class="btn ghost" id="aDone">${tool === 'road' ? 'Done' : 'Cancel'}</button></div>`;
    document.getElementById('aBuild')?.addEventListener('click', () => { if (pending) void doBuild(pending); });
    $('aDone').onclick = () => { play('tap'); tool = null; pending = null; hint = ''; render(); };
    return;
  }

  // Something on the island is selected.
  if (sel) {
    const v = G.b[sel];
    if (!v) {
      const k = sel;
      // Clouds: send explorers.
      if (!isOpen(G, k)) {
        const p = exploreProblem(G, k);
        const need = exploreNeed(G), have = G.explorers[G.region[k]] ?? 0, n = explorersToSend(G, k);
        info.innerHTML = `<b>Clouds</b>: Nobody knows what is under here. Send <b>${need}</b> explorers to clear the clouds. People without a job can go, and each one takes ${CONFIG.explore.foodPerExplorer} food.
          <div class="explore-bar"><div style="width:${Math.min(100, (have / need) * 100)}%"></div><span>${have} / ${need} explorers</span></div>
          ${p ? `<span class="warn-text">${esc(p)}</span>` : `<span class="muted">${freePeople(G)} free ${freePeople(G) === 1 ? 'person' : 'people'} now.</span>`}`;
        tools.innerHTML = `<div class="actions"><button class="btn" id="aExplore"${p ? ' disabled' : ''}>🧭 Send ${n || ''} explorer${n === 1 ? '' : 's'} ${n ? costHtml({ food: n * CONFIG.explore.foodPerExplorer }) : ''}</button><button class="btn ghost" id="aClose" style="margin-left:auto">Close</button></div>`;
        $('aExplore').onclick = () => void doExplore(k);
        $('aClose').onclick = () => { play('tap'); sel = null; render(); };
        return;
      }
      const ter = terrainAt(G, k);
      const T = TERRAIN_INFO[ter];
      if (ter === 'forest' || ter === 'rocks') {
        const p = clearProblem(G, k);
        const c = CONFIG.clear[ter];
        info.innerHTML = `<b>${T.name}</b>: ${T.info} ${ter === 'forest' ? 'Chop it down' : 'Break the rocks'} to make room for buildings. ${p ? `<span class="warn-text">${esc(p)}</span>` : ''}`;
        tools.innerHTML = `<div class="actions"><button class="btn" id="aClear"${p ? ' disabled' : ''}>${ter === 'forest' ? '🪓 Chop' : '⛏️ Break'} ${costHtml(c.cost)} → ${costHtml(c.gain, false)}</button><button class="btn ghost" id="aClose" style="margin-left:auto">Close</button></div>`;
        $('aClear').onclick = () => void doClear(k);
        $('aClose').onclick = () => { play('tap'); sel = null; render(); };
        return;
      }
      info.innerHTML = `<b>${T.name}</b>: ${T.info}`;
      tools.innerHTML = buildMenu();
      wireBuildMenu();
      return;
    }
    const B = BUILDINGS[v.t];
    const lvl = ['plaza', 'road', 'ruin', 'field'].includes(v.t) ? '' : ` (level ${v.l})`;
    const notes: string[] = [];
    if (v.t !== 'plaza' && v.t !== 'road' && !e.connected.has(sel)) notes.push('<span class="warn-text">No path leads here, so it does not work.</span>');
    if (v.t === 'field' && !e.farmed.has(sel)) notes.push('<span class="warn-text">No farm looks after this field. Build or upgrade a farm close by.</span>');
    const y = e.perTile[sel];
    if (y) notes.push(`Makes ${formatYield(y)} a night.`);
    if (v.t === 'dock') notes.push(`Boats: ${(v.boats ?? []).length} of ${v.l}.`);
    info.innerHTML = `<b>${B.name}${lvl}</b>: ${B.info} ${notes.join(' ')}`;
    let html = '<div class="actions">';
    const c = upgradeCost(v);
    if (c) {
      const p = upgradeProblem(G, sel);
      html += `<button class="btn" id="aUp"${p ? ' disabled' : ''}>${v.t === 'ruin' ? 'Fix' : 'Upgrade'} ${costHtml(c)}</button>`;
    }
    if (v.t === 'dock' && canFish(G)) html += '<button class="btn" id="aFish">🎣 Fish</button>';
    html += '<button class="btn ghost" id="aClose" style="margin-left:auto">Close</button></div>';
    if (v.t === 'dock') {
      html += `<div class="boats">${BOATS.map(b => {
        const bi = CONFIG.boats[b];
        const p = boatProblem(G, sel!, b);
        return `<button class="boat-btn" data-b="${b}"${p ? ` disabled title="${esc(p)}"` : ''}><svg viewBox="-18 -32 36 40" aria-hidden="true">${boatSvg(b)}</svg><span class="boat-name"><b>${bi.name}</b><br>+${bi.food}🐟${bi.pearls ? ` +${bi.pearls}🦪` : ''} a night</span><span class="boat-cost">${v.l < bi.dock ? `dock level ${bi.dock}` : costHtml(bi.cost)}</span></button>`;
      }).join('')}</div>`;
    }
    tools.innerHTML = html;
    document.getElementById('aUp')?.addEventListener('click', () => { if (sel) void doUpgrade(sel); });
    document.getElementById('aFish')?.addEventListener('click', fish);
    $('aClose').onclick = () => { play('tap'); sel = null; render(); };
    tools.querySelectorAll<HTMLButtonElement>('.boat-btn').forEach(b => {
      b.onclick = () => { if (sel) void doBoat(sel, b.dataset.b as BoatType); };
    });
    return;
  }

  info.innerHTML = hint ? `<span class="warn-text">${esc(hint)}</span>`
    : built ? `<b>${built}</b> Pick the next thing to build, or tap a building to upgrade it.`
    : G.mission === 0 ? 'Welcome! You need <b>wood</b> first. Pick the <b>Lumber camp</b> and put it next to a forest.'
    : 'Pick something to build, or tap your island. Tap the clouds to explore new land.';
  built = '';
  tools.innerHTML = buildMenu();
  wireBuildMenu();
}

function pendingPreview(k: string, t: BuildableType): string {
  if (t === 'road') return 'Paths connect buildings to the town square.';
  if (t === 'house') return 'Home for 2 more people.';
  if (t === 'farm') return 'Looks after 2 fields close by.';
  if (t === 'tower') return '+3 defence.';
  const tmp = structuredClone(G);
  tmp.actions = 0;
  tmp.res = { food: 999, wood: 999, stone: 999, pearls: 999 };
  try { build(tmp, k, t); } catch { return ''; }
  const e = economy(tmp);
  if (t === 'field' && !e.farmed.has(k)) return '<span class="warn-text">No farm with room close by, so it will not grow food.</span>';
  const y = e.perTile[k];
  return y ? `It will make ${formatYield(y)} a night.` : '';
}

function buildMenu(): string {
  const g = currentMission(G)?.focus;
  const open = BUILD_MENU.filter(t => G.unlocked.includes(t));
  const menu = [...(g && open.includes(g) ? [g] : []), ...open.filter(t => t !== g), ...BUILD_MENU.filter(t => !G.unlocked.includes(t))];
  return `<div class="buildbar">${menu.map(t => {
    const c = buildCost(t);
    const locked = !G.unlocked.includes(t);
    const ok = !locked && canPay(G, c) && (t === 'road' || G.actions < CONFIG.actionsPerDay);
    return `<button class="bmenu${ok ? '' : ' off'}${locked ? ' locked' : ''}${g === t && !locked ? ' goal' : ''}" data-t="${t}"><span class="bi">${menuIcon(t)}${locked ? '<span class="lock">🔒</span>' : ''}</span><span class="bn">${BUILDINGS[t].name}</span><span class="bc">${locked ? 'locked' : costHtml(c)}</span></button>`;
  }).join('')}</div>`;
}
function wireBuildMenu(): void {
  $('tools').querySelectorAll<HTMLButtonElement>('.bmenu').forEach(b => {
    b.onclick = () => {
      if (busy) return;
      const t = b.dataset.t as BuildableType;
      if (!G.unlocked.includes(t)) {
        const by = MISSIONS.findIndex(m => m.unlock?.includes(t));
        hint = `${BUILDINGS[t].name} is locked. Mission ${by + 1} unlocks it: ${MISSIONS[by]?.text ?? ''}.`;
        play('error'); render(); return;
      }
      tool = t; pending = null; sel = null; hint = '';
      play('select'); tap(); render();
    };
  });
}

// ---------- boot ----------
(async () => {
  best = await loadBest();
  const saved = await loadGame();
  G = saved ?? newGame();
  startScreen(!!saved && !saved.over && (saved.day > 1 || saved.actions > 0 || Object.keys(saved.b).length > 1));
})();
