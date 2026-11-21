// The personal shelf: books the reader imported from their own device.
import { html, el } from '../html';
import { ic, toast, gradFor } from '../ui';
import { navigate } from '../router';
import { allBooks, putBook, deleteBook, kindOf, prettyTitle } from '../files';
import { sfx } from '../sound';
import { extractCover } from '../coverextract';
import type { LocalBook } from '../types';

export async function importFiles(files: FileList | File[]): Promise<number> {
  let n = 0;
  for (const f of Array.from(files)) {
    if (f.size > 40 * 1024 * 1024) { toast('that file is too big for this device.'); continue; }
    const type = kindOf(f.name);
    const b: LocalBook = {
      id: crypto.randomUUID(), name: f.name, title: prettyTitle(f.name), type, size: f.size,
      addedAt: Date.now(), lastOpened: 0, progress: 0, location: '', blob: f,
      cover: await extractCover(f, type),
    };
    await putBook(b); n++;
  }
  return n;
}

const fmtSize = (n: number) => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;

export function localShelf(): HTMLElement {
  const wrap = el(html`<section class="local-shelf">
  <div class="sec-h"><h2 class="heading">your books</h2><label class="link b import-label">${ic.plus} add files</label></div>
  <input type="file" id="local-file" accept=".pdf,.epub,.txt,application/pdf,application/epub+zip,text/plain" multiple hidden>
  <div id="local-grid" class="local-grid"><p class="muted">loading your books…</p></div>
</section>`);

  const input = wrap.querySelector<HTMLInputElement>('#local-file')!;
  const grid = wrap.querySelector<HTMLElement>('#local-grid')!;
  const paint = async () => {
    const books = (await allBooks()).sort((a, b) => b.lastOpened - a.lastOpened || b.addedAt - a.addedAt);
    if (!books.length) {
      grid.innerHTML = String(html`<div class="local-empty"><p class="muted">No books here yet. Add a PDF, EPUB or TXT you've downloaded.</p></div>`);
      return;
    }
    grid.innerHTML = String(html`${books.map(b => {
      const g = gradFor(b.title);
      return html`<div class="local-card" data-id="${b.id}">
  <div class="local-cover ${g.dark ? 'dark' : ''}" style="--a:${g.a};--b:${g.b}">${
    b.cover ? html`<img class="local-cover-img" src="${b.cover}" alt="" aria-hidden="true">` : html`<span>${b.type.toUpperCase()}</span><b>${b.title}</b>`
  }</div>
  <div class="local-meta"><b>${b.title}</b><small>${fmtSize(b.size)} · ${b.progress ? Math.round(b.progress * 100) + '%' : 'not started'}</small></div>
  <button class="iconbtn sm local-del" data-del="${b.id}" aria-label="Remove ${b.title}">${ic.trash}</button>
</div>`;
    })}`);
  };
  void paint();

  wrap.querySelector('.import-label')!.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    if (!input.files?.length) return;
    const n = await importFiles(input.files);
    input.value = '';
    if (n) { sfx.add(); toast(`${n} ${n === 1 ? 'book' : 'books'} added.`); await paint(); }
  });
  grid.addEventListener('click', async e => {
    const del = (e.target as Element).closest('[data-del]') as HTMLElement | null;
    if (del) { await deleteBook(del.dataset.del!); sfx.pause(); await paint(); return; }
    const card = (e.target as Element).closest('[data-id]') as HTMLElement | null;
    if (card) navigate('/local/' + card.dataset.id);
  });
  return wrap;
}
