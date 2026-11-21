// Read a PDF picked from the device. Rendered with pdf.js so it looks and behaves
// like the rest of Pawsage instead of handing off to a browser-specific viewer.
import { html, el } from '../html';
import { ic, mochi } from '../ui';
import { back } from '../router';
import { sfx } from '../sound';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

let currentFile: File | null = null;

export function pdfread() {
  const root = el(html`<header class="rdr-h">
  <button class="iconbtn" data-act="back" aria-label="Back">${ic.back}</button>
  <div class="rdr-title"><b>read a pdf</b><small id="pdf-name">from your device</small></div>
  <button class="iconbtn" data-act="zoom-out" aria-label="Zoom out">${ic.minus}</button>
  <button class="iconbtn" data-act="zoom-in" aria-label="Zoom in">${ic.plus}</button>
</header>
<div class="rdr-progress"><i id="pdf-fill"></i></div>
<div class="rdr-stage pdf-stage" id="stage"></div>
<footer class="rdr-foot">
  <button class="round" data-act="prev" aria-label="Previous page">${ic.back}</button>
  <div class="rdr-mid"><span id="pdf-page">—</span><input id="pdf-slider" class="rdr-slider" type="range" min="1" max="1" value="1" aria-label="Page"></div>
  <button class="round pri" data-act="next" aria-label="Next page">${ic.chevron}</button>
</footer>`);
  root.classList.add('reader', 'pdf-reader');

  const stage = root.querySelector<HTMLElement>('#stage')!;
  const pageLabel = root.querySelector<HTMLElement>('#pdf-page')!;
  const slider = root.querySelector<HTMLInputElement>('#pdf-slider')!;
  const fill = root.querySelector<HTMLElement>('#pdf-fill')!;
  let doc: pdfjs.PDFDocumentProxy | null = null;
  let page = 1, zoom = 1, rendering = false;

  const choose = () => {
    stage.innerHTML = String(html`<div class="rdr-empty">
  ${mochi('curious', { size: 120 })}
  <h2 class="title">open a pdf</h2>
  <p class="muted">Pick a book or document from your device. It stays on your phone — nothing is uploaded.</p>
  <label class="btn primary">${ic.book} choose a pdf<input type="file" id="pdf-file" accept="application/pdf,.pdf" hidden></label>
</div>`);
    stage.querySelector<HTMLInputElement>('#pdf-file')!.addEventListener('change', e => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) { currentFile = f; void load(f); }
    });
  };

  const render = async () => {
    if (!doc || rendering) return;
    rendering = true;
    try {
      const p = await doc.getPage(page);
      const base = p.getViewport({ scale: 1 });
      const avail = Math.min(stage.clientWidth - 36, 720);
      const scale = Math.max(0.4, Math.min(4, (avail / base.width) * zoom));
      const vp = p.getViewport({ scale });
      const dpr = Math.min(2, devicePixelRatio || 1);
      const cv = document.createElement('canvas');
      cv.className = 'pdf-canvas';
      cv.width = Math.floor(vp.width * dpr); cv.height = Math.floor(vp.height * dpr);
      cv.style.width = vp.width + 'px'; cv.style.height = vp.height + 'px';
      const ctx = cv.getContext('2d')!;
      await p.render({ canvasContext: ctx, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined }).promise;
      stage.replaceChildren(cv);
      pageLabel.textContent = `${page} / ${doc.numPages}`;
      slider.max = String(doc.numPages); slider.value = String(page);
      fill.style.width = Math.round(page / doc.numPages * 100) + '%';
      root.querySelector<HTMLButtonElement>('[data-act=prev]')!.disabled = page === 1;
      root.querySelector<HTMLButtonElement>('[data-act=next]')!.disabled = page === doc.numPages;
      stage.scrollTop = 0;
    } catch (e) { console.warn(e); }
    finally { rendering = false; }
  };

  const go = (n: number) => {
    if (!doc) return;
    const next = Math.max(1, Math.min(doc.numPages, n));
    if (next === page) return;
    page = next; sfx.step(); void render();
  };

  async function load(f: File) {
    stage.innerHTML = String(html`<div class="rdr-loading">${mochi('reading', { size: 110 })}<p class="muted">opening your pdf…</p></div>`);
    root.querySelector('#pdf-name')!.textContent = f.name;
    try {
      const buf = await f.arrayBuffer();
      doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
      page = 1; zoom = 1;
      await render();
    } catch {
      stage.innerHTML = String(html`<div class="rdr-empty">${mochi('sleepy', { size: 110 })}<p class="muted">mochi couldn't open that pdf. try another file?</p><button class="btn white" data-act="choose">choose another</button></div>`);
    }
  }

  root.addEventListener('click', e => {
    const a = (e.target as Element).closest('[data-act]') as HTMLElement | null; if (!a) return;
    const act = a.dataset.act;
    if (act === 'back') back('/more');
    if (act === 'prev') go(page - 1);
    if (act === 'next') go(page + 1);
    if (act === 'zoom-in') { zoom = Math.min(3, zoom + 0.2); void render(); }
    if (act === 'zoom-out') { zoom = Math.max(0.6, zoom - 0.2); void render(); }
    if (act === 'choose') { currentFile = null; choose(); }
  });
  slider.addEventListener('input', () => go(Number(slider.value)));
  root.addEventListener('keydown', e => {
    if ((e as KeyboardEvent).key === 'ArrowLeft') go(page - 1);
    if ((e as KeyboardEvent).key === 'ArrowRight') go(page + 1);
  });

  if (currentFile) void load(currentFile); else choose();
  return root;
}
