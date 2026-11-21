// Tiny hash router. A view is (params) => HTMLElement. It may set el._cleanup.
import * as store from './store.js';
import { reduced } from './ui.js';

const routes = [];
let current = null;
const onboarding = new Set(['/splash', '/welcome', '/shelves', '/ritual', '/signup']);

export function route(path, view, { nav = false, auth = true, navKey } = {}) {
  const keys = [];
  const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ path, re, keys, view, nav, auth, navKey });
}

export const navigate = (to, { replace = false } = {}) => {
  const h = '#' + to;
  if (replace) { history.replaceState(null, '', h); render(); } else if (location.hash === h) render(); else location.hash = h;
};
export const back = fallback => { if (history.length > 1 && document.referrer !== '' || history.state !== null) history.back(); else navigate(fallback || '/home'); };
export const refresh = () => render({ keepScroll: true });

function parse() {
  const raw = location.hash.slice(1);
  if (!raw || raw.startsWith('access_token') || raw.startsWith('error')) return { path: '', params: {} };
  const [path, qs] = raw.split('?');
  return { path, params: Object.fromEntries(new URLSearchParams(qs || '')) };
}

async function render({ keepScroll = false } = {}) {
  const { path, params } = parse();
  const { session } = store.get();
  let r = null, vals = {};
  for (const x of routes) { const m = x.re.exec(path); if (m) { r = x; x.keys.forEach((k, i) => vals[k] = decodeURIComponent(m[i + 1])); break; } }
  const home = session ? '/home' : (store.prefs.get('onboarded') ? '/signup' : '/splash');
  if (!r || (r.auth && !session) || (session && onboarding.has(path))) { navigate(path === '' || !r ? home : (r.auth && !session ? '/welcome' : '/home'), { replace: true }); return; }

  const app = document.getElementById('app');
  const y = scrollY;
  current?._cleanup?.();
  const node = await r.view({ ...params, ...vals });
  node.classList.add('screen');
  if (!r.nav) node.classList.add('nonav');
  if (keepScroll) node.classList.add('still');
  app.replaceChildren(node);
  current = node;
  document.body.dataset.nav = r.nav ? 'on' : 'off';
  document.body.dataset.route = r.path;
  document.querySelectorAll('#nav a').forEach(a => { const on = a.dataset.nav === (r.navKey || r.path.split('/')[1]); a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
  scrollTo(0, keepScroll ? y : 0);
  if (!keepScroll) { node.setAttribute('tabindex', '-1'); node.focus({ preventScroll: true }); }
  if (reduced()) node.classList.add('still');
}

export function start() {
  addEventListener('hashchange', () => render());
  render();
}
