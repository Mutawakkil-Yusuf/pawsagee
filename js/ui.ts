// Shared UI pieces: icons, mochi, covers, rings, toast, sheet, confetti, count-up.
import { html, raw, el, escape } from './html';
import { sfx } from './sound';
import { candidates } from './covers';
import { gradFor } from './grads';
import type { BookDoc, CatalogBook, ReadingStatus } from './types';

export { gradFor };
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const svg = (p: string, { fill = 'none', sw = 2.2 }: { fill?: string; sw?: number } = {}) =>
  raw(`<svg aria-hidden="true" class="ic" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`);

export const ic = {
  home: svg('<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>'),
  shelf: svg('<path d="M5 4h4v16H5zM10 6h4v14h-4zM15.5 5.5l3.5-1 3 14-3.5 1z"/>'),
  add: svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'),
  stats: svg('<path d="M5 20V10M12 20V4M19 20v-7"/>'),
  more: svg('<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>', { fill: 'currentColor', sw: 0 }),
  back: svg('<path d="M15 5l-7 7 7 7"/>', { sw: 2.8 }),
  chevron: svg('<path d="M9 5l7 7-7 7"/>', { sw: 2.8 }),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', { sw: 2.6 }),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>', { sw: 2.8 }),
  check: svg('<path d="M5 12l5 5 9-10"/>', { sw: 3.2 }),
  plus: svg('<path d="M12 5v14M5 12h14"/>', { sw: 2.8 }),
  minus: svg('<path d="M5 12h14"/>', { sw: 2.8 }),
  play: svg('<path d="M8 5v14l11-7z"/>', { fill: 'currentColor', sw: 1.5 }),
  pause: svg('<rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/>', { fill: 'currentColor', sw: 0 }),
  flame: svg('<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>', { fill: 'currentColor', sw: 1.2 }),
  heart: svg('<path d="M12 21s-8-5.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.5-8 11-8 11z"/>', { fill: 'currentColor', sw: 1.5 }),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/>'),
  scan: svg('<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/>'),
  timer: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M10 2h4"/>'),
  book: svg('<path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2zM22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>'),
  up: svg('<path d="M6 15l6-6 6 6"/>', { sw: 2.8 }),
  down: svg('<path d="M6 9l6 6 6-6"/>', { sw: 2.8 }),
  download: svg('<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>'),
  share: svg('<path d="M12 15V4M8 8l4-4 4 4M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6"/>'),
  star: raw('<svg aria-hidden="true" class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.5l2.9 6.2 6.6.8-4.9 4.6 1.3 6.7L12 17.5 6.1 20.8l1.3-6.7L2.5 9.5l6.6-.8z"/></svg>'),
};

/* ---------- Mochi ---------- */
export const mochi = (name = 'happy', { size = 96, cls = 'idle', label }: { size?: number; cls?: string; label?: string } = {}) => {
  const alt = label ?? `Mochi the cat, ${name.replace('-', ' ')}`;
  return html`<img class="mochi ${cls}" src="/assets/mochi/mochi-${name}.svg" alt="${alt}" height="${size}" style="height:${size}px;width:auto" data-sfx="none" draggable="false">`;
};

document.addEventListener('click', e => {
  const m = (e.target as Element)?.closest?.('.mochi') as HTMLElement | null;
  if (!m) return;
  m.classList.remove('bounce'); void m.offsetWidth; m.classList.add('bounce');
  sfx.meow();
  setTimeout(() => m.classList.remove('bounce'), 450);
});

/* ---------- Covers ---------- */
const genInner = (title: unknown, author: unknown) =>
  `<span class="ct">${escape(title)}</span>${author ? `<span class="ca">${escape(author)}</span>` : ''}`;

/** A book cover. Tries every known image source in turn, then falls back to a stable generated cover. */
export function cover(book: BookDoc & { id?: string }, { w = 72, cls = '', size = 'M' }: { w?: number; cls?: string; size?: string } = {}) {
  const g = gradFor(book.title);
  const author = (book.authors || [])[0] || '';
  const c = candidates(book, size);
  return html`<span class="cover ${g.dark ? 'dark' : ''} ${cls}" style="--cw:${w}px;--a:${g.a};--b:${g.b}" data-t="${book.title}" data-a="${author}" data-bid="${book.id || book.key || book.title}" data-srcs="${c.slice(1).join('|')}">${
    c.length ? raw(`<img class="cover-img" src="${escape(c[0])}" alt="" loading="lazy" decoding="async">`) : raw(genInner(book.title, author))
  }</span>`;
}
// A source failed (or was Open Library's 1px placeholder)? Try the next one, else show the generated cover.
// Inline onerror is blocked by our CSP, so we listen at the document.
document.addEventListener('error', e => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.classList.contains('cover-img')) return;
  const p = img.parentElement;
  if (!p) return;
  const rest = (p.dataset.srcs || '').split('|').filter(Boolean);
  if (rest.length) { p.dataset.srcs = rest.slice(1).join('|'); img.src = rest[0]; return; }
  p.innerHTML = genInner(p.dataset.t, p.dataset.a);
}, true);
document.addEventListener('load', e => {
  const img = e.target;
  if (img instanceof HTMLImageElement && img.classList.contains('cover-img') && img.naturalWidth < 20) img.dispatchEvent(new Event('error'));
}, true);

/* ---------- Ring and bar ---------- */
export function ring({ pct = 0, size = 120, stroke = 14, color = 'var(--pink)', track = 'var(--lilac-100)', inner = '' }: { pct?: number; size?: number; stroke?: number; color?: string; track?: string; inner?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return html`<span class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
<circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-c="${c}" data-p="${Math.min(1, Math.max(0, pct))}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><span class="ring-in">${raw(inner)}</span></span>`;
}
export const bar = (pct: number, color = '') => html`<span class="bar"><i data-p="${Math.min(100, Math.max(0, pct))}" style="${color ? 'background:' + color : ''}"></i></span>`;

/** Animate rings, bars and count-up numbers inside a freshly mounted screen. */
export function animateIn(root: HTMLElement) {
  const go = () => {
    root.querySelectorAll<SVGCircleElement>('.ring-fg').forEach(c => { c.style.strokeDashoffset = String(Number(c.dataset.c) * (1 - Number(c.dataset.p))); });
    root.querySelectorAll<HTMLElement>('.bar i').forEach(i => { i.style.width = i.dataset.p + '%'; });
  };
  reduced() ? go() : requestAnimationFrame(() => requestAnimationFrame(go));
  root.querySelectorAll<HTMLElement>('[data-count]').forEach(n => countUp(n, +n.dataset.count!, n.dataset.fmt));
}

export function countUp(node: HTMLElement, to: number, fmt = '') {
  const f = (v: number) => fmt === 'comma' ? Math.round(v).toLocaleString('en-US') : String(Math.round(v));
  if (reduced() || to < 2) { node.textContent = f(to); return; }
  const t0 = performance.now(), d = 700;
  const tick = (t: number) => { const k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 3); node.textContent = f(to * e); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

/* ---------- Stars ---------- */
export const stars = (rating = 0, id = 'stars') => html`<div class="stars" id="${id}" role="slider" aria-label="Rating" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${rating}" tabindex="0" data-sfx="none">${
  [0, 1, 2, 3, 4].map(i => { const fill = Math.max(0, Math.min(1, rating - i)); return html`<span class="star"><span class="s-bg">${ic.star}</span><span class="s-fg" style="width:${fill * 100}%">${ic.star}</span></span>`; })
}</div>`;

/* ---------- Toast ---------- */
let toastTimer: number | undefined;
export function toast(msg: string, { action, onAction, ms = 3600 }: { action?: string; onAction?: () => void; ms?: number } = {}) {
  const root = document.getElementById('toast-root')!;
  root.replaceChildren();
  const t = el(html`<span>${msg}</span>${action ? html`<button class="t-act" data-sfx="pop">${action}</button>` : ''}`, 'toast');
  t.setAttribute('role', 'status');
  root.append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  const kill = () => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); };
  clearTimeout(toastTimer); toastTimer = window.setTimeout(kill, ms);
  t.querySelector('.t-act')?.addEventListener('click', () => { onAction?.(); kill(); });
}

/* ---------- Bottom sheet ---------- */
export function sheet(content: unknown, { onMount, title }: { onMount?: (el: HTMLElement, close: () => void) => void; title?: string } = {}) {
  const root = document.getElementById('sheet-root')!;
  const scrim = el(html`<div class="scrim"></div><div class="sheet" role="dialog" aria-modal="true" ${title ? html`aria-label="${title}"` : ''}><div class="grab" data-sfx="none"></div><div class="sheet-body">${content}</div></div>`, 'sheet-wrap');
  root.append(scrim);
  const sh = scrim.querySelector<HTMLElement>('.sheet')!;
  const prevFocus = document.activeElement as HTMLElement | null;
  const close = () => {
    scrim.classList.remove('in'); document.removeEventListener('keydown', onKey);
    setTimeout(() => { scrim.remove(); prevFocus?.focus?.(); }, 260);
    sfx.swish();
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  scrim.querySelector('.scrim')!.addEventListener('click', close);
  sh.addEventListener('click', e => { if ((e.target as Element).closest('[data-close]')) close(); });
  // drag down to dismiss
  let y0: number | null = null;
  const grab = scrim.querySelector<HTMLElement>('.grab')!;
  grab.addEventListener('pointerdown', e => { y0 = e.clientY; grab.setPointerCapture(e.pointerId); sh.style.transition = 'none'; });
  grab.addEventListener('pointermove', e => { if (y0 !== null) sh.style.transform = `translateY(${Math.max(0, e.clientY - y0)}px)`; });
  const end = (e: PointerEvent) => { if (y0 === null) return; const dy = e.clientY - y0; y0 = null; sh.style.transition = ''; sh.style.transform = ''; if (dy > 90) close(); };
  grab.addEventListener('pointerup', end); grab.addEventListener('pointercancel', end);
  requestAnimationFrame(() => { scrim.classList.add('in'); sh.querySelector<HTMLElement>('input,textarea,button')?.focus({ preventScroll: true }); });
  sfx.swish();
  onMount?.(sh, close);
  return { el: sh, close };
}

/* ---------- Confetti ---------- */
export function confetti({ count = 90 }: { count?: number } = {}) {
  if (reduced()) return;
  const cv = document.createElement('canvas');
  cv.className = 'confetti'; cv.setAttribute('aria-hidden', 'true');
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  document.body.append(cv);
  const cx = cv.getContext('2d'); if (!cx) return;
  cx.scale(dpr, dpr);
  const cols = ['#FFFFFF', '#FF8FB3', '#FFE8A3', '#C8F0E0', '#6C57E8', '#B8E2F7'];
  interface Piece { x: number; y: number; vx: number; vy: number; w: number; h: number; r: number; vr: number; c: string; dot: boolean }
  const ps: Piece[] = Array.from({ length: count }, () => ({
    x: innerWidth / 2 + (Math.random() - .5) * 120, y: innerHeight * 0.35,
    vx: (Math.random() - .5) * 11, vy: -Math.random() * 11 - 3,
    w: 6 + Math.random() * 8, h: Math.random() < .5 ? 6 + Math.random() * 8 : 14 + Math.random() * 6,
    r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: cols[(Math.random() * cols.length) | 0], dot: Math.random() < .35,
  }));
  const t0 = performance.now();
  const frame = (t: number) => {
    const k = (t - t0) / 2400;
    cx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of ps) {
      p.vy += 0.32; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      cx.save(); cx.globalAlpha = Math.max(0, 1 - Math.max(0, k - .6) / .4);
      cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c;
      cx.beginPath();
      if (p.dot) cx.arc(0, 0, p.w / 2, 0, 7); else cx.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, p.w / 2);
      cx.fill(); cx.restore();
    }
    if (k < 1) requestAnimationFrame(frame); else cv.remove();
  };
  requestAnimationFrame(frame);
}

/* ---------- Small helpers ---------- */
export const statusLabel = (s: ReadingStatus | string) => ({ want: 'want to read', reading: 'reading', finished: 'finished', paused: 'paused' }[s] || s);
export const authorsLine = (b: { authors?: string[] }) => (b.authors || []).join(' & ');
export const SHELF_COLORS: Record<string, { bg: string; deep: string }> = {
  rose: { bg: 'linear-gradient(135deg,#FFC6E0,#FFE3C8)', deep: '#FF8FB3' },
  lilac: { bg: 'linear-gradient(135deg,#D9CCFF,#B8E2F7)', deep: '#A593F5' },
  mint: { bg: 'linear-gradient(135deg,#C8F0E0,#FFE8F3)', deep: '#8FE0BF' },
  butter: { bg: 'linear-gradient(135deg,#FFE8A3,#FFC6E0)', deep: '#FFD36B' },
  sky: { bg: 'linear-gradient(135deg,#B8E2F7,#D9CCFF)', deep: '#8CCDF5' },
};
export const swatches = (sel = 'rose', name = 'color') => html`<div class="swatches" role="radiogroup" aria-label="Shelf color">${
  Object.entries(SHELF_COLORS).map(([k, v]) => html`<button type="button" class="swatch ${k === sel ? 'on' : ''}" role="radio" aria-checked="${k === sel}" aria-label="${k}" data-act="${name}" data-v="${k}" data-sfx="pop" style="background:${v.bg};--deep:${v.deep}"></button>`)
}</div>`;
