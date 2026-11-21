import { html, raw, el } from '../html.js';
import { ic, sheet, toast, cover, swatches, SHELF_COLORS, animateIn } from '../ui.js';
import * as store from '../store.js';
import { createShelf, updateShelf, deleteShelf, moveShelf } from '../actions.js';
import { refresh as rerender } from '../router.js';
import { sfx } from '../sound.js';
import { bookRow, emptyShelf } from './shared.js';

const FILTERS = [['all', 'all'], ['reading', 'reading'], ['want', 'up next'], ['finished', 'done']];

export function library() {
  const s = store.get();
  let filter = store.prefs.get('libFilter', 'all');
  let query = '';
  let searching = false;

  if (!s.books.length) {
    const root = el(html`<header><h1 class="display">my shelf</h1><p class="muted">0 books · ${s.shelves.length} collections</p></header>${emptyShelf()}`);
    return root;
  }

  const body = () => {
    const st = store.get();
    const pass = b => filter === 'all' || b.status === filter;
    if (searching && query.trim()) {
      const qq = query.trim().toLowerCase();
      const hits = st.books.filter(b => (b.book.title + ' ' + (b.book.authors || []).join(' ')).toLowerCase().includes(qq));
      return hits.length ? html`<div class="list">${hits.map(b => bookRow(b))}</div>` : html`<p class="muted center pad">no matches. Mochi checked twice.</p>`;
    }
    const shelfCards = st.shelves.map(sh => {
      const all = st.books.filter(b => b.shelf_ids.includes(sh.id));
      return shelfCard({ id: sh.id, name: sh.name, color: sh.color, count: all.length, shown: all.filter(pass), editable: true });
    });
    const loose = st.books.filter(b => !b.shelf_ids.length);
    const looseCard = loose.length ? shelfCard({ id: '', name: st.shelves.length ? 'unshelved' : 'my books', color: 'lilac', count: loose.length, shown: loose.filter(pass), editable: false }) : '';
    return html`${shelfCards}${looseCard}<button class="newshelf" data-act="new-shelf"><span>${ic.plus}</span>new collection</button>`;
  };

  const shelfCard = ({ id, name, color, count, shown, editable }) => html`<section class="shelfcard" style="background:${SHELF_COLORS[color]?.bg}">
<header><h3>${name}</h3><span class="pill white">${count} ${count === 1 ? 'book' : 'books'}</span>${editable ? html`<button class="iconbtn sm" data-act="shelf-opts" data-id="${id}" aria-label="Options for ${name}">${ic.more}</button>` : ''}</header>
<div class="minis">${shown.slice(0, 5).map(b => html`<a href="#/book/${b.id}" class="mini" aria-label="${b.book.title}">${cover(b.book, { w: 64 })}</a>`)}
${shown.length > 5 ? html`<span class="mini more-n">+${shown.length - 5}</span>` : ''}
${id !== '' ? html`<a class="mini plus" href="#/add?shelf=${id}" aria-label="Add a book to ${name}">${ic.plus}</a>` : ''}</div><i class="plank"></i></section>`;

  const root = el(html`<header class="lib-h"><div><h1 class="display">my shelf</h1><p class="muted">${s.books.length} books · ${s.shelves.length} collections</p></div>
<button class="iconbtn" data-act="search" aria-label="Search my books">${ic.search}</button></header>
<div class="searchbar" hidden><span>${ic.search}</span><input class="input" id="lq" placeholder="search my books" aria-label="Search my books" autocomplete="off"></div>
<div class="chips" role="tablist">${FILTERS.map(([k, l]) => html`<button class="chip ${k === filter ? 'on' : ''}" role="tab" aria-selected="${k === filter}" data-act="filter" data-v="${k}">${l}</button>`)}</div>
<div id="lib-body">${body()}</div>`);
  const out = root.querySelector('#lib-body');
  const paint = () => { out.innerHTML = String(body()); animateIn(out); };

  root.addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    const act = a.dataset.act;
    if (act === 'search') {
      searching = !searching;
      const bar = root.querySelector('.searchbar'); bar.hidden = !searching;
      if (searching) root.querySelector('#lq').focus(); else { query = ''; paint(); }
    }
    if (act === 'filter') {
      filter = a.dataset.v; store.prefs.set('libFilter', filter);
      root.querySelectorAll('.chip').forEach(c => { const on = c === a; c.classList.toggle('on', on); c.setAttribute('aria-selected', on); });
      paint();
    }
    if (act === 'new-shelf') shelfSheet();
    if (act === 'shelf-opts') shelfSheet(store.get().shelves.find(x => x.id === a.dataset.id));
  });
  root.querySelector('#lq').addEventListener('input', e => { query = e.target.value; paint(); });
  return root;
}

function shelfSheet(shelf) {
  let color = shelf?.color || 'rose';
  const idx = shelf ? store.get().shelves.findIndex(x => x.id === shelf.id) : -1;
  const n = store.get().shelves.length;
  sheet(html`<h2>${shelf ? 'edit collection' : 'new collection'}</h2>
<form id="sf"><label class="lbl" for="sn">name</label><input id="sn" class="input" name="name" maxlength="40" required value="${shelf?.name || ''}" placeholder="e.g. weekend reads">
<label class="lbl">color</label>${swatches(color, 'color')}
<button class="btn primary" type="submit" data-sfx="pop">${shelf ? 'save' : 'create'}</button></form>
${shelf ? html`<div class="split"><button class="btn white sm" data-act="up" ${idx === 0 ? 'disabled' : ''}>${ic.up} move up</button><button class="btn white sm" data-act="down" ${idx === n - 1 ? 'disabled' : ''}>${ic.down} move down</button></div>
<button class="btn ghost danger" data-act="del" data-sfx="none">${ic.trash} delete collection</button>` : ''}`,
  { title: 'Collection', onMount: (sh, close) => {
    sh.addEventListener('click', async e => {
      const a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'color') {
        color = a.dataset.v;
        sh.querySelectorAll('.swatch').forEach(x => { const on = x === a; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
      }
      if (a.dataset.act === 'up' || a.dataset.act === 'down') { close(); await moveShelf(shelf.id, a.dataset.act === 'up' ? -1 : 1); rerender(); }
      if (a.dataset.act === 'del') {
        const body = sh.querySelector('.sheet-body');
        body.innerHTML = String(html`<h2>delete ${shelf.name}?</h2><p class="muted">Your books stay in your library. Only the collection goes.</p><div class="split"><button class="btn white" data-close>keep it</button><button class="btn primary" data-act="really" data-sfx="none">delete</button></div>`);
      }
      if (a.dataset.act === 'really') { close(); sfx.pause(); await deleteShelf(shelf.id); toast('collection removed.'); rerender(); }
    });
    sh.querySelector('#sf').addEventListener('submit', async e => {
      e.preventDefault();
      const name = new FormData(e.target).get('name').toString().trim(); if (!name) return;
      close();
      if (shelf) await updateShelf(shelf.id, { name, color }); else { await createShelf(name, color); sfx.add(); toast('new collection ready.'); }
      rerender();
    });
  } });
}
