import * as store from './store.js';
import { db, live, mode } from './db.js';
import { boot, flushQueue, patchProfile } from './actions.js';
import { route, start, navigate, refresh } from './router.js';
import { html, el } from './html.js';
import { ic, toast } from './ui.js';
import { sfx } from './sound.js';
import * as onb from './views/onboarding.js';
import { home } from './views/home.js';
import { library } from './views/library.js';
import { add } from './views/add.js';
import { book } from './views/book.js';
import { log } from './views/log.js';
import { stats } from './views/stats.js';
import { celebrate } from './views/celebrate.js';
import { recap } from './views/recap.js';
import { more } from './views/more.js';

const noAuth = { auth: false };
route('/splash', onb.splash, noAuth);
route('/welcome', onb.welcome, noAuth);
route('/shelves', onb.shelves, noAuth);
route('/ritual', onb.ritual, noAuth);
route('/signup', onb.signup, noAuth);
route('/home', home, { nav: true });
route('/library', library, { nav: true });
route('/add', add, { nav: true });
route('/book/:id', book, { navKey: 'library' });
route('/log/:id', log, { navKey: 'library' });
route('/stats', stats, { nav: true });
route('/more', more, { nav: true });
route('/celebrate', celebrate);
route('/recap', recap);

// bottom nav (home, shelf, add, stats, more)
document.getElementById('nav').innerHTML = String(html`${[['home', 'home', ic.home], ['library', 'shelf', ic.shelf], ['add', 'add', ic.add], ['stats', 'stats', ic.stats], ['more', 'more', ic.more]].map(([k, l, i]) => html`<a href="#/${k}" data-nav="${k}">${i}<span>${l}</span></a>`)}`);

// offline banner
const banner = document.getElementById('offline');
const net = () => { store.set({ online: navigator.onLine }); banner.hidden = navigator.onLine; if (navigator.onLine) flushQueue(); };
addEventListener('online', net); addEventListener('offline', net); net();

// the session decides where we land
// Coming back from an expired or used link: Supabase puts the reason in the URL
const urlErr = new URLSearchParams(location.search + '&' + location.hash.replace(/^#/, '')).get('error_description');
if (urlErr) { setTimeout(() => toast("that link didn't work. want a fresh one?"), 600); history.replaceState(null, '', location.pathname + '#/signup'); }

async function init() {
  let session = null;
  try { session = await db.init(); } catch (e) { console.warn(e); }
  if (live) {
    db.onAuth(async s => {
      const had = !!store.get().session;
      if (!!s === had && s?.user.id === store.get().session?.user.id) return;
      await boot(s);
      if (s && !had) {
        store.prefs.set('onboarded', true);
        if (store.prefs.get('reminder', false) && store.get().profile && !store.get().profile.reminder_time) patchProfile({ reminder_time: '21:00:00' });
        if (location.search.includes('code=')) history.replaceState(null, '', location.pathname + '#/home');
        navigate('/home', { replace: true }); sfx.chime();
      } else if (!s) navigate('/welcome', { replace: true });
    });
  }
  await boot(session);
  document.getElementById('boot')?.remove();
  start();
}
init();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
