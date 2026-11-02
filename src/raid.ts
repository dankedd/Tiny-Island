import type { NightReport, PirateShip } from './game/types';
import { buildingSvg, pirateShip } from './art';
import { fleetText } from './game/rules';
import { play } from './audio';
import { tap } from './feedback';

/**
 * The pirate raid scene: a stormy night, pirate ships sail in from the horizon,
 * then the cannons fire. Towers win with a big BOOM, or the pirates crash ashore with a BANG.
 */

/** A seeded wobble so explosions look hand-drawn but stay the same each frame. */
function rand(seed: number): () => number {
  let a = seed;
  return () => { a = (a * 9301 + 49297) % 233280; return a / 233280; };
}

/** A comic explosion: speed lines, a jagged orange blast and a puffy smoke cloud. */
export function explosion(x: number, y: number, r: number, seed = 1): string {
  const rnd = rand(seed);
  let lines = '';
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2 + rnd() * 0.1;
    const r1 = r * (1.05 + rnd() * 0.25), r2 = r * (1.5 + rnd() * 0.7);
    lines += `<path d="M${(x + Math.cos(a) * r1).toFixed(1)} ${(y + Math.sin(a) * r1).toFixed(1)} L${(x + Math.cos(a) * r2).toFixed(1)} ${(y + Math.sin(a) * r2).toFixed(1)}" stroke="#111" stroke-width="${(1 + rnd() * 2.2).toFixed(1)}" stroke-linecap="round"/>`;
  }
  const jag = (rr: number, n: number) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const d = rr * (i % 2 ? 0.72 + rnd() * 0.12 : 1 + rnd() * 0.18);
    return `${(x + Math.cos(a) * d).toFixed(1)},${(y + Math.sin(a) * d).toFixed(1)}`;
  }).join(' ');
  let puffs = '';
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2, d = rnd() * r * 0.5;
    const pr = r * (0.22 + rnd() * 0.18);
    const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d * 0.9;
    puffs += `<circle cx="${(cx + pr * 0.12).toFixed(1)}" cy="${(cy + pr * 0.18).toFixed(1)}" r="${pr.toFixed(1)}" fill="#b9b4b0"/>`;
    puffs += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(pr * 0.9).toFixed(1)}" fill="#f6f2ec"/>`;
  }
  return `<g class="blast" style="transform-origin:${x}px ${y}px">
    <g class="speed">${lines}</g>
    <polygon points="${jag(r * 1.05, 28)}" fill="#e8501f" stroke="#111" stroke-width="3" stroke-linejoin="round"/>
    <polygon points="${jag(r * 0.82, 22)}" fill="#f7902a"/>
    <circle cx="${x}" cy="${y}" r="${r * 0.62}" fill="#ffd34d"/>
    ${puffs}
  </g>`;
}

/** A comic sound-effect word on a spiky burst, like BOOM or BANG. */
export function burstWord(x: number, y: number, word: string, w: number, colors = { burst: '#ffd34d', text: '#e0302a' }, rot = -10): string {
  const n = 22, rnd = rand(word.length * 7 + Math.round(x));
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = i % 2 ? 0.62 : 1 + rnd() * 0.25;
    return `${(Math.cos(a) * w * 0.62 * k).toFixed(1)},${(Math.sin(a) * w * 0.4 * k).toFixed(1)}`;
  }).join(' ');
  return `<g class="word" style="transform-origin:${x}px ${y}px"><g transform="translate(${x},${y}) rotate(${rot})">
    <polygon points="${pts}" fill="#111" transform="translate(5,6)"/>
    <polygon points="${pts}" fill="${colors.burst}" stroke="#111" stroke-width="4" stroke-linejoin="round"/>
    <polygon points="${pts}" fill="url(#rDots)" opacity=".35"/>
    <text text-anchor="middle" y="${(w * 0.11).toFixed(1)}" font-size="${Math.min(w * 0.3, (w * 1.45) / word.length).toFixed(1)}" class="sfxword" fill="${colors.text}" stroke="#111" stroke-width="${(w * 0.025).toFixed(1)}" paint-order="stroke">${word}</text>
  </g></g>`;
}

const SHIP_SIZE: Record<PirateShip, number> = { raft: 2.6, sloop: 2.5, brig: 2, galleon: 1.65 };

function scene(rep: NightReport, ships: PirateShip[], towers: number): string {
  const won = !!rep.stormWon;
  const rnd = rand(7);
  const stars = Array.from({ length: 30 }, () => `<circle cx="${(rnd() * 400).toFixed(0)}" cy="${(rnd() * 200).toFixed(0)}" r="${(0.6 + rnd()).toFixed(1)}" fill="#fff" opacity=".7"/>`).join('');
  const rain = Array.from({ length: 50 }, () => {
    const x = rnd() * 460 - 30, y = rnd() * 700;
    return `<path d="M${x.toFixed(0)} ${y.toFixed(0)} l-8 22" />`;
  }).join('');
  const waveRow = (y: number, op: number, w: number) => `<g class="swell" style="animation-duration:${3 + w}s">${Array.from({ length: 12 }, (_, i) =>
    `<path d="M${i * 44 - 40} ${y} q11 -${4 + w} 22 0 t22 0" stroke="rgba(220,240,255,${op})" stroke-width="${1.2 + w * 0.5}" fill="none"/>`).join('')}</g>`;
  // Ships come in from the horizon, side by side.
  const spots = ships.map((_, i) => 200 + (i - (ships.length - 1) / 2) * (ships.length > 2 ? 125 : 150));
  const fleet = ships.map((k, i) => {
    const x = spots[i];
    const flip = x > 200 ? ' scale(-1,1)' : '';
    return `<g class="sail-in" style="animation-delay:${0.3 + i * 0.25}s;--x:${x}px"><g class="${won ? 'flee' : 'land'}" style="animation-delay:${3.6 + i * 0.1}s">
      <g class="rock"><g transform="scale(${SHIP_SIZE[k]})${flip}">${pirateShip(k)}</g></g></g></g>`;
  }).join('');
  const shore = `<path d="M-20 600 Q90 560 200 572 Q310 584 420 556 L420 720 L-20 720 Z" fill="#c9a66b"/>
    <path d="M-20 590 Q90 550 200 562 Q310 574 420 546 L420 600 Q300 610 200 600 Q90 592 -20 620 Z" fill="#e8c98a"/>`;
  const towerArt = Array.from({ length: Math.max(1, Math.min(3, towers)) }, (_, i) =>
    `<g transform="translate(${60 + i * 140},${618 + (i % 2) * 6}) scale(2.2)">${towers ? buildingSvg({ t: 'tower', l: 2 }) : buildingSvg({ t: 'house', l: 1 })}</g>`).join('');
  const target = spots[Math.floor(ships.length / 2)];
  const hits = won
    ? spots.map((x, i) => `<g class="pop" style="animation-delay:${3.1 + i * 0.25}s">${explosion(x, 420, 46, 3 + i)}</g>`).join('')
      + `<g class="pop" style="animation-delay:3s">${burstWord(200, 255, 'BOOM!', 170)}</g>`
    : `<g class="pop" style="animation-delay:3.4s">${explosion(130, 560, 70, 9)}</g>`
      + `<g class="pop" style="animation-delay:3.2s">${burstWord(265, 480, 'BANG!', 150, { burst: '#e85a4f', text: '#ffd34d' }, 8)}</g>`;
  const shots = won
    ? spots.map((x, i) => `<path class="shot" style="animation-delay:${2.6 + i * 0.2}s" d="M${60 + (i % 3) * 140} 560 Q${(60 + x) / 2} 330 ${x} 420" />`).join('')
    : `<path class="shot" style="animation-delay:2.9s" d="M${target} 430 Q170 420 130 560"/>`;
  return `<svg viewBox="0 0 400 700" preserveAspectRatio="xMidYMid slice" class="raid-svg">
    <defs>
      <linearGradient id="rSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070f22"/><stop offset=".55" stop-color="#1c2e52"/><stop offset="1" stop-color="#3a3b5e"/></linearGradient>
      <linearGradient id="rSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#173d5a"/><stop offset="1" stop-color="#081d2e"/></linearGradient>
      <pattern id="rDots" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.3" fill="#111"/></pattern>
    </defs>
    <rect width="400" height="700" fill="url(#rSky)"/>${stars}
    <circle cx="320" cy="90" r="34" fill="#fff6c4"/><circle cx="334" cy="82" r="30" fill="#1c2e52" opacity=".35"/>
    <g class="storm"><ellipse cx="90" cy="90" rx="120" ry="34" fill="#141c33"/><ellipse cx="300" cy="140" rx="140" ry="30" fill="#18213b"/></g>
    <rect class="flash" width="400" height="700" fill="#fff"/>
    <rect y="300" width="400" height="400" fill="url(#rSea)"/>
    ${waveRow(320, 0.2, 0)}${waveRow(370, 0.25, 1)}${waveRow(450, 0.3, 2)}${waveRow(530, 0.35, 3)}
    <g class="fleet">${fleet}</g>
    ${shore}${towerArt}
    <g class="shots">${shots}</g>
    ${hits}
    <g class="rain">${rain}</g>
    <g class="pop" style="animation-delay:.9s">${burstWord(200, 170, 'PIRATES!', 210, { burst: '#ffd34d', text: '#111' }, -6)}</g>
  </svg>`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Plays the raid scene and waits until the player taps Continue (or skips). */
export function raidScene(rep: NightReport, towers: number): Promise<void> {
  const ships = rep.ships ?? ['sloop'];
  const won = !!rep.stormWon;
  const el = document.createElement('div');
  el.className = 'raid';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'The pirates attack');
  el.innerHTML = `${scene(rep, ships, towers)}
    <div class="raid-cap top">The Fog Pirates are coming with ${esc(fleetText(ships))}!</div>
    <div class="raid-cap end">${won ? 'Your towers chase them away!' : 'They are too strong! They grab wood and stone.'}</div>
    <button class="btn raid-go">Continue</button>`;
  document.body.appendChild(el);
  const fast = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (fast) el.classList.add('skip');
  const timers: number[] = [];
  const at = (ms: number, f: () => void) => timers.push(window.setTimeout(f, fast ? 0 : ms));
  at(0, () => play('pirates'));
  at(900, () => tap(true));
  at(2700, () => play('cast'));
  at(3100, () => { play(won ? 'victory' : 'defeat'); tap(true); });
  at(4600, () => el.classList.add('done'));
  return new Promise(res => {
    const go = el.querySelector<HTMLButtonElement>('.raid-go')!;
    go.onclick = e => { e.stopPropagation(); play('tap'); timers.forEach(clearTimeout); el.remove(); res(); };
    // Tap anywhere to jump to the end of the scene.
    el.addEventListener('click', () => { if (!el.classList.contains('done')) { el.classList.add('skip', 'done'); } });
  });
}
