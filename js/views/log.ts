import { html, el } from '../html';
import { ic, mochi, cover, ring, toast, sheet, confetti } from '../ui';
import * as store from '../store';
import * as timer from '../timer';
import { bookById, saveSession, setStatus } from '../actions';
import { dayMap, dayKey, currentStreak, MILESTONES, wasCelebrated, celebrationKey, markCelebrated, fmtClock } from '../streaks';
import { navigate, back } from '../router';
import { sfx, buzz } from '../sound';
import { finishRoute } from './shared';
import type { RouteParams } from '../types';

export function log({ id, manual }: RouteParams) {
  const ub = bookById(id);
  if (!ub) { navigate('/home', { replace: true }); return el(html``); }
  const isManual = manual === '1';
  const goalMin = store.get().profile?.daily_goal_minutes || 20;
  const goalPages = store.get().profile?.daily_goal_pages || 10;
  const total = ub.book.page_count;

  let sess: timer.ActiveSession | null = null;
  if (!isManual) {
    const a = timer.active();
    if (a && a.userBookId !== id) { toast('finish your other session first.'); navigate('/log/' + a.userBookId, { replace: true }); return el(html``); }
    if (!a) { sess = timer.begin(id, ub.current_page); sess.page = ub.current_page; timer.save(sess); sfx.start(); } else sess = a;
    if (sess.page === undefined) sess.page = ub.current_page;
  }
  const startPage = isManual ? ub.current_page : sess!.startPage;
  let page = isManual ? ub.current_page : sess!.page!;
  const maxPage = total || 9999;

  const root = el(html`<header class="book-h"><button class="iconbtn" data-act="back" aria-label="Back">${ic.back}</button><span class="overline">${isManual ? 'LOG PAGES' : 'READING SESSION'}</span><span class="iconbtn ghosted"></span></header>
<div class="log-mochi">${mochi('reading', { size: 88 })}</div>
${isManual ? '' : html`<div class="timer">${ring({ pct: 0, size: 270, stroke: 22, color: 'var(--pink)', inner: `<b id="clock" class="clock">00:00</b><small>of ${goalMin} min goal</small>` })}<p class="sr" id="live" aria-live="polite"></p></div>`}
<div class="card minibook">${cover(ub.book, { w: 46 })}<div><b>${ub.book.title}</b><small class="muted">started on page ${startPage}</small></div></div>
<div class="card stepper"><div><small class="muted b">i'm on page</small><b class="page" id="page">${page}</b></div>
<div class="steps"><button class="round" data-step="-1" data-sfx="none" aria-label="One page back">${ic.minus}</button><button class="round pri" data-step="1" data-sfx="none" aria-label="One page forward">${ic.plus}</button></div></div>
<p class="muted center b" id="sofar"></p>
<div class="dock">${isManual ? '' : html`<button class="round big" id="pp" data-act="pp" data-sfx="none" aria-label="Pause timer">${ic.pause}</button>`}<button class="btn primary grow" data-act="finish" data-sfx="none">${ic.check} ${isManual ? 'save pages' : 'finish session'}</button></div>`);

  const $ = (s: string) => root.querySelector<HTMLElement>(s)!;
  const pageEl = $('#page'), sofar = $('#sofar');
  const paintPages = (bump: boolean) => {
    pageEl.textContent = String(page);
    const n = Math.max(0, page - startPage);
    sofar.textContent = `${n} ${n === 1 ? 'page' : 'pages'} so far · goal today is ${goalPages}`;
    if (bump) { pageEl.classList.remove('pop'); void pageEl.offsetWidth; pageEl.classList.add('pop'); }
    if (!isManual && sess) { sess.page = page; timer.save(sess); }
  };
  paintPages(false);

  const step = (d: number) => { const n = Math.max(0, Math.min(maxPage, page + d)); if (n === page) { sfx.error(); return; } page = n; sfx.step(d > 0); buzz(5); paintPages(true); };
  let hold: number | undefined, rep: number | undefined;
  root.addEventListener('pointerdown', e => {
    const b = ((e.target as Element).closest('[data-step]') as HTMLElement | null) as HTMLElement | null; if (!b) return;
    const d = +b.dataset.step!; step(d);
    hold = window.setTimeout(() => { rep = window.setInterval(() => step(d), 90); }, 420);
  });
  const stop = () => { clearTimeout(hold); clearInterval(rep); };
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => root.addEventListener(t, stop));
  root.addEventListener('keydown', e => { const b = ((e.target as Element).closest('[data-step]') as HTMLElement | null) as HTMLElement | null; if (b && ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ')) { e.preventDefault(); step(+b.dataset.step!); } });

  // timer display
  let tick: number | undefined;
  if (!isManual && sess) {
    const fg = root.querySelector<SVGCircleElement>('.ring-fg')!; const c = +fg.dataset.c!;
    let lastMin = -1;
    const draw = () => {
      const sec = timer.elapsedSec(sess!);
      $('#clock').textContent = fmtClock(sec);
      fg.style.strokeDashoffset = String(c * (1 - Math.min(1, sec / (goalMin * 60))));
      const m = Math.floor(sec / 60); if (m !== lastMin) { lastMin = m; $('#live').textContent = m ? `${m} minutes` : ''; }
      if (!sess!.goalHit && sec >= goalMin * 60) { sess!.goalHit = true; timer.save(sess); sfx.chime(); toast(`${goalMin} minutes! mochi is purring.`); }
    };
    fg.style.transition = 'stroke-dashoffset .9s linear';
    draw(); tick = window.setInterval(draw, 250);
    const paintPause = () => {
      const p = !!sess!.pausedAt;
      $('#pp').innerHTML = String(p ? ic.play : ic.pause); $('#pp').setAttribute('aria-label', p ? 'Resume timer' : 'Pause timer');
      root.querySelector('.timer')!.classList.toggle('paused', p);
    };
    paintPause();
    root.addEventListener('click', e => {
      if (!((e.target as Element).closest('[data-act=pp]') as HTMLElement | null)) return;
      sess!.pausedAt ? (timer.resume(sess!), sfx.start()) : (timer.pause(sess!), sfx.pause());
      paintPause(); draw();
    });
  }
  root._cleanup = () => { clearInterval(tick); stop(); };

  root.addEventListener('click', async e => {
    const a = ((e.target as Element).closest('[data-act]') as HTMLElement | null) as HTMLElement | null; if (!a) return;
    if (a.dataset.act === 'back') back('/book/' + id);
    if (a.dataset.act !== 'finish') return;
    const sec = isManual ? 0 : timer.elapsedSec(sess!);
    const pages = Math.max(0, page - startPage);
    if (pages === 0 && (isManual || sec < 60)) {
      sfx.error();
      if (isManual) { toast('change the page number first.'); return; }
      timer.clear(); toast('no pages, no worries. nothing saved.'); navigate('/book/' + id); return;
    }
    (a as HTMLButtonElement).disabled = true; a.classList.add('loading');
    const hadToday = dayMap(store.get().sessions).has(dayKey());
    await saveSession({ user_book_id: id, started_at: new Date(isManual ? Date.now() : sess!.startedAt).toISOString(), duration_sec: sec, start_page: startPage, end_page: page });
    timer.clear();
    const streak = currentStreak(dayMap(store.get().sessions));
    const done = total && page >= total && ub.status !== 'finished';
    const goStreak = () => {
      const key = celebrationKey('streak', streak);
      if (!hadToday && MILESTONES.includes(streak) && !wasCelebrated(key)) {
        markCelebrated(key); // mark at the moment of transition, not in the Celebrate view
        navigate(`/celebrate?type=streak&n=${streak}&p=${pages}&m=${Math.round(sec / 60)}`); return true;
      }
      return false;
    };
    const wrap = () => { if (goStreak()) return; sfx.finish(); buzz(20); confetti({ count: 40 }); toast(pages >= 10 ? `nice! ${pages} pages today. that's a whole chapter.` : `nice! ${pages} pages today.`); navigate('/book/' + id, { replace: true }); };
    if (done) {
      sfx.chime();
      navigate('/book/' + id, { replace: true }); // the sheet floats over the book, so dismissing it is always safe
      sheet(html`<div class="center">${mochi('curious', { size: 90 })}<h2>finished the book?</h2><p class="muted">You reached the last page of ${ub.book.title}.</p>
<div class="split"><button class="btn white" data-act="notyet" data-sfx="none">not yet</button><button class="btn primary" data-act="yes" data-sfx="none">yes, finished</button></div></div>`,
      { title: 'Finished?', onMount: (sh, close) => sh.addEventListener('click', async ev => {
        const b = ((ev.target as Element).closest('[data-act]') as HTMLElement | null) as HTMLElement | null; if (!b) return; close();
        if (b.dataset.act === 'yes') { await setStatus(ub, 'finished'); const r = finishRoute(bookById(id)!); if (r) navigate(r); else wrap(); } else wrap();
      }) });
    } else wrap();
  });
  return root;
}
