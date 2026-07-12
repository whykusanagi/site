/**
 * Shared site chrome (navbar + footer) — single source of truth.
 *
 * Each page carries empty mounts: `<nav class="navbar" data-site-nav></nav>` and
 * `<footer data-site-footer></footer>`. This script fills the nav with the
 * canonical links (marking the current page active, wiring the mobile hamburger)
 * and the footer with the copyright + legal links (year computed at runtime).
 * Root-relative hrefs so it works from any depth (root pages and /blog/ posts).
 * Edit the LINKS array (nav) or the footer block below to change them everywhere.
 *
 * Theme (corrupted-theme) provides the navbar and footer styling; this builds markup.
 */
(function () {
  const LINKS = [
    { href: '/celeste.html',     icon: 'fa-robot',   label: 'Celeste AI' },
    { href: '/music.html',       icon: 'fa-music',   label: 'Music' },
    { href: '/blog/index.html',  icon: 'fa-blog',    label: 'Blog' },
    { href: '/references.html',  icon: 'fa-palette', label: 'References' },
    { href: '/doujin.html',      icon: 'fa-book',    label: 'Doujin' },
    { href: '/links.html',       icon: 'fa-link',    label: 'Links' },
    { href: '/tools.html',       icon: 'fa-tools',   label: 'Tools' },
  ];

  const path = location.pathname;
  const slug = (s) => s.replace(/^\//, '').replace(/\/$/, '').replace(/\.html$/, '');
  const isActive = (href) => {
    if (href === '/blog/index.html') return /^\/blog(\/|$)/.test(path);
    return slug(path) === slug(href);
  };

  const linksHtml = LINKS.map((l) =>
    `<a href="${l.href}"${isActive(l.href) ? ' class="active"' : ''}><i class="fas ${l.icon}"></i> ${l.label}</a>`
  ).join('');

  const nav = document.createElement('nav');
  nav.className = 'navbar';
  nav.innerHTML =
    '<div class="navbar-content">' +
      '<a href="/" class="navbar-logo"><i class="fas fa-home"></i> whykusanagi</a>' +
      '<button class="navbar-toggle" aria-label="Toggle menu" aria-expanded="false">' +
        '<span class="icon"><span></span><span></span><span></span></span>' +
      '</button>' +
      '<div class="navbar-links">' + linksHtml + '</div>' +
    '</div>';

  // Replace the page's placeholder nav; fall back to prepending to <body>.
  const mount = document.querySelector('[data-site-nav]') || document.querySelector('nav.navbar');
  if (mount) mount.replaceWith(nav);
  else document.body.insertAdjacentElement('afterbegin', nav);

  // Mobile hamburger (same behavior the site used before, now owned here).
  const toggle = nav.querySelector('.navbar-toggle');
  const links = nav.querySelector('.navbar-links');
  const setOpen = (open) => {
    links.classList.toggle('active', open);
    toggle.classList.toggle('active', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(!links.classList.contains('active')));
  links.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });

  // === Shared footer ===
  // Pages carry an empty `<footer data-site-footer></footer>` mount. Year is
  // computed at runtime so it never goes stale.
  const footerMount = document.querySelector('[data-site-footer]');
  if (footerMount) {
    const footer = document.createElement('footer');
    footer.innerHTML =
      '<p>&copy; ' + new Date().getFullYear() + ' whykusanagi. All rights reserved. ' +
        '<strong class="footer-badge">18+ Only</strong></p>' +
      '<p class="footer-links">' +
        '<a href="/">Home</a> · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a> · ' +
        '<a href="/dmca.html">DMCA</a> · <a href="/refunds.html">Refunds</a> · <a href="/shipping.html">Shipping</a>' +
      '</p>';
    footerMount.replaceWith(footer);
  }

  // Deploy safety net: a previously-cached site-bootstrap.js injected its own
  // hamburger, which duplicates the toggle during the cache window. Once
  // everything has run, keep only the first (ours). No-ops once the old script
  // stops being served.
  window.addEventListener('load', () => {
    document.querySelectorAll('.navbar-content .navbar-toggle').forEach((t, i) => { if (i) t.remove(); });
  });
})();
