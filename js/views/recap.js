// Monthly recap. The preview IS the PNG: a 1080x1920 canvas drawn once, shown scaled down, shared as-is.
import { html, el } from '../html.js';
import { ic, gradFor, toast } from '../ui.js';
import * as store from '../store.js';
import { monthStats } from '../streaks.js';
import { navigate, back } from '../router.js';
import { sfx } from '../sound.js';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const W = 1080, H = 1920, FONT = "'Nunito', system-ui, sans-serif";

async function loadSvg(url) {
  const t = await (await fetch(url)).text();
  const vb = /viewBox="([\d.\s-]+)"/.exec(t)[1].split(/\s+/).map(Number);
  const svg = t.replace('<svg', `<svg width="${vb[2]}" height="${vb[3]}"`);
  const img = new Image();
  img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  await img.decode();
  return { img, w: vb[2], h: vb[3] };
}

export async function drawRecap(cv, y, m) {
  const st = monthStats(y, m, store.get());
  await document.fonts.load(`900 100px Nunito`); await document.fonts.load(`800 40px Nunito`);
  const [mochi, mark] = await Promise.all([loadSvg('assets/mochi/mochi-cheering.svg'), loadSvg('assets/logo/mark.svg')]);
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#D9CCFF'); g.addColorStop(.55, '#FFC6E0'); g.addColorStop(1, '#FFE8A3');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const rr = (x, yy, w, h, r, fill) => { c.beginPath(); c.roundRect(x, yy, w, h, r); c.fillStyle = fill; c.fill(); };
  const tx = (s, x, yy, size, wt = 900, col = '#3B2F5C', al = 'left', ls = 0) => { c.font = `${wt} ${size}px ${FONT}`; c.fillStyle = col; c.textAlign = al; c.letterSpacing = `${ls}px`; c.fillText(s, x, yy); c.letterSpacing = '0px'; };

  c.drawImage(mark.img, 80, 90, 120, 120);
  tx('paw', 224, 178, 84, 900, '#5B4BC4', 'left', -3); const pw = c.measureText('paw').width - 9; tx('sage', 224 + pw, 178, 84, 900, '#3B2F5C', 'left', -3);
  tx('MONTHLY RECAP', 80, 330, 40, 900, '#6B5F8A', 'left', 5);
  tx('your', 80, 520, 190); tx(MONTHS[m], 80, 700, 190);
  const mh = 330, mw = mh * mochi.w / mochi.h; c.drawImage(mochi.img, W - mw - 60, 250, mw, mh);

  const tiles = [
    [st.finished.length.toLocaleString('en-US'), st.finished.length === 1 ? 'book finished' : 'books finished', '#FFFFFF'],
    [st.pages.toLocaleString('en-US'), 'pages read', '#FFE8A3'],
    [`${st.best} ${st.best === 1 ? 'day' : 'days'}`, 'best streak', '#C8F0E0'],
    [st.seconds >= 3600 ? `${Math.round(st.seconds / 360) / 10} h` : `${Math.round(st.seconds / 60)} min`, 'time with a book', '#D9CCFF'],
  ];
  tiles.forEach(([big, lab, col], i) => {
    const x = 80 + (i % 2) * 460, yy = 800 + Math.floor(i / 2) * 270;
    rr(x, yy, 440, 250, 60, col);
    tx(big, x + 44, yy + 140, 112); tx(lab, x + 44, yy + 206, 44, 800, '#3B2F5C');
  });

  if (st.finished.length) {
    tx('you finished', 80, 1430, 64);
    const show = st.finished.slice(0, 4);
    show.forEach((b, i) => {
      const x = 80 + i * 245, yy = 1480, w = 220, h = 300, gr = gradFor(b.book.title);
      const cg = c.createLinearGradient(x, yy, x + w, yy + h); cg.addColorStop(0, gr.a); cg.addColorStop(1, gr.b);
      rr(x, yy, w, h, 22, cg);
      c.save(); c.beginPath(); c.roundRect(x, yy, w, h, 22); c.clip(); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x, yy, 12, h); c.restore();
      const col = gr.dark ? '#FFFFFF' : '#3B2F5C';
      const words = b.book.title.split(' '); let line = '', ly = yy + 56; let n = 0;
      c.font = `900 34px ${FONT}`;
      for (const w2 of words) { const test = line ? line + ' ' + w2 : w2; if (c.measureText(test).width > w - 50 && line) { tx(line, x + 30, ly, 34, 900, col); ly += 40; line = w2; if (++n >= 3) break; } else line = test; }
      if (n < 3) tx(line, x + 30, ly, 34, 900, col);
    });
    if (st.finished.length > 4) tx(`+${st.finished.length - 4} more`, 80, 1830, 40, 800, '#6B5F8A');
  } else {
    tx('no finished books yet,', 80, 1500, 56, 900); tx('but every page counts.', 80, 1580, 56, 900, '#6B5F8A');
  }
  tx('read a little, every day', 80, 1880, 44, 800, '#3B2F5C');
}

export function recap({ month } = {}) {
  const now = new Date();
  let [y, m] = month && /^\d{4}-\d{2}$/.test(month) ? [+month.slice(0, 4), +month.slice(5) - 1] : [now.getFullYear(), now.getMonth()];
  const root = el(html`<header class="book-h"><button class="iconbtn" data-act="back" aria-label="Back">${ic.back}</button><span class="overline">MONTHLY RECAP</span><span class="iconbtn ghosted"></span></header>
<div class="row mpick"><button class="iconbtn sm" data-act="prev" aria-label="Previous month">${ic.back}</button><b class="heading" id="mlabel"></b><button class="iconbtn sm" data-act="next" aria-label="Next month">${ic.chevron}</button></div>
<canvas class="recap-cv" id="cv" role="img" aria-label="Your monthly reading recap card"></canvas>
<div class="dock static"><button class="btn primary grow" data-act="share" data-sfx="pop">${ic.share} share</button><button class="btn white grow" data-act="save">${ic.download} save</button></div>`);
  const cv = root.querySelector('#cv');
  const label = () => { root.querySelector('#mlabel').textContent = `${MONTHS[m]} ${y}`; root.querySelector('[data-act=next]').disabled = y === now.getFullYear() && m === now.getMonth(); };
  const paint = async () => { label(); cv.style.opacity = '.4'; await drawRecap(cv, y, m); cv.style.opacity = '1'; };
  paint();
  const blob = () => new Promise(r => cv.toBlob(r, 'image/png'));
  root.addEventListener('click', async e => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    const act = a.dataset.act;
    if (act === 'back') back('/stats');
    if (act === 'prev' || act === 'next') { m += act === 'prev' ? -1 : 1; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } paint(); }
    if (act === 'share' || act === 'save') {
      const b = await blob(); const file = new File([b], `pawsage-${y}-${String(m + 1).padStart(2, '0')}.png`, { type: 'image/png' });
      if (act === 'share' && navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: 'my pawsage recap' }); sfx.chime(); } catch { /* cancelled */ } return; }
      const url = URL.createObjectURL(b); const d = document.createElement('a'); d.href = url; d.download = file.name; d.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
      sfx.add(); toast(act === 'share' ? 'sharing is not available here, so mochi saved the image.' : 'saved! mochi approves.');
    }
  });
  return root;
}
