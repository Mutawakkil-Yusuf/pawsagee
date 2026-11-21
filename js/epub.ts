// Minimal EPUB reader: unzip, follow the spine, strip markup to clean text.
// Avoids iframe-based renderers so EPUBs use the same beautiful paginated view as TXT.
import JSZip from 'jszip';

interface ManifestItem { id: string; href: string; mediaType: string }

const decodeEntities = (s: string) => s
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export async function parseEpub(blob: Blob): Promise<{ text: string; cover: string | null }> {
  const zip = await JSZip.loadAsync(blob);
  const names = Object.keys(zip.files);
  const container = zip.file('META-INF/container.xml');
  if (!container) throw new Error('not an epub');
  const containerDoc = new DOMParser().parseFromString(await container.async('string'), 'application/xml');
  const opfPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path') || names.find(n => n.endsWith('.opf')) || '';
  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error('no opf');
  const opf = new DOMParser().parseFromString(await opfFile.async('string'), 'application/xml');

  const items: ManifestItem[] = Array.from(opf.getElementsByTagName('item')).map(el => ({
    id: el.getAttribute('id') || '', href: el.getAttribute('href') || '', mediaType: el.getAttribute('media-type') || '',
  }));
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const byId = (id: string) => items.find(i => i.id === id);

  // cover image as a data URL
  let cover: string | null = null;
  const coverId = Array.from(opf.getElementsByTagName('meta')).find(m => m.getAttribute('name') === 'cover')?.getAttribute('content');
  const guideCover = opf.getElementsByTagName('reference')[0]?.getAttribute('href');
  const coverItem = (coverId && byId(coverId)) || items.find(i => /cover/i.test(i.id) && /image/i.test(i.mediaType));
  const coverHref = coverItem?.href || guideCover;
  if (coverHref) {
    const f = zip.file(base + decodeURIComponent(coverHref)) || zip.file(decodeURIComponent(coverHref));
    if (f) {
      const data = await f.async('base64');
      const mime = coverItem?.mediaType || (coverHref.endsWith('.png') ? 'image/png' : 'image/jpeg');
      cover = `data:${mime};base64,${data}`;
    }
  }

  // spine order -> XHTML text
  const ids = Array.from(opf.getElementsByTagName('itemref')).map(n => n.getAttribute('idref') || '');
  const docs: string[] = [];
  for (const id of ids) {
    const item = byId(id);
    if (!item || !/xhtml|html/.test(item.mediaType)) continue;
    const f = zip.file(base + decodeURIComponent(item.href)) || zip.file(decodeURIComponent(item.href));
    if (!f) continue;
    const html = await f.async('string');
    const doc = new DOMParser().parseFromString(html, 'application/xhtml+xml');
    doc.querySelectorAll('script,style').forEach(n => n.remove());
    docs.push((doc.body?.textContent || '').replace(/\s+/g, ' ').trim());
  }
  return { text: docs.join('\n\n'), cover };
}
