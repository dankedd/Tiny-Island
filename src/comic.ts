import type { NightReport, PirateShip } from './game/types';
import { buildingSvg, person, pirateShip } from './art';
import { fleetText } from './game/rules';
import { play } from './audio';
import { tap } from './feedback';

/**
 * The pirate cutscene: a comic strip with three panels.
 * 1. A lookout spots the ships. 2. The captain shouts. 3. Boom or crash, depending on who won.
 */

const LINES: Record<PirateShip, string> = {
  raft: 'Arr! Even a tiny raft can steal yer wood!',
  sloop: 'Hoist the sails, lads! That island looks rich!',
  brig: 'Load the cannons! Grab every stone ye see!',
  galleon: 'I am Captain Fogbeard! Hand over yer pearls!',
};

const night = `<defs>
  <linearGradient id="cSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d2340"/><stop offset="1" stop-color="#2b4f7a"/></linearGradient>
  <linearGradient id="cSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f5d7a"/><stop offset="1" stop-color="#0f3348"/></linearGradient>
</defs>`;

const stars = Array.from({ length: 14 }, (_, i) => `<circle cx="${(i * 37) % 200}" cy="${(i * 23) % 60 + 4}" r="${i % 3 ? 0.8 : 1.3}" fill="#fff" opacity=".8"/>`).join('');
const waves = (y: number, c = 'rgba(255,255,255,.35)') =>
  Array.from({ length: 6 }, (_, i) => `<path d="M${i * 36 - 10} ${y + (i % 2) * 6} q8 -4 16 0 t16 0" stroke="${c}" stroke-width="1.6" fill="none"/>`).join('');

function lookoutPanel(ships: PirateShip[]): string {
  return `<svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice">${night}
    <rect width="200" height="200" fill="url(#cSky)"/>${stars}
    <circle cx="160" cy="34" r="16" fill="#fff6c4"/><circle cx="166" cy="30" r="14" fill="#0d2340" opacity=".25"/>
    <rect y="112" width="200" height="88" fill="url(#cSea)"/>${waves(130)}${waves(165)}
    ${ships.map((k, i) => `<g transform="translate(${120 + i * 26},${112 - i * 2}) scale(.45)" opacity=".9"><g fill="#111">${pirateShip(k)}</g></g>`).join('')}
    <g transform="translate(58,192) scale(2.3)">${buildingSvg({ t: 'tower', l: 1 })}</g>
    <g transform="translate(58,135) scale(3.2)">${person(0, 0, '#4f8fd0', false)}
      <g transform="translate(1,-7.6) rotate(-8)"><rect x="0" y="-1" width="9" height="2.2" rx=".8" fill="#c9a24a" stroke="#111" stroke-width=".5"/><rect x="7.5" y="-1.4" width="2.4" height="3" fill="#8a6a2a"/></g></g>
  </svg>`;
}

function captainPanel(ship: PirateShip): string {
  const rays = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    const b = a + 0.12;
    return `<path d="M100 110 L${100 + Math.cos(a) * 220} ${110 + Math.sin(a) * 220} L${100 + Math.cos(b) * 220} ${110 + Math.sin(b) * 220} Z" fill="${i % 2 ? '#e0604f' : '#f08a5d'}"/>`;
  }).join('');
  return `<svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice">
    <rect width="200" height="200" fill="#f08a5d"/>${rays}
    <g transform="translate(150,170) scale(.9)" opacity=".9">${pirateShip(ship)}</g>
    <g transform="translate(92,118)">
      <path d="M-46 80 Q-40 30 0 28 Q40 30 46 80 Z" fill="#7a2424" stroke="#111" stroke-width="3"/>
      <path d="M-14 30 L0 52 L14 30" fill="#fdf6e3" stroke="#111" stroke-width="2"/>
      <circle r="36" fill="#f2c49b" stroke="#111" stroke-width="3"/>
      <path d="M-30 6 Q-34 44 0 50 Q34 44 30 6 Q20 22 0 22 Q-20 22 -30 6 Z" fill="#3a2418" stroke="#111" stroke-width="2.5"/>
      <path d="M-14 18 Q0 30 14 18 Q0 24 -14 18 Z" fill="#fff" stroke="#111" stroke-width="2"/>
      <rect x="3" y="18" width="4" height="5" fill="#ffd34d" stroke="#111" stroke-width="1"/>
      <path d="M-18 -8 L-6 -4" stroke="#111" stroke-width="3" stroke-linecap="round"/>
      <circle cx="-12" cy="2" r="4" fill="#111"/><circle cx="-11" cy="1" r="1.3" fill="#fff"/>
      <path d="M-34 -14 L36 10" stroke="#111" stroke-width="2.5"/>
      <ellipse cx="13" cy="0" rx="9" ry="8" fill="#111"/>
      <path d="M2 10 Q0 14 -3 10" stroke="#111" stroke-width="2" fill="none"/>
      <path d="M-56 -22 Q-30 -40 0 -36 Q30 -40 56 -22 Q40 -30 30 -26 Q20 -66 0 -64 Q-20 -66 -30 -26 Q-40 -30 -56 -22 Z" fill="#1d1d22" stroke="#111" stroke-width="3"/>
      <path d="M-30 -27 Q0 -34 30 -27" stroke="#d9a73f" stroke-width="3" fill="none"/>
      <circle cy="-46" r="7" fill="#fff"/><path d="M-6 -36 L6 -42 M-6 -42 L6 -36" stroke="#fff" stroke-width="2"/><circle cx="-2.5" cy="-47" r="1.6" fill="#111"/><circle cx="2.5" cy="-47" r="1.6" fill="#111"/>
      <circle cx="34" cy="10" r="4" fill="none" stroke="#ffd34d" stroke-width="2.5"/>
    </g>
  </svg>`;
}

function outcomePanel(won: boolean, ship: PirateShip): string {
  const burst = (x: number, y: number, r: number, c1: string, c2: string) => {
    const pts = Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2, rr = i % 2 ? r * 0.55 : r;
      return `${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`;
    }).join(' ');
    return `<polygon points="${pts}" fill="${c1}" stroke="#111" stroke-width="2.5"/><circle cx="${x}" cy="${y}" r="${r * 0.3}" fill="${c2}"/>`;
  };
  if (won) {
    return `<svg viewBox="0 0 400 210" preserveAspectRatio="xMidYMid slice">${night}
      <rect width="400" height="210" fill="url(#cSky)"/>${stars}${stars.replace(/cx="(\d+)/g, (_, n) => `cx="${Number(n) + 200}`)}
      <rect y="120" width="400" height="90" fill="url(#cSea)"/>${waves(140)}${waves(175)}
      <g transform="translate(70,200) scale(2.6)">${buildingSvg({ t: 'tower', l: 2 })}</g>
      <path d="M92 80 Q200 20 268 104" stroke="#ffd34d" stroke-width="3" stroke-dasharray="6 6" fill="none"/>
      <circle cx="140" cy="52" r="5" fill="#111"/>
      <g transform="translate(290,140) scale(1.7) scale(-1,1)">${pirateShip(ship)}</g>
      ${burst(282, 102, 40, '#ffd34d', '#fff')}
      <path d="M330 150 l20 -6 M335 160 l22 0" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
  }
  return `<svg viewBox="0 0 400 210" preserveAspectRatio="xMidYMid slice">${night}
    <rect width="400" height="210" fill="url(#cSky)"/>${stars}
    <rect y="130" width="400" height="80" fill="url(#cSea)"/>${waves(150)}
    <path d="M0 140 Q120 118 230 132 L230 210 L0 210 Z" fill="#e8c98a" stroke="#111" stroke-width="3"/>
    <g transform="translate(300,150) scale(1.6) scale(-1,1)">${pirateShip(ship)}</g>
    <g transform="translate(150,136) scale(3)">${person(0, 0, '#8a2b2b', false)}<rect x="-4" y="-14" width="8" height="6" fill="#b5834f" stroke="#111" stroke-width=".5"/></g>
    <g transform="translate(196,140) scale(3)">${person(0, 0, '#3a3a3a', false)}<rect x="-4" y="-14" width="8" height="6" fill="#a3a6ab" stroke="#111" stroke-width=".5"/></g>
    ${burst(80, 104, 36, '#e0604f', '#ffd34d')}
  </svg>`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Shows the comic and waits until the player taps Continue. */
export function comic(rep: NightReport, nightNo: number): Promise<void> {
  const ships = rep.ships ?? ['sloop'];
  const lead = ships[0];
  const won = !!rep.stormWon;
  const el = document.createElement('div');
  el.className = 'comic';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'The pirates are coming');
  el.innerHTML = `<div class="strip">
    <div class="cp">${lookoutPanel(ships)}<div class="cap" style="top:auto;bottom:6px">Night ${nightNo}...</div><div class="bub r" style="right:6px;top:8px">Ships! I see ${esc(fleetText(ships))}!</div></div>
    <div class="cp">${captainPanel(lead)}<div class="bub" style="left:8px;top:8px">${esc(LINES[lead])}</div></div>
    <div class="cp wide">${outcomePanel(won, lead)}
      <div class="sfx" style="${won ? 'right:16px;top:10px' : 'left:20px;top:14px'}">${won ? 'BOOM!' : 'CRASH!'}</div>
      <div class="cap bottom">${won ? 'Your towers chase them away!' : 'They grab your wood and stone!'}</div></div>
    <button class="btn go">Continue</button>
  </div>`;
  document.body.appendChild(el);
  const panels = [...el.querySelectorAll<HTMLElement>('.cp')];
  const go = el.querySelector<HTMLButtonElement>('.go')!;
  const fast = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timers: number[] = [];
  const at = (ms: number, f: () => void) => timers.push(window.setTimeout(f, fast ? 0 : ms));
  at(100, () => { panels[0].classList.add('show'); play('select'); });
  at(1300, () => { panels[1].classList.add('show'); play('pirates'); tap(true); });
  at(2900, () => { panels[2].classList.add('show'); play(won ? 'victory' : 'defeat'); tap(true); });
  at(3600, () => go.classList.add('show'));
  return new Promise(res => {
    const done = () => {
      timers.forEach(clearTimeout);
      el.remove();
      res();
    };
    go.onclick = () => { play('tap'); done(); };
    // Tapping the strip skips ahead: first show all panels, then close.
    el.addEventListener('click', e => {
      if (e.target === go) return;
      if (!go.classList.contains('show')) {
        timers.forEach(clearTimeout);
        panels.forEach(p => p.classList.add('show'));
        go.classList.add('show');
      }
    });
  });
}
