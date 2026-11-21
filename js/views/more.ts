import { html, raw, el } from '../html';
import { ic, mochi, toast, sheet } from '../ui';
import * as store from '../store';
import { patchProfile, boot, loadSample } from '../actions';
import { db, mode } from '../db';
import { soundOn, setSound, sfx } from '../sound';
import { navigate, refresh as rerender } from '../router';
import type { Profile } from '../types';

let installEvt: Event | null = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });

const GOALS = [['yearly_goal', 'books this year', 1, 365, 1], ['daily_goal_pages', 'pages a day', 1, 1000, 1], ['daily_goal_minutes', 'minutes a day', 1, 600, 5]];

export function more() {
  const s = store.get(), p = s.profile || ({} as Profile);
  const remind = !!p.reminder_time;
  const root = el(html`<header><h1 class="display">more</h1><p class="muted">${mode === 'demo' ? 'demo mode · saved on this device' : 'synced to your account'}</p></header>
<section class="card set"><label class="lbl" for="nm">what mochi calls you</label><input id="nm" class="input" maxlength="30" value="${p.display_name || ''}" autocomplete="given-name"></section>
<section class="card set"><b class="heading">goals</b>
${GOALS.map(([k, l, lo, hi, st]) => html`<div class="setrow"><span>${l}</span><div class="mini-step"><button class="round sm" data-act="dec" data-k="${k}" data-st="${st}" data-lo="${lo}" aria-label="Less ${l}" data-sfx="none">${ic.minus}</button><b id="v-${k}">${p[k] ?? ''}</b><button class="round sm pri" data-act="inc" data-k="${k}" data-st="${st}" data-hi="${hi}" aria-label="More ${l}" data-sfx="none">${ic.plus}</button></div></div>`)}</section>
<section class="card set">
<div class="setrow"><span><b>sounds</b><small class="muted">soft pops, chimes and a tiny meow</small></span><button class="sw ${soundOn() ? 'on' : ''}" role="switch" aria-checked="${soundOn()}" aria-label="Sounds" data-act="sound" data-sfx="none"><i></i></button></div>
<div class="setrow"><span><b>daily nudge</b><small class="muted">mochi reminds you here at 9 pm</small></span><button class="sw ${remind ? 'on' : ''}" role="switch" aria-checked="${remind}" aria-label="Daily nudge" data-act="remind" data-sfx="none"><i></i></button></div></section>
<section class="card set"><b class="heading">reading</b>
<a class="btn white" href="#/pdf">${ic.book} read a pdf from your device</a><p class="muted note">Your files stay on your phone. Nothing is uploaded.</p></section>
<section class="card set"><b class="heading">your data</b>
${/iphone|ipad/i.test(navigator.userAgent) && !navigator.standalone ? html`<p class="muted note">On iPhone: tap the Share button in Safari, then Add to Home Screen.</p>` : ''}
<button class="btn white" data-act="install" hidden>${ic.download} install pawsage</button>
<button class="btn white" data-act="export">${ic.download} export my data</button>
${mode === 'demo' && !s.books.length ? html`<button class="btn white" data-act="sample">${ic.book} load sample books</button>` : ''}
<button class="btn ghost danger" data-act="out" data-sfx="none">sign out</button></section>
<div class="center about">${mochi('sleepy', { size: 64 })}<p class="muted">pawsage · read a little, every day</p></div>`);

  if (installEvt) root.querySelector<HTMLElement>('[data-act=install]')!.hidden = false;
  root.querySelector<HTMLInputElement>('#nm')!.addEventListener('change', e => { const v = (e.target as HTMLInputElement).value.trim(); if (v) { patchProfile({ display_name: v }); toast('mochi will remember that.'); } });

  root.addEventListener('click', async e => {
    const a = ((e.target as Element).closest('[data-act]') as HTMLElement | null); if (!a) return;
    const act = a.dataset.act;
    if (act === 'inc' || act === 'dec') {
      const k = a.dataset.k, st = +a.dataset.st, cur = store.get().profile[k];
      const v = Math.max(+(a.dataset.lo ?? 1), Math.min(+(a.dataset.hi ?? 9999), cur + (act === 'inc' ? st : -st)));
      if (v === cur) { sfx.error(); return; }
      sfx.step(act === 'inc'); root.querySelector('#v-' + k)!.textContent = String(v); patchProfile({ [k]: v });
    }
    if (act === 'sound') { const on = !soundOn(); setSound(on); a.classList.toggle('on', on); a.setAttribute('aria-checked', String(on)); if (!on) { /* silent by design */ } }
    if (act === 'remind') { const on = !store.get().profile.reminder_time; patchProfile({ reminder_time: on ? '21:00:00' : null }); store.prefs.set('reminder', on); a.classList.toggle('on', on); a.setAttribute('aria-checked', String(on)); on ? sfx.toggleOn() : sfx.toggleOff(); }
    if (act === 'install' && installEvt) { (installEvt as Event & { prompt(): void }).prompt(); installEvt = null; a.hidden = true; }
    if (act === 'export') {
      const data = await db.exportAll();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const d = document.createElement('a'); d.href = url; d.download = 'pawsage-export.json'; d.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast('exported.');
    }
    if (act === 'sample') { (a as HTMLButtonElement).disabled = true; await loadSample(); sfx.add(); toast('sample books added.'); rerender(); }
    if (act === 'out') {
      sheet(html`<div class="center">${mochi('miss-you', { size: 90 })}<h2>sign out?</h2><p class="muted">${mode === 'demo' ? 'your books stay on this device.' : 'your books are safe in your account.'}</p><div class="split"><button class="btn white" data-close>stay</button><button class="btn primary" data-act="yes" data-sfx="none">sign out</button></div></div>`,
      { title: 'Sign out', onMount: (sh, close) => sh.addEventListener('click', async ev => { if (!((ev.target as Element).closest('[data-act=yes]') as HTMLElement | null)) return; close(); await db.signOut(); await boot(null); sfx.pause(); navigate('/welcome'); }) });
    }
  });
  return root;
}
