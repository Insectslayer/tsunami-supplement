/*
 * figure-kit.js — the shell every interactive figure is built in.
 *
 * Handles the parts that are the same everywhere: figure chrome, the control
 * row, canvas panels sized to the container, the shared tooltip, a table-view
 * twin, and redraw scheduling. Figures that are off screen are marked dirty
 * instead of redrawn, so dragging the global slider only costs the panels the
 * reader can actually see.
 */
(function (global) {
  'use strict';

  const { Plot, attachHover, showTooltip, hideTooltip } = global.Viz;
  const { state, PARAMS } = global.TsunamiModel;

  let figureCounter = 0;
  const registry = [];

  const visibility = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const figure = entry.target._figure;
        if (!figure) continue;
        figure.visible = entry.isIntersecting;
        if (entry.isIntersecting && figure.dirty) figure.redraw();
      }
    },
    { rootMargin: '240px 0px' }
  );

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /* ---------------------------------------------------------------- *
   * Controls
   * ---------------------------------------------------------------- */

  function buildControl(spec, figure) {
    const wrap = element('div', `fig-control${spec.compact ? ' compact' : ''}`);

    if (spec.type === 'checkbox') {
      const label = element('label', 'checkbox');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = Boolean(figure.local[spec.id]);
      input.addEventListener('change', () => {
        figure.local[spec.id] = input.checked;
        figure.redraw();
      });
      label.appendChild(input);
      label.appendChild(document.createTextNode(spec.label));
      wrap.appendChild(label);
      wrap.classList.add('compact');
      return wrap;
    }

    if (spec.type === 'segmented') {
      const label = element('label', null, spec.label);
      const group = element('div', 'segmented');
      group.setAttribute('role', 'group');
      spec.options.forEach((option) => {
        const button = element('button', null, option.label);
        button.type = 'button';
        button.setAttribute(
          'aria-pressed',
          String(figure.local[spec.id] === option.value)
        );
        button.addEventListener('click', () => {
          figure.local[spec.id] = option.value;
          group.querySelectorAll('button').forEach((other, index) => {
            other.setAttribute(
              'aria-pressed',
              String(spec.options[index].value === option.value)
            );
          });
          figure.redraw();
        });
        group.appendChild(button);
      });
      if (spec.label) wrap.appendChild(label);
      wrap.appendChild(group);
      wrap.classList.add('compact');
      return wrap;
    }

    // range
    const id = `ctl-${figure.id}-${spec.id}`;
    const label = element('label', null, spec.label);
    label.htmlFor = id;
    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.min = spec.min;
    input.max = spec.max;
    input.step = spec.step != null ? spec.step : 1;
    input.value = figure.local[spec.id];
    const readout = element('output', 'readout');
    readout.htmlFor = id;

    const format = spec.format || ((value) => String(value));
    const sync = () => {
      readout.textContent = format(figure.local[spec.id]);
    };
    input.addEventListener('input', () => {
      figure.local[spec.id] = parseFloat(input.value);
      sync();
      figure.redraw();
    });
    figure.syncControls.push(() => {
      input.value = figure.local[spec.id];
      sync();
    });
    sync();

    wrap.appendChild(label);
    wrap.appendChild(input);
    wrap.appendChild(readout);
    return wrap;
  }

  /* ---------------------------------------------------------------- *
   * Figure
   * ---------------------------------------------------------------- */

  /**
   * @param {HTMLElement} slot          the <figure> placeholder in the text
   * @param {object} spec
   *   title      short heading
   *   note       one-paragraph explanation of what is being shown
   *   controls   array of control specs (range / checkbox / segmented)
   *   local      initial values for the figure's own controls
   *   columns    panel grid columns (1-4) or a per-row layout array
   *   panels     array of panel specs { key, title, aspect, equalAspect,
   *              xDomain, yDomain, margin, colour, draw(plot, context),
   *              hover(event, context) }
   *   legend     array of { label, color, kind }
   *   caption    text under the figure, prefixed with the figure number
   *   table      function returning { columns, rows } for the table view
   *   global     true when the figure follows the global profile/uplift state
   */
  function createFigure(slot, spec) {
    figureCounter += 1;
    const figure = {
      id: figureCounter,
      slot,
      spec,
      local: Object.assign({}, spec.local || {}),
      plots: new Map(),
      syncControls: [],
      visible: false,
      dirty: true,
      built: false,
    };

    slot._figure = figure;
    slot.innerHTML = '';

    // The number comes from the slot: convert.js numbers the figures by the
    // order of their anchors in paper/main.md, which is what the prose cites.
    const label = slot.dataset.number ? `Figure ${slot.dataset.number}` : null;

    const head = element('div', 'fig-head');
    if (label) head.appendChild(element('span', 'fig-number', label));
    head.appendChild(element('h3', 'fig-title', spec.title));
    slot.appendChild(head);

    if (spec.note) slot.appendChild(element('p', 'fig-note', spec.note));

    if (spec.controls && spec.controls.length) {
      const controls = element('div', 'fig-controls');
      spec.controls.forEach((control) => {
        controls.appendChild(buildControl(control, figure));
      });
      slot.appendChild(controls);
    }

    const rows = Array.isArray(spec.rows) ? spec.rows : [{ columns: spec.columns || 1, panels: spec.panels }];
    rows.forEach((row) => {
      const grid = element('div', `panel-grid cols-${row.columns || 1}`);
      row.panels.forEach((panelSpec) => {
        const panel = element('div', 'panel');
        if (panelSpec.title) {
          const title = element('p', 'panel-title');
          if (panelSpec.color) {
            const dot = element('span', 'dot');
            dot.style.background = panelSpec.color;
            title.appendChild(dot);
          }
          title.appendChild(document.createTextNode(panelSpec.title));
          panel.appendChild(title);
        }
        const canvas = document.createElement('canvas');
        canvas.setAttribute('role', 'img');
        canvas.setAttribute(
          'aria-label',
          panelSpec.ariaLabel || `${spec.title} — ${panelSpec.title || 'panel'}`
        );
        panel.appendChild(canvas);
        grid.appendChild(panel);

        const plot = new Plot(canvas, {
          aspect: panelSpec.aspect,
          equalAspect: panelSpec.equalAspect,
          xDomain: panelSpec.xDomain,
          yDomain: panelSpec.yDomain,
          margin: panelSpec.margin,
        });
        figure.plots.set(panelSpec.key, { plot, spec: panelSpec, panel });

        if (panelSpec.hover) {
          attachHover(plot, (point, event) => {
            if (!point || !point.inside) {
              hideTooltip();
              if (figure.hoverState && figure.hoverState[panelSpec.key]) {
                figure.hoverState[panelSpec.key] = null;
                figure.redraw();
              }
              return;
            }
            const html = panelSpec.hover(point, figure.context(), plot);
            if (html) showTooltip(event, html);
            else hideTooltip();
          });
        }
      });
      slot.appendChild(grid);
    });

    if (spec.legend && spec.legend.length) {
      const legend = element('div', 'fig-legend');
      const dynamic = [];
      spec.legend.forEach((item) => {
        const node = element('span', 'item');
        const key = element('span', `key${item.kind ? ` ${item.kind}` : ''}`);
        const apply = (color) => {
          key.style.setProperty('--key-color', color);
          if (item.kind !== 'dashed') key.style.background = color;
        };
        apply(typeof item.color === 'function' ? item.color(state) : item.color);
        if (typeof item.color === 'function') dynamic.push({ item, apply });
        node.appendChild(key);
        node.appendChild(document.createTextNode(item.label));
        legend.appendChild(node);
      });
      slot.appendChild(legend);
      figure.legendNode = legend;
      figure.refreshLegend = () => {
        dynamic.forEach(({ item, apply }) => apply(item.color(state)));
      };
    }

    if (spec.table) {
      const details = element('details', 'table-view');
      const summary = element('summary', null, 'Data table');
      details.appendChild(summary);
      const scroll = element('div', 'table-scroll');
      details.appendChild(scroll);
      slot.appendChild(details);
      figure.tableNode = scroll;
      figure.tableDetails = details;
      details.addEventListener('toggle', () => {
        if (details.open) figure.renderTable();
      });
    }

    if (spec.caption) {
      const caption = label ? `${label}: ${spec.caption}` : spec.caption;
      slot.appendChild(element('p', 'fig-caption', caption));
    }

    figure.context = () => ({
      state,
      local: figure.local,
      params: PARAMS,
      figure,
    });

    figure.renderTable = () => {
      if (!figure.tableNode || !figure.tableDetails.open) return;
      const data = spec.table(figure.context());
      if (!data) return;
      const table = element('table', 'data-table');
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      data.columns.forEach((column) => {
        headRow.appendChild(element('th', null, column));
      });
      thead.appendChild(headRow);
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      data.rows.forEach((row) => {
        const tr = document.createElement('tr');
        row.forEach((cell) => tr.appendChild(element('td', null, cell)));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      figure.tableNode.innerHTML = '';
      figure.tableNode.appendChild(table);
    };

    figure.draw = () => {
      const context = figure.context();
      if (spec.beforeDraw) spec.beforeDraw(context);
      figure.plots.forEach(({ plot, spec: panelSpec }) => {
        plot.resize().clear();
        try {
          panelSpec.draw(plot, context);
        } catch (error) {
          console.error(`Figure "${spec.title}" panel "${panelSpec.key}" failed`, error);
          plot.labelPx(plot.width / 2, plot.height / 2, 'render error', {
            align: 'center',
            color: plot.theme.critical,
          });
        }
      });
      if (spec.afterDraw) spec.afterDraw(context);
      if (figure.refreshLegend) figure.refreshLegend();
      figure.renderTable();
    };

    let scheduled = false;
    figure.redraw = () => {
      if (!figure.visible) {
        figure.dirty = true;
        return;
      }
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        figure.dirty = false;
        figure.draw();
      });
    };

    figure.syncFromState = () => {
      if (spec.onStateChange) spec.onStateChange(figure.context());
      figure.syncControls.forEach((sync) => sync());
      figure.redraw();
    };

    visibility.observe(slot);
    registry.push(figure);

    const resizeObserver = new ResizeObserver(() => figure.redraw());
    resizeObserver.observe(slot);

    if (spec.global !== false) state.subscribe(() => figure.syncFromState());

    return figure;
  }

  /* ---------------------------------------------------------------- *
   * Shared drawing helpers
   * ---------------------------------------------------------------- */

  const CHESS_DARK = '#2f2f2d';
  const CHESS_LIGHT = '#e8e7e1';

  /** Colour of the ground tile containing an original ground distance. */
  function tileColor(distance, params, theme) {
    if (!isFinite(distance)) return theme.skyColor;
    if (distance < 0 || distance > params.worldRadius) return theme.outsideColor;
    const index = Math.floor(distance / params.tileSize);
    return index % 2 === 0 ? CHESS_DARK : CHESS_LIGHT;
  }

  /**
   * Renders the camera image for a distance field, following the construction
   * in render_grid.py: the ground point seen by each pixel is chessboard-tiled,
   * pixels past the world radius take the outside colour, and pixels that see
   * no ground take the sky colour.
   */
  function renderCameraImage(camera, distances, params, colors) {
    const { rx, ry, width, height } = camera.groundCoordinates(distances);
    const image = new ImageData(width, height);
    const data = image.data;
    const tile = params.tileSize;

    const sky = colors.sky;
    const outside = colors.outside;
    const boundary = colors.boundary;
    const dark = colors.dark;
    const light = colors.light;
    const edge = colors.edge;

    const tileIndex = new Int32Array(width * height);

    for (let i = 0; i < width * height; i += 1) {
      const offset = i * 4;
      const d = distances[i];

      if (!isFinite(d) || !isFinite(rx[i])) {
        data[offset] = sky[0];
        data[offset + 1] = sky[1];
        data[offset + 2] = sky[2];
        data[offset + 3] = 255;
        tileIndex[i] = -1;
        continue;
      }

      const ti = Math.round(rx[i] / tile);
      const tj = Math.round(ry[i] / tile);
      tileIndex[i] = ti * 100003 + tj;

      let color;
      if (d > params.worldRadius) color = outside;
      else color = (((ti % 2) + (tj % 2) + 2) % 2) === 0 ? dark : light;

      data[offset] = color[0];
      data[offset + 1] = color[1];
      data[offset + 2] = color[2];
      data[offset + 3] = 255;
    }

    // Tile edges: a pixel whose neighbour belongs to another tile is inked, so
    // the grid stays legible where tiles compress to less than a pixel.
    for (let row = 0; row < height; row += 1) {
      for (let col = 1; col < width; col += 1) {
        const i = row * width + col;
        if (tileIndex[i] === -1 || tileIndex[i - 1] === -1) continue;
        if (tileIndex[i] !== tileIndex[i - 1]) {
          const offset = i * 4;
          data[offset] = edge[0];
          data[offset + 1] = edge[1];
          data[offset + 2] = edge[2];
        }
      }
    }
    for (let row = 1; row < height; row += 1) {
      for (let col = 0; col < width; col += 1) {
        const i = row * width + col;
        const above = i - width;
        if (tileIndex[i] === -1 || tileIndex[above] === -1) continue;
        if (tileIndex[i] !== tileIndex[above]) {
          const offset = i * 4;
          data[offset] = edge[0];
          data[offset + 1] = edge[1];
          data[offset + 2] = edge[2];
        }
      }
    }

    // World boundary: the last row inside the world along each column.
    for (let col = 0; col < width; col += 1) {
      for (let row = 1; row < height; row += 1) {
        const i = row * width + col;
        const above = i - width;
        const inside = isFinite(distances[i]) && distances[i] <= params.worldRadius;
        const outsideAbove =
          !isFinite(distances[above]) || distances[above] > params.worldRadius;
        if (inside && outsideAbove) {
          for (let k = -1; k <= 1; k += 1) {
            const target = i + k * width;
            if (target < 0 || target >= width * height) continue;
            const offset = target * 4;
            data[offset] = boundary[0];
            data[offset + 1] = boundary[1];
            data[offset + 2] = boundary[2];
          }
        }
      }
    }

    return image;
  }

  function rgb(color) {
    const [r, g, b] = global.Viz.parseColor(color);
    return [Math.round(r), Math.round(g), Math.round(b)];
  }

  /** Colour set for the camera renderer, resolved against the current theme. */
  function cameraColors(theme, accentColor) {
    return {
      sky: rgb(global.Viz.mixColors(theme.surface, '#1c3f6e', 0.82)),
      outside: rgb(global.Viz.mixColors(theme.surface, '#20583f', 0.72)),
      boundary: rgb(accentColor),
      dark: rgb(CHESS_DARK),
      light: rgb(CHESS_LIGHT),
      edge: rgb(global.Viz.mixColors(CHESS_DARK, CHESS_LIGHT, 0.35)),
    };
  }

  /** Draws the world disc with its chessboard tiling, for top views. */
  function drawTopViewGround(plot, params, options = {}) {
    const ctx = plot.ctx;
    const theme = plot.theme;
    const radius = params.worldRadius;
    const tile = params.tileSize;

    ctx.save();
    ctx.beginPath();
    ctx.arc(plot.px(0), plot.py(0), Math.abs(plot.px(radius) - plot.px(0)), 0, Math.PI * 2);
    ctx.clip();

    const tilesAcross = Math.ceil(radius / tile) + 1;
    for (let i = -tilesAcross; i <= tilesAcross; i += 1) {
      for (let j = -tilesAcross; j <= tilesAcross; j += 1) {
        if ((((i % 2) + (j % 2) + 2) % 2) !== 0) continue;
        const x0 = plot.px((i - 0.5) * tile);
        const x1 = plot.px((i + 0.5) * tile);
        const y0 = plot.py((j + 0.5) * tile);
        const y1 = plot.py((j - 0.5) * tile);
        ctx.fillStyle = global.Viz.withAlpha(theme.muted, options.alpha || 0.18);
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = global.Viz.withAlpha(theme.text, 0.35);
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.arc(plot.px(0), plot.py(0), Math.abs(plot.px(radius) - plot.px(0)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** Alternating ground segments for side views. */
  function drawGroundTiles(plot, params, options = {}) {
    const from = options.from != null ? options.from : 0;
    const to = options.to != null ? options.to : params.worldRadius;
    const y = options.y != null ? options.y : 0;
    const tile = params.tileSize;
    const ctx = plot.ctx;

    ctx.save();
    ctx.lineWidth = options.width || 3;
    ctx.lineCap = 'butt';
    let index = Math.floor(from / tile);
    let cursor = index * tile;
    while (cursor < to) {
      const next = Math.min(to, cursor + tile);
      if (next > from) {
        ctx.strokeStyle = index % 2 === 0 ? CHESS_DARK : CHESS_LIGHT;
        ctx.beginPath();
        ctx.moveTo(plot.px(Math.max(from, cursor)), plot.py(y));
        ctx.lineTo(plot.px(next), plot.py(y));
        ctx.stroke();
      }
      cursor = next;
      index += 1;
    }
    ctx.restore();
  }

  /** The observer, drawn as a star at (0, h). */
  function drawObserver(plot, h, options = {}) {
    plot.marker(0, h, {
      shape: 'star',
      radius: options.radius || 4,
      color: options.color || plot.theme.critical,
      ringColor: plot.theme.surface,
    });
    if (options.label !== false) {
      plot.label(0, h, options.label || 'Q', {
        dx: 8,
        dy: -9,
        color: options.color || plot.theme.critical,
      });
    }
  }

  /** Angle arc annotation with a label, in pixel space. */
  function drawAngleArc(plot, cx, cy, radiusPx, fromAngle, toAngle, label, options = {}) {
    const ctx = plot.ctx;
    const px = plot.px(cx);
    const py = plot.py(cy);
    ctx.save();
    ctx.strokeStyle = options.color || plot.theme.muted;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.arc(px, py, radiusPx, -fromAngle, -toAngle, true);
    ctx.stroke();
    ctx.restore();
    if (label) {
      const mid = (fromAngle + toAngle) / 2;
      plot.labelPx(
        px + Math.cos(mid) * (radiusPx + 12),
        py - Math.sin(mid) * (radiusPx + 12),
        label,
        { align: 'center', color: options.labelColor || options.color || plot.theme.secondary }
      );
    }
  }

  function formatDegrees(value) {
    return `${value.toFixed(0)}°`;
  }

  function formatMeters(value) {
    return `${value.toFixed(0)} m`;
  }

  function formatP(value) {
    if (value === 0) return '0';
    if (Math.abs(value) >= 1000) return value.toExponential(3);
    if (Math.abs(value) < 0.001) return value.toExponential(3);
    return value.toPrecision(4);
  }

  global.FigureKit = {
    createFigure,
    registry,
    renderCameraImage,
    cameraColors,
    drawTopViewGround,
    drawGroundTiles,
    drawObserver,
    drawAngleArc,
    tileColor,
    formatDegrees,
    formatMeters,
    formatP,
    rgb,
    CHESS_DARK,
    CHESS_LIGHT,
    element,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
