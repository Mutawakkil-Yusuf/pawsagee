import { html, raw, el } from '../html';
import { ic, mochi, cover, toast, authorsLine, animateIn } from '../ui';
import * as store from '../store';
import { search, byIsbn } from '../openlibrary';
import { addBook, removeBook } from '../actions';
import { navigate, back } from '../router';
import { sfx } from '../sound';
import { sheet } from '../ui';
import { candidates, findCover, applyCover, cachedGoogle } from '../covers';
import { buzz } from '../sound';
import type { ReadingStatus, RouteParams } from '../types';

const STATUSES = [['want', 'want to read', 'butter'], ['reading', 'reading', 'mint'], ['finished', 'finished', 'pink']];
const IDEAS = ['atomic habits', 'adichie', 'dune', 'sapiens', 'kintu', 'the alchemist'];

const asBook = d => ({ key: d.key || 'r:' + d.title, title: d.title, authors: d.authors, ol_cover_id: d.cover_i, cover_url: d.cover_url, isbn13: d.isbn });

export function add({ tab = 'search', shelf = '' }: RouteParams) {
  let results = [], open = null, shelfId = shelf, q = '', ctl = null, state = 'idle', timer = null;
  const inLib = d => store.get().books.find(b => (d.key && b.book.ol_work_key === d.key) || b.book.title.toLowerCase() === d.title.toLowerCase());

  const shelfPicker = () => store.get().shelves.length ? html`<div class="chips tight" aria-label="Put on shelf">${store.get().shelves.map(sh => html`<button class="chip sm ${shelfId === sh.id ? 'on' : ''}" data-act="pick-shelf" data-id="${sh.id}">${sh.name}</button>`)}</div>` : '';

  const row = (d, i) => {
    const mine = inLib(d);
    const isOpen = open === i;
    return html`<article class="res ${isOpen ? 'open' : ''}" style="--i:${i}">
<div class="res-top">${cover(asBook(d), { w: 56 })}
<div class="res-t"><b>${d.title}</b><small>${d.authors.join(', ')}${d.first_publish_year ? ' · ' + d.first_publish_year : ''}${d.page_count ? html`<br>${d.page_count} pages` : ''}</small></div>
${mine ? html`<a class="btn soft sm" href="#/book/${mine.id}">view</a>` : isOpen ? '' : html`<button class="btn primary sm" data-act="open" data-i="${i}" aria-label="Add ${d.title}">${ic.plus} add</button>`}</div>
${isOpen && !mine ? html`<div class="res-pick">${STATUSES.map(([k, l, c]) => html`<button class="btn tintbtn ${c}" data-act="add" data-i="${i}" data-st="${k}" data-sfx="none">${l}</button>`)}</div>${shelfPicker()}` : ''}</article>`;
  };

  const list = () => {
    if (state === 'loading') return html`<div class="skel-list">${[0, 1, 2].map(() => html`<div class="skel"></div>`)}</div>`;
    if (state === 'error') return html`<div class="center pad">${mochi('sleepy', { size: 90 })}<p class="muted">mochi dropped something. try again?</p><button class="btn white sm" data-act="retry">try again</button></div>`;
    if (state === 'idle') return html`<div class="center pad">${mochi('curious', { size: 110 })}<p class="muted">Search a title, author or ISBN. Or try one of these:</p><div class="chips wrap">${IDEAS.map(w => html`<button class="chip" data-act="idea" data-v="${w}">${w}</button>`)}</div></div>`;
    return html`<div class="res-h"><span class="overline">${results.length} RESULTS</span><small class="muted">covers from Open Library</small></div>
${results.map(row)}<p class="muted notfound">Can't find it? Switch to <button class="link b" data-act="tab" data-v="manual">manual</button> and Mochi will help you add it yourself.</p>`;
  };

  const run = async () => {
    ctl?.abort(); ctl = new AbortController();
    if (q.trim().length < 2) { state = 'idle'; paint(); return; }
    state = 'loading'; paint();
    try { results = await search(q, { signal: ctl.signal }); state = results.length ? 'done' : 'done'; open = null; paint(); }
    catch (e) { if ((e as Error).name === 'AbortError') return; state = 'error'; sfx.error(); paint(); }
  };

  const root = el(html`<header class="add-h"><button class="iconbtn" data-act="back" aria-label="Back">${ic.back}</button><h1 class="display">add a book</h1>${mochi('curious', { size: 56, cls: '' })}</header>
<div class="seg" role="tablist">${[['search', 'search'], ['scan', 'scan isbn'], ['manual', 'manual']].map(([k, l]) => html`<button role="tab" class="${k === tab ? 'on' : ''}" aria-selected="${k === tab}" data-act="tab" data-v="${k}">${l}</button>`)}</div>
<div id="pane"></div>`);
  const pane = root.querySelector<HTMLElement>('#pane')!;

  const paint = () => { if (tab === 'search') { const l = pane.querySelector<HTMLElement>('#results'); if (l) { l.innerHTML = String(list()); animateIn(l); fillMissing(); } } };
  // results with no cover: ask Google Books while the list is on screen
  const fillMissing = () => { if (state !== 'done') return; results.forEach(d => { const b = asBook(d); if (!candidates(b).length) findCover(b).then(u => u && applyCover(b.key, u)); }); };

  const showTab = () => {
    root.querySelectorAll<HTMLElement>('.seg button').forEach(b => { const on = b.dataset.v === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    if (tab === 'search') {
      pane.innerHTML = String(html`<label class="searchin"><span>${ic.search}</span><input id="q" type="search" class="input" placeholder="title, author or isbn" value="${q}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search" aria-label="Search books"><button class="clear" data-act="clear" aria-label="Clear" ${q ? '' : 'hidden'}>${ic.x}</button></label><div id="results" aria-live="polite">${list()}</div>`);
      const inp = pane.querySelector<HTMLInputElement>('#q')!;
      inp.addEventListener('input', () => { q = inp.value; pane.querySelector<HTMLElement>('.clear')!.hidden = !q; clearTimeout(timer); timer = setTimeout(run, 350); });
      inp.addEventListener('keydown', e => { if ((e as KeyboardEvent).key === 'Enter') { clearTimeout(timer); run(); } });
      if (!q) inp.focus({ preventScroll: true });
    }
    if (tab === 'scan') {
      pane.innerHTML = String(html`<div class="card pane-card"><h2>scan or type an isbn</h2>
<button class="btn primary" data-act="camera">${ic.scan} scan with camera</button><p class="muted center">or type the number under the barcode</p>
<form id="isbnf"><input class="input" name="isbn" inputmode="numeric" placeholder="978..." autocomplete="off" aria-label="ISBN" required><button class="btn white" type="submit" data-sfx="pop">find it</button></form></div><div id="isbn-out"></div>`);
      pane.querySelector<HTMLFormElement>('#isbnf')!.addEventListener('submit', e => { e.preventDefault(); lookupIsbn(String(new FormData(e.target as HTMLFormElement).get('isbn'))); });
    }
    if (tab === 'manual') {
      pane.innerHTML = String(html`<form id="mf" class="card pane-card"><h2>add it yourself</h2>
<label class="lbl" for="mt">title</label><input id="mt" class="input" name="title" maxlength="300" required>
<label class="lbl" for="ma">author</label><input id="ma" class="input" name="author" maxlength="120">
<label class="lbl" for="mp">pages</label><input id="mp" class="input" name="pages" inputmode="numeric" min="1" max="9999" type="number">
<label class="lbl">status</label><div class="chips">${STATUSES.map(([k, l], i) => html`<label class="chip radio"><input type="radio" name="st" value="${k}" ${i === 0 ? 'checked' : ''}><span>${l}</span></label>`)}</div>
<button class="btn primary" type="submit" data-sfx="pop">add to my shelf</button></form>`);
      pane.querySelector<HTMLFormElement>('#mf')!.addEventListener('submit', async e => {
        e.preventDefault();
        const f = new FormData(e.target as HTMLFormElement);
        const title = String(f.get('title')).trim(); if (!title) return;
        const exists = store.get().books.find(b => b.book.title.toLowerCase() === title.toLowerCase());
        if (exists) { toast('that one is already on your shelf.'); navigate('/book/' + exists.id); return; }
        const r = await addBook({ title, authors: String(f.get('author')).trim() ? [String(f.get('author')).trim()] : [], page_count: +f.get('pages') || null }, String(f.get('st')) as ReadingStatus, shelfId || null);
        if (r) { sfx.add(); toast('on the shelf! mochi approves.', { action: 'undo', onAction: () => removeBook(r.id) }); navigate('/book/' + r.id); }
      });
    }
  };

  async function lookupIsbn(isbn) {
    const out = pane.querySelector('#isbn-out');
    out.innerHTML = String(html`<div class="skel-list"><div class="skel"></div></div>`);
    try {
      const d = await byIsbn(isbn);
      if (!d) { out.innerHTML = String(html`<p class="muted center pad">No match for that ISBN. Try manual and Mochi will help.</p>`); sfx.error(); return; }
      results = [d]; open = 0; tab = 'search'; q = d.title; state = 'done'; showTab();
    } catch { out.innerHTML = String(html`<p class="muted center pad">mochi dropped something. try again?</p>`); sfx.error(); }
  }

  const loadScanner = () => window.Html5Qrcode ? Promise.resolve() : new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = '/vendor/html5-qrcode.min.js'; sc.onload = ok; sc.onerror = no; document.head.append(sc); });

  // Works on iPhone and Android: uses the browser's own barcode detector when it has one, a bundled reader otherwise.
  async function camera() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { toast('the camera needs https. type the isbn for now.'); return; }
    try { await loadScanner(); } catch { toast("couldn't load the scanner. type the isbn instead."); return; }
    let scanner, done = false;
    const stop = () => { if (scanner?.isScanning) scanner.stop().then(() => scanner.clear()).catch(() => {}); };
    const sh = sheet(html`<h2>point at the barcode</h2><p class="muted">It's the long number on the back cover.</p><div id="reader" class="reader"></div><button class="btn white" data-close>cancel</button>`, { title: 'Scan', onMount: async (sheetEl, close) => {
      const F = window.Html5QrcodeSupportedFormats;
      scanner = new window.Html5Qrcode('reader', { formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E], useBarCodeDetectorIfSupported: true, verbose: false });
      try {
        await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: (w) => ({ width: Math.min(300, w - 40), height: 130 }) }, text => {
          if (done) return; done = true; sfx.chime(); buzz(30); stop(); close(); lookupIsbn(text);
        }, () => {});
      } catch { close(); toast("couldn't open the camera. allow it in your browser, or type the isbn."); }
    } });
    new MutationObserver((_, ob) => { if (!document.body.contains(sh.el)) { stop(); ob.disconnect(); } }).observe(document.getElementById('sheet-root'), { childList: true });
  }

  root.addEventListener('click', async e => {
    const a = ((e.target as Element).closest('[data-act]') as HTMLElement | null); if (!a) return;
    const act = a.dataset.act;
    if (act === 'back') back('/home');
    if (act === 'tab') { tab = a.dataset.v; showTab(); }
    if (act === 'clear') { q = ''; state = 'idle'; showTab(); }
    if (act === 'idea') { q = a.dataset.v; showTab(); run(); }
    if (act === 'retry') run();
    if (act === 'camera') camera();
    if (act === 'open') { open = +a.dataset.i; sfx.pop(); paint(); }
    if (act === 'pick-shelf') { shelfId = shelfId === a.dataset.id ? '' : a.dataset.id; paint(); }
    if (act === 'add') {
      const d = results[+a.dataset.i];
      (a as HTMLButtonElement).disabled = true;
      const r = await addBook({ key: d.key, title: d.title, authors: d.authors, first_publish_year: d.first_publish_year, cover_i: d.cover_i, cover_url: d.cover_url || (d.cover_i ? null : cachedGoogle(asBook(d))), page_count: d.page_count, isbn: d.isbn }, a.dataset.st as ReadingStatus, shelfId || null);
      if (!r) return;
      open = null; sfx.add();
      toast(r.duplicate ? 'already on your shelf.' : 'on the shelf! mochi approves.', { action: r.duplicate ? undefined : 'undo', onAction: () => removeBook(r.id).then(paint) });
      paint();
    }
  });

  showTab();
  if (tab === 'search' && q) run();
  root._cleanup = () => { clearTimeout(timer); ctl?.abort(); };
  return root;
}
