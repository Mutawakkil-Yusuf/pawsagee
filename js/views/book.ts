import { html, raw, el } from '../html';
import { ic, mochi, cover, bar, stars, animateIn, toast, sheet, statusLabel, authorsLine } from '../ui';
import * as store from '../store';
import { bookById, patchBook, setStatus, setBookShelves, removeBook, setPages } from '../actions';
import { dayMap, fmtMin } from '../streaks';
import { navigate, back, refresh as rerender } from '../router';
import { sfx } from '../sound';
import { pct, finishRoute } from './shared';
import type { ReadingStatus, RouteParams } from '../types';

const ST = [['want', 'want to read'], ['reading', 'reading'], ['finished', 'finished']];
const EYEBROW = { want: 'WANT TO READ', reading: 'NOW READING', finished: 'FINISHED', paused: 'PAUSED' };

export function book({ id }: RouteParams) {
  const ub = bookById(id);
  if (!ub) { navigate('/library', { replace: true }); return el(html``); }
  const sessions = store.get().sessions.filter(s => s.user_book_id === id);
  const days = dayMap(sessions);
  const pagesRead = sessions.reduce((a, s) => a + (s.pages_read || 0), 0);
  const secs = sessions.reduce((a, s) => a + (s.duration_sec || 0), 0);
  const perDay = days.size ? Math.round(pagesRead / days.size) : 0;
  const total = ub.book.page_count, left = total ? Math.max(0, total - ub.current_page) : null;
  const secPerPage = pagesRead && secs ? secs / pagesRead : 120;
  const leftTxt = left === null ? '–' : left === 0 ? 'done' : '~' + fmtMin(left * secPerPage);
  const p = pct(ub);

  const root = el(html`<header class="book-h"><button class="iconbtn" data-act="back" aria-label="Back">${ic.back}</button><span class="overline" id="eyebrow">${EYEBROW[ub.status]}</span>
<button class="iconbtn heart ${ub.is_favorite ? 'on' : ''}" data-act="fav" data-sfx="none" aria-pressed="${ub.is_favorite}" aria-label="Favorite">${ic.heart}</button></header>
<div class="book-art">${cover(ub.book, { w: 190, cls: 'tilt big', size: 'L' })}<span class="art-peek">${mochi('reading', { size: 76 })}</span></div>
<h1 class="title center book-t">${ub.book.title}</h1>
<p class="muted center">${authorsLine(ub.book)}${ub.book.first_publish_year ? ' · ' + ub.book.first_publish_year : ''}</p>
<div class="center">${stars(ub.rating || 0)}</div>
<div class="chips center" role="tablist">${ST.map(([k, l]) => html`<button class="chip ${ub.status === k ? 'on' : ''}" role="tab" aria-selected="${ub.status === k}" data-act="status" data-v="${k}">${l}</button>`)}</div>
${total ? html`<div class="prog">${bar(p, 'var(--pink)')}<div class="row"><small class="muted b">page ${ub.current_page} of ${total}</small><small class="muted b">${p}%</small></div></div>` : html`<button class="link pad" data-act="pages">add the page count to see progress</button>`}
<div class="tiles3"><div class="tile"><b data-count="${days.size}">${days.size}</b><span>days reading</span></div><div class="tile"><b data-count="${perDay}">${perDay}</b><span>pages a day</span></div><div class="tile"><b>${leftTxt}</b><span>left to read</span></div></div>
${store.get().shelves.length ? html`<div class="sec-h"><h2 class="heading">collections</h2></div><div class="chips wrap">${store.get().shelves.map(sh => html`<button class="chip ${ub.shelf_ids.includes(sh.id) ? 'on' : ''}" data-act="shelf" data-id="${sh.id}" aria-pressed="${ub.shelf_ids.includes(sh.id)}">${sh.name}</button>`)}</div>` : ''}
<div class="sec-h"><h2 class="heading">notes</h2></div>
<textarea class="input notes" id="notes" rows="3" maxlength="2000" placeholder="a thought, a quote, a page number...">${ub.notes || ''}</textarea>
<div class="dock"><a class="btn primary grow" href="#/log/${ub.id}">start a session <span class="playdot">${ic.play}</span></a><button class="iconbtn big" data-act="menu" aria-label="More options">${ic.more}</button></div>`);
  animateIn(root);

  const finishFlow = () => { const r = finishRoute(bookById(id)); if (r) navigate(r); else { sfx.finish(); toast('finished! mochi did a little dance.'); } };

  root.addEventListener('click', async e => {
    const a = ((e.target as Element).closest('[data-act]') as HTMLElement | null); if (!a) return;
    const act = a.dataset.act;
    if (act === 'back') back('/library');
    if (act === 'fav') { const v = !ub.is_favorite; ub.is_favorite = v; a.classList.toggle('on', v); a.setAttribute('aria-pressed', String(v)); v ? sfx.add() : sfx.tap(); patchBook(id, { is_favorite: v }); }
    if (act === 'status') {
      const k = a.dataset.v; if (k === ub.status) return;
      await setStatus(ub, k as ReadingStatus);
      if (k === 'finished') finishFlow(); else { sfx.pop(); rerender(); }
    }
    if (act === 'shelf') {
      const cur = new Set(bookById(id).shelf_ids); cur.has(a.dataset.id) ? cur.delete(a.dataset.id) : cur.add(a.dataset.id);
      a.classList.toggle('on'); sfx.pop();
      await setBookShelves(id, [...cur]);
    }
    if (act === 'pages') pagesSheet();
    if (act === 'menu') menu();
  });

  // half-star rating
  const st = root.querySelector('.stars');
  const setRating = r => { r = Math.max(0, Math.min(5, r)); st.setAttribute('aria-valuenow', r); st.querySelectorAll<HTMLElement>('.s-fg').forEach((f, i) => { f.style.width = Math.max(0, Math.min(1, r - i)) * 100 + '%'; }); patchBook(id, { rating: r || null }); sfx.step(r >= (ub.rating || 0)); ub.rating = r; };
  st.addEventListener('click', e => { const box = st.getBoundingClientRect(); const x = ((e as MouseEvent).clientX - box.left) / box.width * 5; const r = Math.ceil(x * 2) / 2; setRating(r === ub.rating ? 0 : r); });
  st.addEventListener('keydown', e => { if ((e as KeyboardEvent).key === 'ArrowRight' || (e as KeyboardEvent).key === 'ArrowUp') setRating((ub.rating || 0) + .5); if ((e as KeyboardEvent).key === 'ArrowLeft' || (e as KeyboardEvent).key === 'ArrowDown') setRating((ub.rating || 0) - .5); });

  // autosave notes
  let nt; const ta = root.querySelector<HTMLTextAreaElement>('#notes')!;
  ta.addEventListener('input', () => { clearTimeout(nt); nt = setTimeout(() => patchBook(id, { notes: ta.value }), 600); });
  root._cleanup = () => { if (nt) { clearTimeout(nt); patchBook(id, { notes: ta.value }); } };

  function pagesSheet() {
    sheet(html`<h2>pages</h2><form id="pf"><label class="lbl" for="tp">total pages</label><input id="tp" class="input" type="number" min="1" max="9999" name="total" value="${total || ''}">
<label class="lbl" for="cp">i'm on page</label><input id="cp" class="input" type="number" min="0" max="9999" name="cur" value="${ub.current_page}"><button class="btn primary" type="submit" data-sfx="pop">save</button></form>`,
    { title: 'Pages', onMount: (sh, close) => sh.querySelector('#pf').addEventListener('submit', async e => {
      e.preventDefault(); const f = new FormData(e.target as HTMLFormElement);
      const t = +f.get('total') || undefined; let c = Math.max(0, +f.get('cur') || 0); if (t && c > t) c = t;
      close(); await setPages(ub, { total: t, current: c }); rerender();
    }) });
  }

  function menu() {
    sheet(html`<h2>${ub.book.title}</h2><div class="menu">
<button class="btn white" data-act="m-pages">${ic.edit} edit pages</button>
${ub.status !== 'finished' ? html`<button class="btn white" data-act="m-fin" data-sfx="none">${ic.check} mark as finished</button>` : ''}
<button class="btn ghost danger" data-act="m-del" data-sfx="none">${ic.trash} remove from my shelf</button></div>`, { title: 'Book options', onMount: (sh, close) => {
      sh.addEventListener('click', async e => {
        const a = ((e.target as Element).closest('[data-act]') as HTMLElement | null); if (!a) return;
        if (a.dataset.act === 'm-pages') { close(); setTimeout(pagesSheet, 280); }
        if (a.dataset.act === 'm-fin') { close(); await setStatus(ub, 'finished'); finishFlow(); }
        if (a.dataset.act === 'm-del') sh.querySelector('.sheet-body').innerHTML = String(html`<h2>remove this book?</h2><p class="muted">your notes and sessions go too.</p><div class="split"><button class="btn white" data-close>keep it</button><button class="btn primary" data-act="m-del2" data-sfx="none">remove</button></div>`);
        if (a.dataset.act === 'm-del2') { close(); sfx.pause(); await removeBook(id); toast('removed.'); navigate('/library', { replace: true }); }
      });
    } });
  }
  return root;
}
