// Reader for books the reader imported from their own device: PDF, EPUB or TXT.
import { html, el } from '../html';
import { ic, mochi } from '../ui';
import { back } from '../router';
import { getBook, updateProgress } from '../files';
import { cleanText, toPages } from '../reader';
import { parseEpub } from '../epub';
import { sfx } from '../sound';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export function localread({ id }: { id: string }): HTMLElement {
  const root = el(html`<header class="rdr-h">
  <button class="iconbtn" data-act="back" aria-label="Back">${ic.back}</button>
  <div class="rdr-title"><b>loading…</b><small>on this device</small></div>
  <span class="iconbtn ghosted"></span><span class="iconbtn ghosted"></span>
</header>
<div class="rdr-progress"><i id="lr-fill"></i></div>
<div class="rdr-stage" id="stage"></div>
<footer class="rdr-foot">
  <button class="round" data-act="prev" aria-label="Previous">${ic.back}</button>
  <div class="rdr-mid"><span id="lr-pos">—</span></div>
  <button class="round pri" data-act="next" aria-label="Next">${ic.chevron}</button>
</footer>`);
  root.classList.add('reader', 'local-reader');

  const stage = root.querySelector<HTMLElement>('#stage')!;
  const fill = root.querySelector<HTMLElement>('#lr-fill')!;
  const pos = root.querySelector<HTMLElement>('#lr-pos')!;
  const prev = root.querySelector<HTMLButtonElement>('[data-act=prev]')!;
  const next = root.querySelector<HTMLButtonElement>('[data-act=next]')!;

  const progress = (ratio: number, where: string) => {
    fill.style.width = Math.round(Math.max(0, Math.min(1, ratio)) * 100) + '%';
    pos.textContent = where;
    void updateProgress(id, ratio, where);
  };
  const showError = () => {
    stage.innerHTML = String(html`<div class="rdr-empty">${mochi('sleepy', { size: 110 })}<h2 class="title">this one won't open</h2><p class="muted">Mochi couldn't read that file. Try another PDF, EPUB or TXT.</p><a class="btn white" href="#/library">back to my books</a></div>`);
  };
  let goPrev = () => {}, goNext = () => {};
  root.addEventListener('click', e => {
    const act = (e.target as Element).closest('[data-act]')?.getAttribute('data-act');
    if (act === 'back') back('/library');
    if (act === 'prev') goPrev();
    if (act === 'next') goNext();
  });

  void (async () => {
    const book = await getBook(id);
    if (!book) return;
    root.querySelector('.rdr-title b')!.textContent = book.title;
    root.querySelector('.rdr-title small')!.textContent = `${book.type.toUpperCase()} · on this device`;
    stage.innerHTML = String(html`<div class="rdr-loading">${mochi('reading', { size: 110 })}<p class="muted">opening ${book.title}…</p></div>`);

    if (book.type === 'pdf') {
      let doc: pdfjs.PDFDocumentProxy | null = null;
      let page = Math.max(1, Number(book.location) || 1);
      let busy = false;
      const render = async () => {
        if (!doc || busy) return;
        busy = true;
        try {
          const p = await doc.getPage(page);
          const base = p.getViewport({ scale: 1 });
          const scale = Math.max(0.4, Math.min(4, Math.min(stage.clientWidth - 36, 720) / base.width));
          const vp = p.getViewport({ scale });
          const dpr = Math.min(2, devicePixelRatio || 1);
          const cv = document.createElement('canvas');
          cv.className = 'pdf-canvas';
          cv.width = Math.floor(vp.width * dpr); cv.height = Math.floor(vp.height * dpr);
          cv.style.width = vp.width + 'px'; cv.style.height = vp.height + 'px';
          await p.render({ canvasContext: cv.getContext('2d')!, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined }).promise;
          stage.replaceChildren(cv);
          progress(page / doc.numPages, `${page} / ${doc.numPages}`);
          prev.disabled = page === 1; next.disabled = page === doc.numPages;
          stage.scrollTop = 0;
        } catch (e) { console.warn(e); }
        finally { busy = false; }
      };
      goPrev = () => { if (doc && page > 1) { page--; sfx.step(); void render(); } };
      goNext = () => { if (doc && page < doc.numPages) { page++; sfx.step(); void render(); } };
      try {
        doc = await pdfjs.getDocument({ data: new Uint8Array(await book.blob.arrayBuffer()) }).promise;
        if (page > doc.numPages) page = 1;
        await render();
      } catch { showError(); }
      return;
    }

    // TXT and EPUB share the paginated text view
    try {
      let text: string;
      if (book.type === 'epub') text = (await parseEpub(book.blob)).text;
      else text = await book.blob.text();
      const pages = toPages(cleanText(text));
      let p = Math.min(Math.max(0, Number(book.location) || 0), Math.max(0, pages.length - 1));
      const paint = () => {
        if (!pages.length) return;
        stage.innerHTML = String(html`<article class="rdr-paper">
  <div class="rdr-chapter">${pages[p].chapter}</div>
  <div class="rdr-body">${pages[p].text.split('\n').map(l => html`<p>${l.trim() || '\u00a0'}</p>`)}</div>
  <div class="rdr-folio">${p + 1} <span>/ ${pages.length}</span></div></article>`);
        progress((p + 1) / pages.length, `${p + 1} / ${pages.length}`);
        prev.disabled = p === 0; next.disabled = p === pages.length - 1;
        stage.scrollTop = 0;
      };
      goPrev = () => { if (p > 0) { p--; sfx.step(); paint(); } };
      goNext = () => { if (p < pages.length - 1) { p++; sfx.step(); paint(); } };
      if (!pages.length) showError(); else paint();
    } catch (e) { console.warn(e); showError(); }
  })();

  return root;
}
