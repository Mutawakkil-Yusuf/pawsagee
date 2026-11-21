import { html, raw, el } from '../html';
import { ic, mochi, cover, ring, bar, animateIn, toast, authorsLine } from '../ui';
import * as store from '../store';
import { dayMap, currentStreak, dayKey, weekStrip, daysSinceLastRead } from '../streaks';
import { currentBook, firstName } from '../actions';
import { navigate } from '../router';
import { pct, emptyShelf } from './shared';

const LINES = ['psst... one chapter before bed?', 'ten pages is enough for today.', 'your book is right where you left it.', 'no rush. mochi is warming the page.'];

function pickLine({ since, doneToday, nudge }) {
  if (since >= 3) return 'welcome back. mochi saved your spot.';
  if (doneToday) return "that's today's goal. mochi is purring.";
  if (nudge) return 'mochi is cozied up with a book. join?';
  const last = store.prefs.get('lastLine', -1);
  let i; do { i = Math.floor(Math.random() * LINES.length); } while (i === last && LINES.length > 1);
  store.prefs.set('lastLine', i);
  return LINES[i];
}

export function home() {
  const s = store.get();
  const dm = dayMap(s.sessions), streak = currentStreak(dm);
  const t = dm.get(dayKey()) || { pages: 0, sec: 0 };
  const goal = s.profile?.daily_goal_pages || 10;
  const since = daysSinceLastRead(dm) ?? 0;
  const cur = currentBook();
  const upnext = s.books.filter(b => b.status === 'want').slice(0, 8);
  const rt = s.profile?.reminder_time;
  const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
  const nudge = rt && !dm.has(dayKey()) && nowMin >= (+rt.slice(0, 2) * 60 + +rt.slice(3, 5));
  const doneToday = t.pages >= goal;
  const face = since >= 3 ? 'miss-you' : doneToday ? 'cheering' : 'happy';
  const line = pickLine({ since, doneToday, nudge });
  const week = weekStrip(dm);

  if (!s.books.length) {
    const root = el(html`<header class="hello"><h1 class="display">hi, ${firstName()}</h1></header>${emptyShelf()}`);
    animateIn(root); return root;
  }

  const hero = cur ? html`<section class="card hero">
<a href="#/book/${cur.id}" class="hero-cover" aria-label="${cur.book.title}">${cover(cur.book, { w: 112, cls: 'tilt', size: 'M' })}</a>
<div class="hero-r">
<div class="hero-stat">${ring({ pct: pct(cur) / 100, size: 56, stroke: 8, inner: `<b class="rp">${pct(cur)}%</b>` })}<span>${cur.book.page_count ? html`page ${cur.current_page}<br>of ${cur.book.page_count}` : html`page ${cur.current_page}`}</span></div>
<a class="hero-title" href="#/book/${cur.id}">${cur.book.title}</a>
<a class="btn primary" href="#/log/${cur.id}">${ic.play} continue</a></div></section>`
    : html`<section class="card hero pick"><div><b class="hero-title">nothing open right now</b><p class="muted">Pick your next read and Mochi will keep the place.</p></div><a class="btn primary" href="#/library">${ic.shelf} my shelf</a></section>`;

  const logHref = cur ? `#/log/${cur.id}` : '#/library';
  const root = el(html`<header class="hello"><h1 class="display">hi, ${firstName()}</h1>
<a class="streakpill" href="#/stats" aria-label="${streak} day streak"><span class="fl">${ic.flame}</span><b data-count="${streak}">${streak}</b></a></header>
<div class="mochi-row">${mochi(face, { size: 92 })}<p class="bubble">${line}</p></div>
${hero}
<div class="quick">
<a class="q pink" href="${cur ? logHref + '?manual=1' : '#/library'}">${ic.book}<span>log pages</span></a>
<a class="q butter" href="${logHref}">${ic.timer}<span>timer</span></a>
<a class="q mint" href="#/add">${ic.add}<span>add book</span></a></div>
<section class="card today"><div class="row"><b>today</b><span class="muted">${t.pages} of ${goal} pages</span></div>
${bar(Math.min(100, t.pages / goal * 100), 'var(--pink)')}
<div class="days" role="img" aria-label="This week: ${week.filter(w => w.state.includes('read')).length} days read">${week.map((w, i) => html`<span class="dcol"><i class="d ${w.state}" style="--i:${i}">${w.state.includes('read') ? ic.check : ''}</i><small>${w.label}</small></span>`)}</div></section>
${upnext.length ? html`<div class="sec-h"><h2 class="title">up next</h2><a class="link" href="#/library">see all</a></div>
<div class="hrow">${upnext.map(b => html`<a href="#/book/${b.id}" class="hbook">${cover(b.book, { w: 120 })}</a>`)}</div><i class="plank wide"></i>` : ''}`);
  animateIn(root);
  return root;
}
