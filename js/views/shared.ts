import { html } from '../html';
import { ic, cover, bar, authorsLine, statusLabel } from '../ui';
import * as store from '../store';
import { finishedInYear, wasCelebrated, celebrationKey, markCelebrated } from '../streaks';
import type { UserBook } from '../types';

/** Where to go after a book is marked finished: a goal or finished celebration (once each), else nowhere.
 *  Marking happens here, at the point of transition, not as a side effect of rendering the Celebrate view. */
export function finishRoute(ub: UserBook): string | null {
  const goal = store.get().profile?.yearly_goal || 12;
  const n = finishedInYear(store.get().books);
  const goalKey = celebrationKey('goal', goal, String(new Date().getFullYear()));
  if (n === goal && !wasCelebrated(goalKey)) { markCelebrated(goalKey); return `/celebrate?type=goal&id=${ub.id}`; }
  const doneKey = celebrationKey('finished', 0, ub.id);
  if (!wasCelebrated(doneKey)) { markCelebrated(doneKey); return `/celebrate?type=finished&id=${ub.id}`; }
  return null;
}

export const pct = (ub: UserBook) => ub.book.page_count ? Math.min(100, Math.round(ub.current_page / ub.book.page_count * 100)) : 0;

export const bookRow = (ub: UserBook, { action = '' }: { action?: unknown } = {}) => html`<a class="brow" href="#/book/${ub.id}">
${cover(ub.book, { w: 52 })}
<span class="brow-t"><b>${ub.book.title}</b><small>${authorsLine(ub.book)}${ub.book.first_publish_year ? ' · ' + ub.book.first_publish_year : ''}</small>
${ub.status === 'reading' && ub.book.page_count ? html`<span class="brow-p">${bar(pct(ub))}<small>${pct(ub)}%</small></span>` : html`<span class="chip tiny s-${ub.status}">${statusLabel(ub.status)}</span>`}</span>${action}</a>`;

export const emptyShelf = () => html`<div class="empty-card" aria-label="Mochi the cat, sleeping on an empty shelf">
<div class="sleeper"><img class="mochi idle loaf" src="/assets/mochi/mochi-loaf.svg" alt="Mochi the cat, sleeping on an empty shelf" height="150" draggable="false"></div><i class="plank"></i></div>
<div class="center"><h2 class="title">this shelf is lonely</h2>
<p class="lead">Add the book you're reading right now and Mochi will keep your place.</p></div>
<div class="stack"><a class="btn primary" href="#/add">${ic.plus} add your first book</a><a class="btn ghost" href="#/add?tab=scan">or scan an isbn</a></div>`;
