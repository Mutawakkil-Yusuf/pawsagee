// Opening index.html straight from a folder (file://) can't work: browsers block ES modules there.
if (location.protocol === 'file:') {
  const b = document.getElementById('boot');
  if (b) {
    b.style.animation = 'none';
    b.innerHTML = '<div style="max-width:320px;padding:24px;text-align:center;font:700 16px/1.5 system-ui;color:#3B2F5C"><b style="font-size:22px">pawsage needs a web server</b><p>Browsers block apps opened straight from a folder. Run <code>npm run dev</code> in this folder, or deploy it to Netlify, then open the link.</p></div>';
  }
}
