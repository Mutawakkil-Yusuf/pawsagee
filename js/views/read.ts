// A quiet, book-like reading view for public-domain editions.
import { html, el } from '../html';
import { ic, mochi, sheet, toast } from '../ui';
import { bookById } from '../actions';
import { navigate, back } from '../router';
import { findReaderText, cleanText, toPages, type Page } from '../reader';
import { sfx } from '../sound';
import type { RouteParams, UserBook } from '../types';

const SET = 'pawsage.reader.settings';
const POS = 'pawsage.reader.pos';
type Theme = 'paper' | 'sepia' | 'night';
interface ReaderSettings { size: number; theme: Theme; leading: number }

const defaults: ReaderSettings = { size: 19, theme: 'paper', leading: 1.75 };
function getSettings(): ReaderSettings {
  try { return { ...defaults, ...(JSON.parse(localStorage.getItem(SET) || '{}') as Partial<ReaderSettings>) }; } catch { return defaults; }
}
function saveSettings(s: ReaderSettings) { try { localStorage.setItem(SET, JSON.stringify(s)); } catch { /* ignore */ } }
function getPos(ub: UserBook): number { try { return Number(JSON.parse(localStorage.getItem(POS) || '{}')[ub.id]) || 0; } catch { return 0; } }
function savePos(ub: UserBook, p: number) {
  try { const all = JSON.parse(localStorage.getItem(POS) || '{}') as Record<string, number>; all[ub.id] = p; localStorage.setItem(POS, JSON.stringify(all)); } catch { /* ignore */ }
}

export function read({ id }: RouteParams) {
  const ub = bookById(id);
  if (!ub) { navigate('/library', { replace: true }); return el(html``); }

  const settings = getSettings();
  const root = el(html`<header class="rdr-h">
  <button class="iconbtn" data-act="back" aria-label="Back">${ic.back}</button>
  <div class="rdr-title"><b>${ub.book.title}</b><small>${(ub.book.authors || [])[0] || ''}</small></div>
  <button class="iconbtn" data-act="toc" aria-label="Contents">${ic.shelf}</button>
  <button class="iconbtn" data-act="settings" aria-label="Reading settings">${ic.more}</button>
</header>
<div class="rdr-progress"><i id="rdr-fill"></i></div>
<div class="rdr-stage" id="stage">
  <div class="rdr-loading">${mochi('reading', { size: 120 })}<p class="muted">finding a readable edition…</p></div>
</div>
<footer class="rdr-foot">
  <button class="round" data-act="prev" aria-label="Previous page">${ic.back}</button>
  <div class="rdr-mid"><span id="rdr-page">—</span><input id="rdr-slider" class="rdr-slider" type="range" min="0" max="0" value="0" aria-label="Page position"></div>
  <button class="round pri" data-act="next" aria-label="Next page">${ic.chevron}</button>
</footer>`);
  root.classList.add('reader');

  const stage = root.querySelector<HTMLElement>('#stage')!;
  const fill = root.querySelector<HTMLElement>('#rdr-fill')!;
  const label = root.querySelector<HTMLElement>('#rdr-page')!;
  const slider = root.querySelector<HTMLInputElement>('#rdr-slider')!;
  let pages: Page[] = [];
  let page = Math.min(getPos(ub), Math.max(0, pages.length - 1));
  let chapters: { title: string; n: number }[] = [];

  const applyTheme = () => { root.dataset.theme = settings.theme; root.style.setProperty('--r-size', settings.size + 'px'); root.style.setProperty('--r-leading', String(settings.leading)); };
  applyTheme();

  const paint = () => {
    if (!pages.length) return;
    const p = pages[page];
    const isStart = chapters.some(c => c.n === page + 1);
    const pct = Math.round((page + 1) / pages.length * 100);
    stage.innerHTML = String(html`<article class="rdr-paper ${isStart ? 'start' : ''}">
  <div class="rdr-chapter">${p.chapter}</div>
  <div class="rdr-body">${p.text.split('\n').map(line => html`<p>${line.trim() || '\u00a0'}</p>`)}</div>
  <div class="rdr-folio">${page + 1} <span>/ ${pages.length}</span></div>
</article>`);
    fill.style.width = pct + '%';
    label.textContent = `${page + 1} / ${pages.length}`;
    slider.max = String(pages.length - 1); slider.value = String(page);
    savePos(ub, page);
    stage.scrollTop = 0;
    const prev = root.querySelector<HTMLButtonElement>('[data-act=prev]')!;
    prev.disabled = page === 0;
    const next = root.querySelector<HTMLButtonElement>('[data-act=next]')!;
    next.disabled = page === pages.length - 1;
  };
  const go = (n: number) => { const next = Math.max(0, Math.min(pages.length - 1, n)); if (next === page) return; page = next; sfx.step(); paint(); };

  // load text (cache in memory per route instance; SW caches the network response)
  (async () => {
    try {
      const found = await findReaderText(ub.book);
      if (!found) {
        stage.innerHTML = String(html`<div class="rdr-empty">${mochi('sleepy', { size: 110 })}<h2 class="title">not readable here yet</h2><p class="muted">Mochi couldn't find a free edition of this one. Your place is still saved.</p><a class="btn white" href="#/book/${ub.id}">back to the book</a></div>`);
        return;
      }
      pages = toPages(cleanText(found.raw));
      if (!pages.length) throw new Error('empty text');
      chapters = pages.filter((p, i) => i === 0 || p.chapter !== pages[i - 1].chapter).map(p => ({ title: p.chapter, n: p.n }));
      page = Math.min(getPos(ub), pages.length - 1);
      paint();
    } catch {
      stage.innerHTML = String(html`<div class="rdr-empty">${mochi('sleepy', { size: 110 })}<p class="muted">mochi couldn't load the text. try again when you're online.</p><button class="btn white" data-act="retry">try again</button></div>`);
    }
  })();

  root.addEventListener('click', e => {
    const a = (e.target as Element).closest('[data-act]') as HTMLElement | null; if (!a) return;
    const act = a.dataset.act;
    if (act === 'back') back('/book/' + id);
    if (act === 'prev') go(page - 1);
    if (act === 'next') go(page + 1);
    if (act === 'retry') location.reload();
    if (act === 'settings') settingsSheet();
    if (act === 'toc') tocSheet();
  });
  slider.addEventListener('input', () => go(Number(slider.value)));
  root.addEventListener('keydown', e => {
    if ((e as KeyboardEvent).key === 'ArrowLeft') go(page - 1);
    if ((e as KeyboardEvent).key === 'ArrowRight') go(page + 1);
  });

  // touch swipe to turn pages
  let x0: number | null = null;
  stage.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 70) go(page + (dx < 0 ? 1 : -1));
  }, { passive: true });

  function settingsSheet() {
    sheet(html`<h2>reading settings</h2>
  <div class="setrow"><span>text size</span><div class="mini-step"><button class="round sm" data-s="dec" aria-label="Smaller">${ic.minus}</button><b id="rv-size">${settings.size}</b><button class="round sm pri" data-s="inc" aria-label="Bigger">${ic.plus}</button></div></div>
  <div class="setrow"><span>line spacing</span><div class="mini-step"><button class="round sm" data-l="dec" aria-label="Tighter">${ic.minus}</button><b id="rv-lead">${settings.leading.toFixed(2)}</b><button class="round sm pri" data-l="inc" aria-label="Looser">${ic.plus}</button></div></div>
  <div class="setrow"><span>page look</span><div class="chips tight">${(['paper', 'sepia', 'night'] as Theme[]).map(t => html`<button class="chip sm ${settings.theme === t ? 'on' : ''}" data-t="${t}">${t}</button>`)}</div></div>`,
    { title: 'Reading settings', onMount: (sh, close) => {
      sh.addEventListener('click', e => {
        const t = (e.target as Element).closest('[data-s],[data-l],[data-t]') as HTMLElement | null; if (!t) return;
        if (t.dataset.s) { settings.size = Math.max(15, Math.min(28, settings.size + (t.dataset.s === 'inc' ? 1 : -1))); sh.querySelector('#rv-size')!.textContent = String(settings.size); }
        if (t.dataset.l) { settings.leading = Math.max(1.4, Math.min(2.2, +(settings.leading + (t.dataset.l === 'inc' ? 0.1 : -0.1)).toFixed(2))); sh.querySelector('#rv-lead')!.textContent = settings.leading.toFixed(2); }
        if (t.dataset.t) { settings.theme = t.dataset.t as Theme; sh.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x === t)); }
        saveSettings(settings); applyTheme();
      });
      const done = document.createElement('button'); done.className = 'btn primary'; done.textContent = 'done'; done.dataset.close = '';
      sh.querySelector('.sheet-body')!.append(done);
    } });
  }

  function tocSheet() {
    if (!chapters.length) { toast('contents are still loading.'); return; }
    sheet(html`<h2>contents</h2><div class="toc">${chapters.map(c => html`<button class="toc-item ${c.n === page + 1 ? 'on' : ''}" data-p="${c.n - 1}"><span>${c.title}</span><small>${c.n}</small></button>`)}</div>`,
      { title: 'Contents', onMount: (sh, close) => sh.addEventListener('click', e => {
        const b = (e.target as Element).closest('[data-p]') as HTMLElement | null; if (!b) return;
        close(); go(Number(b.dataset.p));
      }) });
  }

  return root;
}
