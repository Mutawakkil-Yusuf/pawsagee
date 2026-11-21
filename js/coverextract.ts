// Pull a real cover out of an imported book file: PDF first page, or EPUB cover image.
// Heavy libraries are loaded lazily so the main app bundle stays small.
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { LocalBook } from './types';
import { parseEpub } from './epub';

const blobToData = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(blob);
});

export async function extractCover(file: File, type: LocalBook['type']): Promise<string | null> {
  try {
    if (type === 'pdf') {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
      const buf = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
      const page = await doc.getPage(1);
      const vp0 = page.getViewport({ scale: 1 });
      const scale = 240 / Math.max(1, vp0.width);
      const vp = page.getViewport({ scale });
      const cv = document.createElement('canvas');
      cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
      await page.render({ canvasContext: cv.getContext('2d')!, viewport: vp }).promise;
      return cv.toDataURL('image/jpeg', 0.72);
    }
    if (type === 'epub') {
      const parsed = await parseEpub(file);
      return parsed.cover;
    }
  } catch (e) { console.warn('cover extraction failed', e); }
  return null;
}
