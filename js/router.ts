// Tiny hash router. A view is (params) => HTMLElement. It may set el._cleanup.
import * as store from './store';
import { reduced } from './ui';
import type { View, RouteParams } from './types';

interface Route {
  path: string;
  re: RegExp;
  keys: string[];
  view: View;
  nav: boolean;
  auth: boolean;
  navKey?: string;
}

const routes: Route[] = [];
let current: (HTMLElement & { _cleanup?: () => void }) | null = null;
const onboarding = new Set(['/splash', '/welcome', '/shelves', '/ritual', '/signup']);

export function route(path: string, view: View, { nav = false, auth = true, navKey }: { nav?: boolean; auth?: boolean; navKey?: string } = {}) {
  const keys: string[] = [];
  const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ path, re, keys, view, nav, auth, navKey });
}

export const navigate = (to: string, { replace = false } = {}) => {
  const h = '#' + to;
  if (replace) { history.replaceState(null, '', h); render(); } else if (location.hash === h) render(); else location.hash = h;
};

/**
 * In-app back. Always goes to the explicit fallback instead of history.back():
 * a hash router can otherwise leave the app entirely, and installed PWAs have
 * no referrer to go "back" to. Browser/device back still works via hashchange.
 */
export const back = (fallback = '/home') => navigate(fallback);

export const refresh = () => render({ keepScroll: true });

function parse(): { path: string; params: RouteParams } {
  const raw = location.hash.slice(1);
  if (!raw || raw.startsWith('access_token') || raw.startsWith('error')) return { path: '', params: {} };
  const [path, qs] = raw.split('?');
  return { path, params: Object.fromEntries(new URLSearchParams(qs || '')) };
}

async function render({ keepScroll = false } = {}) {
  const { path, params } = parse();
  const { session } = store.get();
  let r: Route | null = null, vals: RouteParams = {};
  for (const x of routes) { const m = x.re.exec(path); if (m) { r = x; x.keys.forEach((k, i) => { vals[k] = decodeURIComponent(m[i + 1]); }); break; } }
  const home = session ? '/home' : (store.prefs.get('onboarded', false) ? '/signup' : '/splash');
  if (!r || (r.auth && !session) || (session && onboarding.has(path))) { navigate(path === '' || !r ? home : (r.auth && !session ? '/welcome' : '/home'), { replace: true }); return; }

  const app = document.getElementById('app')!;
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
  document.querySelectorAll<HTMLAnchorElement>('#nav a').forEach(a => { const on = a.dataset.nav === (r!.navKey || r!.path.split('/')[1]); a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
  scrollTo(0, keepScroll ? y : 0);
  if (!keepScroll) { node.setAttribute('tabindex', '-1'); node.focus({ preventScroll: true }); }
  if (reduced()) node.classList.add('still');
}

export function start() {
  addEventListener('hashchange', () => { void render(); });
  void render();
}
