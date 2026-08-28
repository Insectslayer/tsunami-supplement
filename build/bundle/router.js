/* ------------------------------------------------------------------ *
 * Bundle-only runtime.
 *
 * Three pages share one document here, so this swaps between them, resolves
 * deep links into whichever view owns the target, serves the embedded files
 * as blob downloads (a file:// page cannot fetch a sibling) and opens figures
 * in a lightbox (a data: URI cannot be navigated to in a new tab).
 * ------------------------------------------------------------------ */
(function () {
  'use strict';

  const views = [...document.querySelectorAll('.view[data-view]')];
  const navLinks = [...document.querySelectorAll('.site-nav a[data-view-link]')];
  if (!views.length) return;

  const names = views.map((view) => view.dataset.view);

  function show(name, { scroll = true } = {}) {
    const target = names.includes(name) ? name : names[0];
    views.forEach((view) => {
      view.hidden = view.dataset.view !== target;
    });
    navLinks.forEach((link) => {
      const current = link.dataset.viewLink === target;
      if (current) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.title = `${views.find((v) => v.dataset.view === target).dataset.title} — Tsunami Supplement`;
    if (scroll) window.scrollTo(0, 0);
    return target;
  }

  /** The view containing an element, if any. */
  function ownerView(element) {
    const view = element && element.closest('.view[data-view]');
    return view ? view.dataset.view : null;
  }

  /**
   * A hash is either a view name or an element id. An id inside a hidden view
   * has to bring its view forward before the browser can scroll to it.
   */
  function route(hash, { scroll = true } = {}) {
    const id = (hash || '').replace(/^#/, '');
    if (!id) return show(names[0], { scroll });
    if (names.includes(id)) return show(id, { scroll });

    const target = document.getElementById(id);
    if (!target) return null;
    const owner = ownerView(target);
    if (owner) show(owner, { scroll: false });
    // The view was display:none a moment ago and had no layout box, so the
    // scroll has to wait for the browser to lay it out.
    requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
    return owner;
  }

  navLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const name = link.dataset.viewLink;
      show(name);
      history.replaceState(null, '', `#${name}`);
    });
  });

  // Same-document anchors: the contents rails and any cross-references.
  document.addEventListener('click', (event) => {
    const anchor = event.target.closest('a[href^="#"]');
    if (!anchor || anchor.dataset.viewLink) return;
    const id = anchor.getAttribute('href').slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    route(id);
    history.replaceState(null, '', `#${id}`);
  });

  window.addEventListener('hashchange', () => route(location.hash));

  /* ---------------------------------------------------------------- *
   * Embedded downloads
   * ---------------------------------------------------------------- */

  function bytesFromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  /**
   * Points a download link at a blob of its embedded copy.
   *
   * The href is rewritten rather than the click being intercepted, so that
   * "Save link as" from the context menu gets the file too. Building all the
   * blobs up front would duplicate every embedded byte in memory, so each one
   * is made on first interaction: pointerdown and contextmenu both fire before
   * the browser acts on the link.
   */
  function materialize(anchor) {
    if (anchor.dataset.blob === 'true') return;
    const entry = (window.SUPPLEMENT_FILES || {})[anchor.dataset.download];
    if (!entry) return; // no embedded copy: the relative href stands
    const payload = entry.base64 ? bytesFromBase64(entry.base64) : entry.text;
    anchor.href = URL.createObjectURL(new Blob([payload], { type: entry.type }));
    anchor.download = entry.name;
    anchor.dataset.blob = 'true';
  }

  document.querySelectorAll('[data-download]').forEach((anchor) => {
    ['pointerdown', 'contextmenu', 'focus'].forEach((event) =>
      anchor.addEventListener(event, () => materialize(anchor))
    );
    // Keyboard activation reaches click without a pointerdown.
    anchor.addEventListener('click', (event) => {
      if (anchor.dataset.blob === 'true') return;
      const entry = (window.SUPPLEMENT_FILES || {})[anchor.dataset.download];
      if (!entry) return;
      event.preventDefault();
      materialize(anchor);
      anchor.click();
    });
  });

  /* ---------------------------------------------------------------- *
   * Figure lightbox
   * ---------------------------------------------------------------- */

  let lightbox = null;

  function openLightbox(source, alt) {
    if (!lightbox) {
      lightbox = document.createElement('dialog');
      lightbox.className = 'lightbox';
      lightbox.innerHTML =
        '<img alt=""><p class="lightbox-hint">Click anywhere or press Escape to close</p>';
      lightbox.addEventListener('click', () => lightbox.close());
      document.body.appendChild(lightbox);
    }
    const image = lightbox.querySelector('img');
    image.src = source;
    image.alt = alt || '';
    lightbox.showModal();
  }

  document.querySelectorAll('.result-figure img').forEach((image) => {
    image.addEventListener('click', () => openLightbox(image.src, image.alt));
  });

  route(location.hash, { scroll: false });
})();
