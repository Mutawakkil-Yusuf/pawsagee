import { html, raw, el } from '../html';
import { ic, mochi, sheet, toast, swatches, SHELF_COLORS, confetti } from '../ui';
import { navigate, back } from '../router';
import { prefs } from '../store';
import { sfx } from '../sound';
import { db, mode } from '../db';
import { boot } from '../actions';

const dots = n => html`<div class="dots" aria-label="Step ${n} of 3">${[1, 2, 3].map(i => html`<i class="${i === n ? 'on' : ''}"></i>`)}</div>`;
// Turn a Supabase error into plain words plus the real detail, so setup problems are easy to spot.
function authError(e) {
  const raw = String((e as Error)?.message || e || '');
  const code = e?.status || e?.code || '';
  let say = "that didn't work. want to try again?";
  if (/rate limit|too many|429/i.test(raw + code)) say = 'too many emails were sent. wait a few minutes, or set up custom email (SMTP) in Supabase.';
  else if (/invalid api key|apikey|jwt|401/i.test(raw + code)) say = 'the Supabase key in js/config.js looks wrong. use the anon public key, never the service key.';
  else if (/provider.*disabled|email.*disabled|not enabled/i.test(raw)) say = 'email sign-in is switched off in Supabase. enable the Email provider.';
  else if (/signups? not allowed|signup.*disabled/i.test(raw)) say = 'new sign-ups are switched off in Supabase.';
  else if (/failed to fetch|networkerror|load failed/i.test(raw)) say = "can't reach Supabase. check the project URL in js/config.js and your connection.";
  console.warn('sign-in error', e);
  return { say, raw };
}
function showErr(sh, err) {
  const { say, raw } = authError(err);
  const m = sh.querySelector('#msg'); m.textContent = ''; m.append(say);
  const d = document.createElement('small'); d.textContent = raw; m.append(document.createElement('br'), d); sfx.error();
}

/** Step 2 of email sign-in: type the code from the email. (The email also holds a link; either one works.) */
function codeStep(sh, email, close) {
  sh.querySelector('.sheet-body').innerHTML = String(html`<div class="center">${mochi('curious', { size: 80 })}</div>
<h2 class="center">check your inbox.</h2><p class="muted center">mochi sent a sign-in link to ${email}</p>
<p class="muted center note">tap the link in the email, or enter a code below if one was included.</p>
<form id="cf"><input class="input code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" maxlength="10" placeholder="123456" aria-label="Sign-in code" required>
<button class="btn primary" type="submit" data-sfx="pop">sign in</button></form><div id="msg" class="msg" aria-live="polite"></div>
<div class="split"><button class="btn ghost" data-act="resend" type="button" data-sfx="pop">send a new code</button><button class="btn ghost" data-act="other" type="button">different email</button></div>`);
  const form = sh.querySelector('#cf'), input = form.code;
  input.focus();
  input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, ''); });
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const btn = form.querySelector('button'); btn.classList.add('loading'); (btn as HTMLButtonElement).disabled = true;
    try { await db.verifyCode(email, input.value.trim()); close(); } // onAuth in main.js takes it from here
    catch (err) {
      btn.classList.remove('loading'); (btn as HTMLButtonElement).disabled = false;
      const m = sh.querySelector('#msg'); m.textContent = /expired|invalid/i.test(String((err as Error).message)) ? "that code didn't work. check it, or ask for a new one." : authError(err).say; sfx.error();
    }
  });
  let cool = 0;
  sh.addEventListener('click', async ev => {
    const a = ((ev.target as Element).closest('[data-act]') as HTMLElement | null)?.dataset.act;
    if (a === 'other') { close(); }
    if (a === 'resend') {
      if (Date.now() < cool) { toast('give it a few seconds, then try again.'); return; }
      cool = Date.now() + 30000;
      try { await db.signInEmail(email); toast('new code sent.'); } catch (err) { showErr(sh, err); }
    }
  });
}

const finishOnboarding = () => { prefs.set('onboarded', true); };

const top = (withBack = true) => html`<header class="onb-top">${withBack ? html`<button class="iconbtn" data-act="back" aria-label="Back">${ic.back}</button>` : html`<span></span>`}<button class="link" data-act="skip">skip</button></header>`;
const foot = html`<p class="foot">already have an account? <a href="#/signup" class="b">log in</a></p>`;

function wire(root, { next }) {
  root.addEventListener('click', e => {
    const a = ((e.target as Element).closest('[data-act]') as HTMLElement | null)?.dataset.act;
    if (a === 'next') next();
    if (a === 'back') back('/welcome');
    if (a === 'skip') { finishOnboarding(); navigate('/signup'); }
  });
}

/* 1. splash */
export function splash() {
  const root = el(html`<div class="splash" role="button" tabindex="0" aria-label="Tap to begin">
<div class="splash-mid">
<img class="splash-mark pop-in" src="/assets/logo/mark.svg" alt="" width="112" height="112">
<h1 class="wm big rise" style="--d:.15s"><b>paw</b>sage</h1>
<p class="tag rise" style="--d:.3s">read a little, every day</p></div>
<p class="tap rise blink" style="--d:.6s">TAP TO BEGIN</p>
<div class="splash-cat">${mochi('sleepy', { size: 230, cls: 'peek' })}</div></div>`);
  let done = false;
  const go = () => { if (done) return; done = true; sfx.pop(); navigate('/welcome'); };
  root.addEventListener('click', go);
  root.addEventListener('keydown', e => { if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') go(); });
  const t = setTimeout(() => { if (!done) { done = true; navigate('/welcome'); } }, 3200);
  root._cleanup = () => clearTimeout(t);
  return root;
}

/* 2. welcome */
export function welcome() {
  const root = el(html`${top(false)}
<div class="onb-art welcome-art"><div class="glow"></div>
<span class="bk bk-pink" style="--r:-12deg"><em>Americanah</em></span>
<span class="bk bk-mint" style="--r:9deg"><em>Sapiens</em></span>
<span class="bk bk-lilac" style="--r:7deg"><em>Kintu</em></span>
<div class="art-mochi">${mochi('full', { size: 250, cls: 'idle', label: 'Mochi the cat, waving' })}</div></div>
<div class="onb-copy"><p class="eyebrow">WELCOME TO PAWSAGE</p><h1>your cozy corner for books</h1>
<p class="lead">Keep every book you read on one pretty shelf, and let Mochi nudge you back to the page.</p></div>
${dots(1)}<button class="btn primary" data-act="next">continue ${ic.chevron}</button>${foot}`, 'onb');
  wire(root, { next: () => navigate('/shelves') });
  return root;
}

/* 3. shelves */
export function shelves() {
  let color = 'rose';
  const card = () => html`<div class="frost" style="background:${SHELF_COLORS[color].bg}"><b>Weekend reads</b><span>5 books</span></div>`;
  const root = el(html`${top()}
<div class="onb-art shelves-art"><div class="spines"><i class="sp1"></i><i class="sp2"></i><i class="sp3"></i><i class="sp4"></i><i class="sp5"></i></div>
<div id="frost">${card()}</div>${swatches(color, 'color')}</div>
<div class="onb-copy"><p class="eyebrow">CUSTOMIZE</p><h1>build shelves that feel like you</h1>
<p class="lead">Group books into collections, pick a color for each, and arrange them the way your own shelf looks at home.</p></div>
${dots(2)}<button class="btn primary" data-act="next">continue ${ic.chevron}</button>${foot}`, 'onb');
  wire(root, { next: () => navigate('/ritual') });
  root.addEventListener('click', e => {
    const s = ((e.target as Element).closest('[data-act=color]') as HTMLElement | null); if (!s) return;
    color = s.dataset.v;
    root.querySelectorAll('.swatch').forEach(x => { const on = x === s; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); });
    root.querySelector('#frost').innerHTML = String(card());
    const f = root.querySelector('.frost'); f.classList.add('flash');
  });
  return root;
}

/* 4. ritual */
export function ritual() {
  let on = !!prefs.get('reminder', true);
  const week = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const root = el(html`${top()}
<div class="ritual-head">${mochi('cheering', { size: 104 })}<p class="bubble">ten pages is enough. i'll keep your spot!</p></div>
<div class="card week"><div class="row"><b>your first week</b><span class="pill butter">${ic.flame} 3 days</span></div>
<div class="days">${week.map((d, i) => html`<span class="dcol"><i class="d ${i < 3 ? 'read' : ''} ${i === 2 ? 'now' : ''}" style="--i:${i}">${i < 3 ? ic.check : ''}</i><small>${d}</small></span>`)}</div></div>
<div class="card remind"><div><b>daily nudge</b><small>a gentle nudge, once a day</small></div>
<span class="time">9:00 pm</span><button class="sw ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="Daily nudge" data-act="remind" data-sfx="none"><i></i></button></div>
<div class="onb-copy low"><h1>a tiny ritual, every day</h1><p class="lead">Read a few pages, watch your streak grow, and let Mochi cheer you on.</p></div>
${dots(3)}<button class="btn primary" data-act="next">let's go ${ic.chevron}</button>${foot}`, 'onb');
  wire(root, { next: () => navigate('/signup') });
  root.addEventListener('click', e => {
    if (!((e.target as Element).closest('[data-act=remind]') as HTMLElement | null)) return;
    on = !on; prefs.set('reminder', on);
    const s = root.querySelector('.sw'); s.classList.toggle('on', on); s.setAttribute('aria-checked', String(on));
    on ? sfx.toggleOn() : sfx.toggleOff();
  });
  return root;
}

/* 5. sign up */
export function signup() {
  const demo = mode === 'demo';
  const root = el(html`<header class="onb-top"><button class="iconbtn" data-act="back" aria-label="Back">${ic.back}</button><span></span></header>
<div class="onb-art fan-art"><span class="bk bk-violet" style="--r:-14deg"><em>Born a Crime</em></span><span class="bk bk-butter" style="--r:-4deg"><em>Atomic Habits</em></span><span class="bk bk-pink" style="--r:8deg"><em>Dune</em></span><span class="bk bk-mint" style="--r:14deg"><em>Kintu</em></span>
<div class="fan-mochi">${mochi('curious', { size: 150 })}</div></div>
<div class="onb-copy signup-copy"><h1>start your shelf</h1><p class="lead">Sign in to sync your books and streak across every device.</p></div>
<div class="stack">
<button class="btn primary" data-act="email">${ic.mail} ${demo ? 'continue' : 'continue with email'}</button>
${demo ? '' : html`<button class="btn white" data-act="google">continue with google</button>`}</div>
<p class="foot">already have an account? <button class="link b" data-act="email">log in</button></p>
${demo ? html`<p class="note">demo mode: your books stay on this device until Supabase is connected.</p>` : ''}
<p class="legal">By continuing you agree to the Terms and Privacy Policy.</p>`, 'onb');

  const start = async name => {
    const s = await db.start(name, prefs.get('reminder', true));
    prefs.set('onboarded', true);
    await boot(s);
    sfx.fanfare(); confetti({ count: 60 });
    navigate('/home');
  };

  root.addEventListener('click', async e => {
    const a = ((e.target as Element).closest('[data-act]') as HTMLElement | null)?.dataset.act;
    if (a === 'back') back('/ritual');
    if (a === 'google') { try { await db.signInGoogle(); } catch (err) { toast(authError(err).say); sfx.error(); } }
    if (a === 'email') {
      sheet(demo
        ? html`<h2>what should mochi call you?</h2><p class="muted">Just a first name is perfect.</p>
<form id="f"><input class="input" name="name" autocomplete="given-name" placeholder="your name" maxlength="30" required><button class="btn primary" type="submit" data-sfx="pop">let's start</button></form>`
        : html`<h2>sign in with email</h2><p class="muted">We'll email you a sign-in link. No password needed.</p>
<form id="f"><input class="input" type="email" name="email" autocomplete="email" placeholder="you@example.com" required><button class="btn primary" type="submit" data-sfx="pop">send me a code</button></form><div id="msg" class="msg" aria-live="polite"></div>`,
      { title: 'Sign in', onMount: (sh, close) => {
        sh.querySelector('#f').addEventListener('submit', async ev => {
          ev.preventDefault();
          const fd = new FormData(ev.target as HTMLFormElement);
          const btn = (ev.target as HTMLElement).querySelector<HTMLElement>('button')!; btn.classList.add('loading'); (btn as HTMLButtonElement).disabled = true;
          if (demo) { close(); await start(String(fd.get('name')).trim()); return; }
          const email = String(fd.get('email')).trim();
          try { await db.signInEmail(email); sfx.chime(); codeStep(sh, email, close); }
          catch (err) { btn.classList.remove('loading'); (btn as HTMLButtonElement).disabled = false; showErr(sh, err); }
        });
      } });
    }
  });
  return root;
}
