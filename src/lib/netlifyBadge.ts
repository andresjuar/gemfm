// Netlify shows a "Powered by Netlify" badge in the bottom-right corner of
// Free-plan sites, in a fixed iframe above everything. While it's on screen we
// set --badge-space so the bottom tab bar grows underneath it instead of
// having its "Friends" button covered. (Turn the badge off in Netlify:
// Project configuration › General › Powered by Netlify badge.)
export function watchNetlifyBadge() {
  const root = document.documentElement;
  const update = () => {
    const frame = document.getElementById('nl-badge-frame');
    const r = frame?.getBoundingClientRect();
    const visible = !!frame && !!r && r.height > 0 && r.width > 0 && getComputedStyle(frame).display !== 'none'
      && r.bottom >= window.innerHeight - 4;
    root.style.setProperty('--badge-space', visible ? `${Math.ceil(r!.height) + 4}px` : '0px');
  };
  new MutationObserver(update).observe(document.body, { childList: true, subtree: false, attributes: true, attributeFilter: ['style', 'class'] });
  window.addEventListener('resize', update);
  update();
  // The badge's own "Hide" button changes its iframe without touching <body>.
  window.setInterval(update, 2000);
}
