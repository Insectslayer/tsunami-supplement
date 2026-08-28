/*
 * app.js — wires the page together: the global control bar that every figure
 * listens to, the contents rail, and figure mounting.
 */
(function (global) {
  'use strict';

  const { state, PROFILE_NAMES, PROFILE_SLOT, LEVEL_MIN, LEVEL_MAX, LEVEL_STEP, model } =
    global.TsunamiModel;
  const { formatP } = global.FigureKit;

  const FIGURE_BUILDERS = Object.assign(
    {},
    global.Figures1D,
    global.Figures2D,
    global.Figures3D
  );

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /* ---------------------------------------------------------------- *
   * Global control bar
   * ---------------------------------------------------------------- */

  function buildControlBar() {
    const bar = document.getElementById('controlbar');
    const inner = element('div', 'controlbar-inner');

    // profile selector
    const profileGroup = element('div', 'control-group');
    profileGroup.appendChild(element('span', 'control-label', 'Profile'));
    const segmented = element('div', 'segmented');
    segmented.setAttribute('role', 'group');
    segmented.setAttribute('aria-label', 'Transformation profile');

    const buttons = new Map();
    PROFILE_NAMES.forEach((name) => {
      const button = element('button', null);
      button.type = 'button';
      const swatch = element('span', 'swatch');
      swatch.style.background = `var(--series-${PROFILE_SLOT[name] + 1})`;
      button.appendChild(swatch);
      button.appendChild(document.createTextNode(name));
      button.style.setProperty('--seg-color', `var(--series-${PROFILE_SLOT[name] + 1})`);
      button.setAttribute('aria-pressed', String(state.profile === name));
      button.addEventListener('click', () => {
        // Building a profile's uplift table for the first time takes a moment;
        // yield a frame so the pressed state paints before it blocks.
        setPressed(name);
        requestAnimationFrame(() => state.set({ profile: name }));
      });
      buttons.set(name, button);
      segmented.appendChild(button);
    });

    function setPressed(name) {
      buttons.forEach((button, key) => {
        button.setAttribute('aria-pressed', String(key === name));
      });
      // On narrow screens the control scrolls; keep the active profile in view.
      const active = buttons.get(name);
      if (active && segmented.scrollWidth > segmented.clientWidth) {
        active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }

    profileGroup.appendChild(segmented);
    inner.appendChild(profileGroup);

    // uplift slider
    const upliftGroup = element('div', 'control-group slider-wrap');
    const label = element('label', 'control-label', 'Uplift α′_w');
    label.htmlFor = 'global-uplift';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'global-uplift';
    slider.min = LEVEL_MIN;
    slider.max = LEVEL_MAX;
    slider.step = LEVEL_STEP;
    slider.value = state.alphaW;
    slider.setAttribute('aria-label', 'Transformed boundary angle');

    const readout = element('output', 'readout');
    readout.htmlFor = 'global-uplift';
    const pReadout = element('span', 'readout-p');

    const syncReadout = () => {
      readout.innerHTML = `${state.alphaW.toFixed(0)}<span class="unit">°</span>`;
      pReadout.textContent = `p = ${formatP(state.p)}`;
    };

    slider.addEventListener('input', () => {
      state.set({ alphaW: parseFloat(slider.value) });
      syncReadout();
    });

    upliftGroup.appendChild(label);
    upliftGroup.appendChild(slider);
    upliftGroup.appendChild(readout);
    inner.appendChild(upliftGroup);
    inner.appendChild(pReadout);

    // reset
    const actions = element('div', 'control-group');

    const reset = element('button', 'icon-button');
    reset.type = 'button';
    reset.title = 'Reset to the flat world';
    reset.setAttribute('aria-label', 'Reset to the flat world');
    reset.innerHTML =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>';
    reset.addEventListener('click', () => {
      state.set({ alphaW: LEVEL_MIN });
      slider.value = LEVEL_MIN;
      syncReadout();
    });
    actions.appendChild(reset);

    inner.appendChild(actions);
    bar.appendChild(inner);

    state.subscribe(() => {
      slider.value = state.alphaW;
      setPressed(state.profile);
      syncReadout();
    });
    syncReadout();
    requestAnimationFrame(() => setPressed(state.profile));
  }

  /* ---------------------------------------------------------------- *
   * Contents rail
   * ---------------------------------------------------------------- */

  // `root` scopes the rail to one section of the document. Standalone that is
  // the whole document; in the single-file bundle each view carries its own
  // rail and its own .paper, so both are looked up inside the view.
  function buildContents(root) {
    const rail = root.querySelector('.toc');
    if (!rail) return;
    // Every heading convert.js emits, whatever depth the source gives it; the
    // rail indents by that depth rather than by the HTML tag, so bumping the
    // headings a level in paper/main.md does not drop a tier from the rail.
    const headings = root.querySelectorAll('.paper [class*="heading-l"]');
    if (!headings.length) return;

    const links = [];
    headings.forEach((heading) => {
      if (!heading.id) return;
      const depth = Number(heading.className.match(/heading-l(\d+)/)[1]);
      const link = element('a', `level-${Math.min(depth, 3)}`);
      link.href = `#${heading.id}`;
      // The number comes from the heading: convert.js numbers the sections by
      // their order in paper/main.md, which is what the prose cites.
      if (heading.dataset.number) {
        link.appendChild(element('span', 'toc-number', heading.dataset.number));
      }
      const title = heading.querySelector('.heading-text');
      link.appendChild(document.createTextNode(title ? title.textContent : heading.textContent));
      rail.appendChild(link);
      links.push({ link, heading });
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach(({ link, heading }) => {
            link.setAttribute('aria-current', String(heading === entry.target));
          });
        });
      },
      { rootMargin: '-15% 0px -70% 0px' }
    );
    links.forEach(({ heading }) => observer.observe(heading));
  }

  /* ---------------------------------------------------------------- *
   * Figures
   * ---------------------------------------------------------------- */

  function mountFigures() {
    const slots = document.querySelectorAll('.fig-slot[data-figure]');
    slots.forEach((slot) => {
      const name = slot.dataset.figure;
      const builder = FIGURE_BUILDERS[name];
      if (!builder) {
        console.warn(`No builder registered for figure slot "${name}"`);
        slot.remove();
        return;
      }
      try {
        builder(slot);
      } catch (error) {
        console.error(`Failed to build figure "${name}"`, error);
        slot.innerHTML = `<p class="fig-note">This figure could not be built: ${error.message}</p>`;
      }
    });
  }

  /* ---------------------------------------------------------------- *
   * Boot
   * ---------------------------------------------------------------- */

  function boot() {
    buildControlBar();
    mountFigures();
    // The bundle wraps the appendix in a view element; standalone there is none
    // and the whole document is the scope.
    buildContents(document.querySelector('[data-view="appendix"]') || document);

    // Warm the remaining uplift tables while the page is idle, so switching
    // profiles later does not stall on the first bisection sweep.
    const warm = (index) => {
      if (index >= PROFILE_NAMES.length) return;
      const name = PROFILE_NAMES[index];
      if (name !== state.profile) model(name).levels;
      const next = () => warm(index + 1);
      if (global.requestIdleCallback) global.requestIdleCallback(next, { timeout: 2000 });
      else setTimeout(next, 120);
    };
    if (global.requestIdleCallback) global.requestIdleCallback(() => warm(0), { timeout: 3000 });
    else setTimeout(() => warm(0), 600);

    document.body.dataset.ready = 'true';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
