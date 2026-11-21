// Safe templating. Everything interpolated is escaped unless it came from html`` or raw().
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

class Safe {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

export const raw = s => new Safe(String(s));

const part = v => {
  if (v instanceof Safe) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  if (v === null || v === undefined || v === false) return '';
  return esc(v);
};

export function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += part(v) + strings[i + 1]; });
  return new Safe(out);
}

export const escape = esc;

/** Build a DOM element from html`` output. */
export function el(safe, cls = '', tag = 'div') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  e.innerHTML = String(safe);
  return e;
}
