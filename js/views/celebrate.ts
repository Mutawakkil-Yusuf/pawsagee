import { html, el } from '../html';
import { ic, cover, ring, confetti, animateIn } from '../ui';
import * as store from '../store';
import { bookById } from '../actions';
import { dayMap, dayKey, fmtMin } from '../streaks';
import type { RouteParams } from '../types';
import { sfx } from '../sound';

const BODY: Record<number, string> = { 3: "you're on a roll.", 7: 'A whole week. Mochi is doing a little dance.', 14: 'two weeks. mochi is purring.', 30: '30 days. mochi is speechless.', 100: 'you and mochi are legends.' };

export function celebrate({ type = 'streak', n = '7', p, m, id }: RouteParams) {
  const s = store.get();
  const dm = dayMap(s.sessions);
  const t = dm.get(dayKey()) || { pages: 0, sec: 0, n: 0 };
  const num = +n || 7;
  const ub = id ? bookById(id) : null;
  const goal = s.profile?.yearly_goal || 12;
  // NOTE: celebrations are marked at the moment of transition (log.js / shared.js),
  // never here, so deep-linking this route can't consume a milestone.

  let over = 'STREAK UNLOCKED', title = `${num} days in a row!`, body = BODY[num] || 'keep it going.', art: unknown, tiles: unknown;
  if (type === 'streak') {
    const count = Math.min(num, 7);
    art = html`<div class="dots7" role="img" aria-label="${num} days read in a row">${Array.from({ length: count }, (_, i) => html`<span class="dd ${i === count - 1 ? 'last' : ''}" style="--i:${i}">${ic.check}</span>`)}</div>`;
    tiles = html`<div class="tile butter"><b>${p ?? t.pages}</b><span>pages today</span></div><div class="tile mint"><b>${m ? m + ' min' : fmtMin(t.sec)}</b><span>read today</span></div>`;
  } else if (type === 'finished' && ub) {
    over = 'BOOK FINISHED'; title = 'you finished it!'; body = `${ub.book.title}. mochi did a little dance.`;
    art = html`<div class="fin-cover">${cover(ub.book, { w: 96, cls: 'tilt' })}</div>`;
    const days = new Set(s.sessions.filter(x => x.user_book_id === ub.id).map(x => dayKey(x.started_at))).size;
    tiles = html`<div class="tile butter"><b>${ub.book.page_count || '–'}</b><span>pages</span></div><div class="tile mint"><b>${days}</b><span>${days === 1 ? 'day' : 'days'} reading</span></div>`;
  } else {
    over = 'GOAL HIT'; title = `${goal} books!`; body = `that's ${goal} books. mochi is so proud of you.`;
    art = html`<div class="center">${ring({ pct: 1, size: 84, stroke: 12, color: 'var(--pink)', inner: String(ic.check) })}</div>`;
    tiles = html`<div class="tile butter"><b>${goal}</b><span>books this year</span></div><div class="tile mint"><b>${Math.max(0, s.books.reduce((a, b) => a + (b.status === 'finished' ? (b.book.page_count || 0) : 0), 0)).toLocaleString('en-US')}</b><span>pages finished</span></div>`;
  }

  const bits: [string, string, string, number, string, number?][] = [['36px', '90px', '14px', 7, '#FFFFFF'], ['120px', '60px', '10px', 30, '#6C57E8', 1], ['300px', '84px', '16px', 0, '#FF8FB3'], ['340px', '170px', '10px', -24, '#FFE8A3', 1], ['24px', '210px', '10px', -40, '#C8F0E0', 1], ['70px', '300px', '12px', 0, '#6C57E8'], ['330px', '300px', '12px', 0, '#FFFFFF'], ['220px', '50px', '10px', 50, '#FFFFFF', 1], ['190px', '130px', '14px', 0, '#FFE8A3']];

  const root = el(html`<div class="cel">
${bits.map(([l, tp, w, r, c, pill], i) => html`<span class="cf" aria-hidden="true" style="left:${l};top:${tp};width:${w};height:${pill ? '22px' : w};border-radius:${pill ? '5px' : '50%'};background:${c};--r:${r}deg;--i:${i}"></span>`)}
<a class="iconbtn closex" href="#/home" aria-label="Close">${ic.x}</a>
<img class="cel-mochi" src="/assets/mochi/mochi-full-cheering.svg" alt="Mochi the cat, cheering" height="250" data-sfx="none">
<div class="card cel-card"><small class="overline">${over}</small><h1 class="display">${title}</h1><p class="lead">${body}</p>${art}<div class="tiles2 two">${tiles}</div></div>
<div class="dock cel-dock"><a class="btn primary grow" href="#/recap">${ic.share} share</a><a class="btn white grow" href="#/home">keep going</a></div></div>`);
  setTimeout(() => { sfx.fanfare(); confetti({ count: 110 }); setTimeout(() => sfx.meow(), 650); }, 250);
  root.addEventListener('click', e => { if (((e.target as Element).closest('.cel-mochi') as HTMLElement | null)) { sfx.meow(); confetti({ count: 24 }); } });
  animateIn(root);
  root.classList.add('celebrate-screen');
  return root;
}
