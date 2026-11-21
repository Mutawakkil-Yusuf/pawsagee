import { describe, it, expect } from 'vitest';
import { html, raw, escape, el, Safe } from '../js/html';

describe('html escaping', () => {
  it('escapes all five dangerous characters', () => {
    expect(escape(`<a href="x">‘&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;‘&amp;&#39;&lt;/a&gt;');
  });

  it('escapes interpolated strings but not html`` or raw() content', () => {
    const evil = '<img src=x onerror=alert(1)>';
    expect(String(html`<p>${evil}</p>`)).toBe('<p>&lt;img src=x onerror=alert(1)&gt;</p>');
    expect(String(html`<p>${raw('<b>safe</b>')}</p>`)).toBe('<p><b>safe</b></p>');
    expect(String(html`<p>${html`<b>${evil}</b>`}</p>`)).toBe('<p><b>&lt;img src=x onerror=alert(1)&gt;</b></p>');
  });

  it('handles arrays, null, undefined and false', () => {
    expect(String(html`${['a', raw('<i>b</i>'), null, undefined, false]}`)).toBe('a<i>b</i>');
  });

  it('returns a Safe instance', () => {
    expect(html`x`).toBeInstanceOf(Safe);
  });

  it('builds DOM elements safely via el()', () => {
    const node = el(html`<b>${'<script>bad</script>'}</b>`, 'demo');
    expect(node.className).toBe('demo');
    expect(node.querySelector('b')!.textContent).toBe('<script>bad</script>');
    expect(node.querySelector('script')).toBeNull();
  });
});
