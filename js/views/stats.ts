import { html, raw, el } from '../html';
import { ic, mochi, ring, animateIn, sheet } from '../ui';
import * as store from '../store';
import { dayMap, currentStreak, longestStreak, monthGrid, monthStats, finishedInYear, dayKey, addDays, fmtMin } from '../streaks';
import { patchProfile } from '../actions';
import { refresh as rerender } from '../router';
import { sfx } from '../sound';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export function stats() {
  const s = store.get();
  const dm = dayMap(s.sessions);
  const now = new Date();
  let range = store.prefs.get('statsRange', 'week');
  let cy = now.getFullYear(), cm = now.getMonth();
  const goal = s.profile?.yearly_goal || 12;
  const done = finishedInYear(s.books);
  const gp = Math.min(1, done / goal);
  const mstats = monthStats(now.getFullYear(), now.getMonth(), s);
  const today = dm.get(dayKey()) || { sec: 0 };

  const chart = () => {
    let data = [];
    if (range === 'week') data = Array.from({ length: 7 }, (_, i) => { const k = addDays(dayKey(), i - 6); return { l: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(k + 'T00:00').getDay()], v: dm.get(k)?.pages || 0, now: i === 6 }; });
    if (range === 'month') data = Array.from({ length: 30 }, (_, i) => { const k = addDays(dayKey(), i - 29); return { l: i % 5 === 4 || i === 0 ? k.slice(8) : '', v: dm.get(k)?.pages || 0, now: i === 29 }; });
    if (range === 'year') data = Array.from({ length: 12 }, (_, i) => { const pre = `${now.getFullYear()}-${String(i + 1).padStart(2, '0')}`; let v = 0; dm.forEach((o, k) => { if (k.startsWith(pre)) v += o.pages; }); return { l: MONTHS[i][0], v, now: i === now.getMonth() }; });
    const max = Math.max(1, ...data.map(d => d.v));
    const total = data.reduce((a, d) => a + d.v, 0);
    return html`<div class="chart ${range}" role="img" aria-label="Pages read, ${range}: ${total} pages">${data.map((d, i) => html`<span class="col"><i class="${d.now ? 'now' : ''}" data-h="${Math.round(d.v / max * 100)}" style="--i:${i}" title="${d.v} pages"></i><small>${d.l}</small></span>`)}</div><p class="muted center b">${total.toLocaleString('en-US')} pages in the last ${range === 'week' ? '7 days' : range === 'month' ? '30 days' : 'year'}</p>`;
  };

  const cal = () => {
    const cells = monthGrid(cy, cm, dm);
    const read = cells.filter(c => c?.read).length;
    return html`<div class="row"><button class="iconbtn sm" data-act="prev" aria-label="Previous month">${ic.back}</button><b class="heading">${MONTHS[cm]} ${cy !== now.getFullYear() ? cy : ''}</b><button class="iconbtn sm" data-act="next" aria-label="Next month" ${cy === now.getFullYear() && cm === now.getMonth() ? 'disabled' : ''}>${ic.chevron}</button></div>
<div class="cal" role="grid" aria-label="Days read in ${MONTHS[cm]}">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => html`<small class="dow">${d}</small>`)}${cells.map(c => c ? html`<span class="cd ${c.read ? 'read' : ''} ${c.today ? 'today' : ''} ${c.future ? 'future' : ''}" aria-label="${c.d}${c.read ? ', read' : ''}">${c.read ? ic.check : c.d}</span>` : html`<span></span>`)}</div><p class="muted center b">${read} ${read === 1 ? 'day' : 'days'} read</p>`;
  };

  const root = el(html`<header class="lib-h"><h1 class="display">your year</h1><a class="btn primary sm" href="#/recap">${ic.share} share recap</a></header>
<button class="card goal" data-act="goal" aria-label="Edit yearly goal">${ring({ pct: gp, size: 116, stroke: 14, color: 'var(--pink)', inner: String(mochi('happy', { size: 54, cls: '' })) })}
<span class="goal-t"><small class="overline">YEARLY GOAL</small><b class="title">${done} of ${goal} books</b>${gp > .25 ? html`<small class="muted b">Mochi is so proud of you</small>` : html`<small class="muted b">every page counts</small>`}</span></button>
<div class="tiles2">
<div class="tile pink"><b data-count="${currentStreak(dm)}">0</b><span>${currentStreak(dm) === 1 ? 'day' : 'days'} · current streak</span></div>
<div class="tile butter"><b data-count="${longestStreak(dm)}">0</b><span>${longestStreak(dm) === 1 ? 'day' : 'days'} · best streak</span></div>
<div class="tile mint"><b data-count="${mstats.pages}" data-fmt="comma">0</b><span>pages this month</span></div>
<div class="tile lilac"><b>${fmtMin(today.sec)}</b><span>read today</span></div></div>
<section class="card"><div class="row"><b class="heading">pages</b></div><div class="seg slim" role="tablist">${['week', 'month', 'year'].map(r => html`<button role="tab" class="${r === range ? 'on' : ''}" aria-selected="${r === range}" data-act="range" data-v="${r}">${r}</button>`)}</div><div id="chart">${chart()}</div></section>
<section class="card" id="cal">${cal()}</section>`);
  animateIn(root);
  const growBars = () => requestAnimationFrame(() => requestAnimationFrame(() => root.querySelectorAll<HTMLElement>('.chart i').forEach(b => { b.style.height = Math.max(4, +b.dataset.h) + '%'; })));
  growBars();

  root.addEventListener('click', e => {
    const a = ((e.target as Element).closest('[data-act]') as HTMLElement | null); if (!a) return;
    const act = a.dataset.act;
    if (act === 'range') { range = a.dataset.v; store.prefs.set('statsRange', range); root.querySelectorAll('.seg.slim button').forEach(b => { const on = b === a; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }); root.querySelector('#chart').innerHTML = String(chart()); growBars(); }
    if (act === 'prev' || act === 'next') { cm += act === 'prev' ? -1 : 1; if (cm < 0) { cm = 11; cy--; } if (cm > 11) { cm = 0; cy++; } root.querySelector('#cal').innerHTML = String(cal()); }
    if (act === 'goal') {
      let g = goal;
      sheet(html`<h2>yearly goal</h2><p class="muted">How many books would feel good this year?</p>
<div class="bigstep"><button class="round" data-d="-1" aria-label="Fewer">${ic.minus}</button><b id="gv" class="display">${g}</b><button class="round pri" data-d="1" aria-label="More">${ic.plus}</button></div><button class="btn primary" data-act="save" data-sfx="pop">save</button>`,
      { title: 'Yearly goal', onMount: (sh, close) => sh.addEventListener('click', async ev => {
        const b = ((ev.target as Element).closest('button') as HTMLElement | null); if (!b) return;
        if (b.dataset.d) { g = Math.max(1, Math.min(365, g + +b.dataset.d)); sh.querySelector('#gv')!.textContent = String(g); sfx.step(+b.dataset.d > 0); }
        if (b.dataset.act === 'save') { close(); await patchProfile({ yearly_goal: g }); rerender(); }
      }) });
    }
  });
  return root;
}
