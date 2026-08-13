/*
 * plot.js — a small canvas drawing toolkit for the figures on this page.
 *
 * Chart chrome follows the project's palette: hairline solid gridlines one
 * shade off the surface, 2px data strokes, recessive axis ink, and colours
 * read from CSS custom properties so light and dark mode both work without a
 * second set of values here.
 */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;

  /** Resolves a CSS custom property against an element, with a fallback. */
  function cssVar(element, name, fallback) {
    const value = getComputedStyle(element).getPropertyValue(name).trim();
    return value || fallback;
  }

  class Theme {
    constructor(host) {
      this.host = host;
      this.refresh();
    }

    refresh() {
      const host = this.host;
      this.surface = cssVar(host, '--surface-1', '#fcfcfb');
      this.plane = cssVar(host, '--page-plane', '#f9f9f7');
      this.text = cssVar(host, '--text-primary', '#0b0b0b');
      this.secondary = cssVar(host, '--text-secondary', '#52514e');
      this.muted = cssVar(host, '--text-muted', '#898781');
      this.grid = cssVar(host, '--grid', '#e1e0d9');
      this.axis = cssVar(host, '--axis', '#c3c2b7');
      this.accent = cssVar(host, '--accent', '#2a78d6');
      this.series = [
        cssVar(host, '--series-1', '#2a78d6'),
        cssVar(host, '--series-2', '#eb6834'),
        cssVar(host, '--series-3', '#1baf7a'),
        cssVar(host, '--series-4', '#eda100'),
      ];
      this.sequential = [
        cssVar(host, '--seq-100', '#cde2fb'),
        cssVar(host, '--seq-200', '#9ec5f4'),
        cssVar(host, '--seq-300', '#6da7ec'),
        cssVar(host, '--seq-400', '#3987e5'),
        cssVar(host, '--seq-500', '#256abf'),
        cssVar(host, '--seq-600', '#184f95'),
        cssVar(host, '--seq-700', '#0d366b'),
      ];
      this.good = cssVar(host, '--status-good', '#0ca30c');
      this.critical = cssVar(host, '--status-critical', '#d03b3b');
      return this;
    }

    /** Samples the single-hue ramp; fraction 0 = lightest step. */
    ramp(fraction) {
      const steps = this.sequential;
      const clamped = Math.min(1, Math.max(0, fraction));
      const position = clamped * (steps.length - 1);
      const index = Math.min(steps.length - 2, Math.floor(position));
      return mixColors(steps[index], steps[index + 1], position - index);
    }
  }

  function parseColor(value) {
    if (value.startsWith('#')) {
      let hex = value.slice(1);
      if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
      const number = parseInt(hex, 16);
      return [(number >> 16) & 255, (number >> 8) & 255, number & 255, 1];
    }
    const match = value.match(/rgba?\(([^)]+)\)/);
    if (match) {
      const parts = match[1].split(',').map((part) => parseFloat(part));
      return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
    }
    return [0, 0, 0, 1];
  }

  function mixColors(a, b, fraction) {
    const ca = parseColor(a);
    const cb = parseColor(b);
    const mix = ca.map((value, index) => value + (cb[index] - value) * fraction);
    return `rgba(${Math.round(mix[0])}, ${Math.round(mix[1])}, ${Math.round(mix[2])}, ${mix[3].toFixed(3)})`;
  }

  function withAlpha(color, alpha) {
    const [r, g, b, a] = parseColor(color);
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${(a * alpha).toFixed(3)})`;
  }

  /* ---------------------------------------------------------------- *
   * Plot
   * ---------------------------------------------------------------- */

  class Plot {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {object} options
     *   margin      {top,right,bottom,left} in CSS pixels
     *   aspect      height / width, used when the canvas is auto-sized
     *   equalAspect keep x and y units the same physical size
     */
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.options = options;
      this.margin = Object.assign(
        { top: 12, right: 14, bottom: 34, left: 44 },
        options.margin || {}
      );
      this.aspect = options.aspect != null ? options.aspect : 0.72;
      this.equal = options.equalAspect === true;
      this.theme = new Theme(canvas);
      this.domain = { x0: 0, x1: 1, y0: 0, y1: 1 };
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
    }

    /** Matches the backing store to the element size and device pixel ratio. */
    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const cssWidth = Math.max(1, Math.round(rect.width || this.canvas.clientWidth || 320));
      const cssHeight = Math.max(1, Math.round(cssWidth * this.aspect));
      const dpr = Math.min(3, global.devicePixelRatio || 1);

      this.canvas.style.height = `${cssHeight}px`;
      if (
        this.canvas.width !== Math.round(cssWidth * dpr) ||
        this.canvas.height !== Math.round(cssHeight * dpr)
      ) {
        this.canvas.width = Math.round(cssWidth * dpr);
        this.canvas.height = Math.round(cssHeight * dpr);
      }
      this.width = cssWidth;
      this.height = cssHeight;
      this.dpr = dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return this;
    }

    get plotWidth() {
      return this.width - this.margin.left - this.margin.right;
    }

    get plotHeight() {
      return this.height - this.margin.top - this.margin.bottom;
    }

    clear() {
      this.theme.refresh();
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.fillStyle = this.theme.surface;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
      return this;
    }

    /** Sets the data range shown by the plot area. */
    setDomain(x0, x1, y0, y1) {
      this.domain = { x0, x1, y0, y1 };
      if (this.equal) this._equalise();
      return this;
    }

    _equalise() {
      const { x0, x1, y0, y1 } = this.domain;
      const dataWidth = x1 - x0;
      const dataHeight = y1 - y0;
      if (dataWidth <= 0 || dataHeight <= 0) return;
      const scaleX = this.plotWidth / dataWidth;
      const scaleY = this.plotHeight / dataHeight;
      const scale = Math.min(scaleX, scaleY);
      const spanX = this.plotWidth / scale;
      const spanY = this.plotHeight / scale;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      this.domain = {
        x0: cx - spanX / 2,
        x1: cx + spanX / 2,
        y0: cy - spanY / 2,
        y1: cy + spanY / 2,
      };
    }

    px(x) {
      const { x0, x1 } = this.domain;
      return this.margin.left + ((x - x0) / (x1 - x0)) * this.plotWidth;
    }

    py(y) {
      const { y0, y1 } = this.domain;
      return this.margin.top + this.plotHeight - ((y - y0) / (y1 - y0)) * this.plotHeight;
    }

    /** Inverse mapping, for hover interaction. */
    dataX(px) {
      const { x0, x1 } = this.domain;
      return x0 + ((px - this.margin.left) / this.plotWidth) * (x1 - x0);
    }

    dataY(py) {
      const { y0, y1 } = this.domain;
      return y0 + ((this.margin.top + this.plotHeight - py) / this.plotHeight) * (y1 - y0);
    }

    /** Clips subsequent drawing to the plot rectangle. */
    clip(draw) {
      const ctx = this.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.margin.left, this.margin.top, this.plotWidth, this.plotHeight);
      ctx.clip();
      draw();
      ctx.restore();
      return this;
    }

    /* --------------------------- chrome --------------------------- */

    axes(options = {}) {
      const ctx = this.ctx;
      const theme = this.theme;
      const xTicks = options.xTicks || niceTicks(this.domain.x0, this.domain.x1, 6);
      const yTicks = options.yTicks || niceTicks(this.domain.y0, this.domain.y1, 5);
      const formatX = options.formatX || defaultFormat;
      const formatY = options.formatY || defaultFormat;

      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = theme.grid;

      if (options.grid !== false) {
        ctx.beginPath();
        for (const tick of xTicks) {
          const x = Math.round(this.px(tick)) + 0.5;
          if (x < this.margin.left - 0.5 || x > this.margin.left + this.plotWidth + 0.5) continue;
          ctx.moveTo(x, this.margin.top);
          ctx.lineTo(x, this.margin.top + this.plotHeight);
        }
        for (const tick of yTicks) {
          const y = Math.round(this.py(tick)) + 0.5;
          if (y < this.margin.top - 0.5 || y > this.margin.top + this.plotHeight + 0.5) continue;
          ctx.moveTo(this.margin.left, y);
          ctx.lineTo(this.margin.left + this.plotWidth, y);
        }
        ctx.stroke();
      }

      // axis rules
      ctx.strokeStyle = theme.axis;
      ctx.beginPath();
      const baseY = Math.round(this.margin.top + this.plotHeight) + 0.5;
      ctx.moveTo(this.margin.left, baseY);
      ctx.lineTo(this.margin.left + this.plotWidth, baseY);
      const baseX = Math.round(this.margin.left) + 0.5;
      ctx.moveTo(baseX, this.margin.top);
      ctx.lineTo(baseX, this.margin.top + this.plotHeight);
      ctx.stroke();

      ctx.fillStyle = theme.muted;
      ctx.font = `500 10.5px ${fontStack()}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (const tick of xTicks) {
        const x = this.px(tick);
        if (x < this.margin.left - 1 || x > this.margin.left + this.plotWidth + 1) continue;
        ctx.fillText(formatX(tick), x, this.margin.top + this.plotHeight + 7);
      }
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (const tick of yTicks) {
        const y = this.py(tick);
        if (y < this.margin.top - 1 || y > this.margin.top + this.plotHeight + 1) continue;
        ctx.fillText(formatY(tick), this.margin.left - 7, y);
      }

      if (options.xLabel) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = theme.secondary;
        ctx.font = `500 11px ${fontStack()}`;
        ctx.fillText(options.xLabel, this.margin.left + this.plotWidth / 2, this.height - 1);
      }
      if (options.yLabel) {
        ctx.save();
        ctx.translate(9, this.margin.top + this.plotHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = theme.secondary;
        ctx.font = `500 11px ${fontStack()}`;
        ctx.fillText(options.yLabel, 0, 0);
        ctx.restore();
      }
      ctx.restore();
      return this;
    }

    /* --------------------------- marks ---------------------------- */

    polyline(points, options = {}) {
      if (!points || points.length < 2) return this;
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = options.color || this.theme.accent;
      ctx.lineWidth = options.width != null ? options.width : 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = options.cap || 'round';
      if (options.dash) ctx.setLineDash(options.dash);
      if (options.alpha != null) ctx.globalAlpha = options.alpha;

      ctx.beginPath();
      let started = false;
      for (const point of points) {
        const [x, y] = point;
        if (!isFinite(x) || !isFinite(y)) {
          started = false;
          continue;
        }
        const px = this.px(x);
        const py = this.py(y);
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
      ctx.restore();
      return this;
    }

    /** Filled band between two polylines sharing x values. */
    band(points, options = {}) {
      if (!points || points.length < 2) return this;
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = options.color || withAlpha(this.theme.accent, 0.12);
      ctx.beginPath();
      points.forEach((point, index) => {
        const px = this.px(point[0]);
        const py = this.py(point[1]);
        if (index === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      for (let i = points.length - 1; i >= 0; i -= 1) {
        ctx.lineTo(this.px(points[i][0]), this.py(points[i][2]));
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return this;
    }

    polygon(points, options = {}) {
      if (!points || points.length < 3) return this;
      const ctx = this.ctx;
      ctx.save();
      ctx.beginPath();
      points.forEach((point, index) => {
        const px = this.px(point[0]);
        const py = this.py(point[1]);
        if (index === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      if (options.fill) {
        ctx.fillStyle = options.fill;
        ctx.fill();
      }
      if (options.stroke) {
        ctx.strokeStyle = options.stroke;
        ctx.lineWidth = options.width != null ? options.width : 1.5;
        if (options.dash) ctx.setLineDash(options.dash);
        ctx.stroke();
      }
      ctx.restore();
      return this;
    }

    marker(x, y, options = {}) {
      const ctx = this.ctx;
      const radius = options.radius != null ? options.radius : 4.5;
      const px = this.px(x);
      const py = this.py(y);
      ctx.save();
      if (options.ring !== false) {
        // 2px surface ring keeps overlapping markers separable
        ctx.beginPath();
        ctx.arc(px, py, radius + 2, 0, TAU);
        ctx.fillStyle = options.ringColor || this.theme.surface;
        ctx.fill();
      }
      ctx.beginPath();
      if (options.shape === 'square') {
        ctx.rect(px - radius, py - radius, radius * 2, radius * 2);
      } else if (options.shape === 'star') {
        star(ctx, px, py, radius + 2.5, radius * 0.5, 5);
      } else {
        ctx.arc(px, py, radius, 0, TAU);
      }
      ctx.fillStyle = options.color || this.theme.accent;
      ctx.fill();
      if (options.stroke) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = options.stroke;
        ctx.stroke();
      }
      ctx.restore();
      return this;
    }

    /** Direct label with a surface halo so it stays readable over marks. */
    label(x, y, text, options = {}) {
      const ctx = this.ctx;
      ctx.save();
      ctx.font = options.font || `600 11px ${fontStack()}`;
      ctx.textAlign = options.align || 'left';
      ctx.textBaseline = options.baseline || 'middle';
      const px = this.px(x) + (options.dx || 0);
      const py = this.py(y) + (options.dy || 0);
      if (options.halo !== false) {
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = options.haloColor || this.theme.surface;
        ctx.strokeText(text, px, py);
      }
      ctx.fillStyle = options.color || this.theme.secondary;
      ctx.fillText(text, px, py);
      ctx.restore();
      return this;
    }

    /** Label positioned in device pixels rather than data coordinates. */
    labelPx(px, py, text, options = {}) {
      const ctx = this.ctx;
      ctx.save();
      ctx.font = options.font || `600 11px ${fontStack()}`;
      ctx.textAlign = options.align || 'left';
      ctx.textBaseline = options.baseline || 'middle';
      if (options.halo !== false) {
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = options.haloColor || this.theme.surface;
        ctx.strokeText(text, px, py);
      }
      ctx.fillStyle = options.color || this.theme.secondary;
      ctx.fillText(text, px, py);
      ctx.restore();
      return this;
    }

    /** Straight guide between two data points. */
    line(x0, y0, x1, y1, options = {}) {
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = options.color || this.theme.axis;
      ctx.lineWidth = options.width != null ? options.width : 1.25;
      if (options.dash) ctx.setLineDash(options.dash);
      if (options.alpha != null) ctx.globalAlpha = options.alpha;
      ctx.beginPath();
      ctx.moveTo(this.px(x0), this.py(y0));
      ctx.lineTo(this.px(x1), this.py(y1));
      ctx.stroke();
      ctx.restore();
      return this;
    }

    /** Circular arc in data space; only sensible with equalAspect. */
    arc(cx, cy, radius, from, to, options = {}) {
      const ctx = this.ctx;
      const scale = this.plotWidth / (this.domain.x1 - this.domain.x0);
      ctx.save();
      ctx.strokeStyle = options.color || this.theme.muted;
      ctx.lineWidth = options.width != null ? options.width : 1.25;
      if (options.dash) ctx.setLineDash(options.dash);
      ctx.beginPath();
      ctx.arc(this.px(cx), this.py(cy), radius * scale, -to, -from);
      ctx.stroke();
      ctx.restore();
      return this;
    }

    /** Draws an image buffer into the plot rectangle. */
    image(imageData, options = {}) {
      const ctx = this.ctx;
      const left = options.left != null ? options.left : this.margin.left;
      const top = options.top != null ? options.top : this.margin.top;
      const width = options.width != null ? options.width : this.plotWidth;
      const height = options.height != null ? options.height : this.plotHeight;
      const buffer = document.createElement('canvas');
      buffer.width = imageData.width;
      buffer.height = imageData.height;
      buffer.getContext('2d').putImageData(imageData, 0, 0);
      ctx.save();
      ctx.imageSmoothingEnabled = options.smooth !== false;
      ctx.drawImage(buffer, left, top, width, height);
      ctx.restore();
      return this;
    }

    /** Hairline frame around the plot area. */
    frame(color) {
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = color || this.theme.axis;
      ctx.lineWidth = 1;
      ctx.strokeRect(
        Math.round(this.margin.left) + 0.5,
        Math.round(this.margin.top) + 0.5,
        Math.round(this.plotWidth) - 1,
        Math.round(this.plotHeight) - 1
      );
      ctx.restore();
      return this;
    }
  }

  function star(ctx, cx, cy, outer, inner, points) {
    for (let i = 0; i < points * 2; i += 1) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function fontStack() {
    return 'system-ui, -apple-system, "Segoe UI", sans-serif';
  }

  function defaultFormat(value) {
    if (Math.abs(value) >= 1000) return value.toFixed(0);
    if (Math.abs(value) >= 10) return value.toFixed(0);
    if (Math.abs(value) >= 1) return value.toFixed(1);
    if (value === 0) return '0';
    return value.toPrecision(2);
  }

  function niceTicks(min, max, count) {
    if (!(isFinite(min) && isFinite(max)) || min === max) return [min];
    const span = max - min;
    const rawStep = span / Math.max(1, count);
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalised = rawStep / magnitude;
    let step;
    if (normalised <= 1) step = magnitude;
    else if (normalised <= 2) step = 2 * magnitude;
    else if (normalised <= 2.5) step = 2.5 * magnitude;
    else if (normalised <= 5) step = 5 * magnitude;
    else step = 10 * magnitude;

    const ticks = [];
    const start = Math.ceil(min / step) * step;
    for (let value = start; value <= max + step * 1e-6; value += step) {
      ticks.push(Math.abs(value) < step * 1e-6 ? 0 : value);
    }
    return ticks;
  }

  /* ---------------------------------------------------------------- *
   * Shared tooltip
   * ---------------------------------------------------------------- */

  let tooltipElement = null;

  function tooltip() {
    if (!tooltipElement) {
      tooltipElement = document.createElement('div');
      tooltipElement.className = 'viz-tooltip';
      tooltipElement.setAttribute('role', 'status');
      document.body.appendChild(tooltipElement);
    }
    return tooltipElement;
  }

  function showTooltip(event, html) {
    const element = tooltip();
    element.innerHTML = html;
    element.dataset.visible = 'true';
    const padding = 14;
    const rect = element.getBoundingClientRect();
    let left = event.clientX + padding;
    let top = event.clientY + padding;
    if (left + rect.width > global.innerWidth - 8) left = event.clientX - rect.width - padding;
    if (top + rect.height > global.innerHeight - 8) top = event.clientY - rect.height - padding;
    element.style.left = `${Math.max(8, left)}px`;
    element.style.top = `${Math.max(8, top)}px`;
  }

  function hideTooltip() {
    if (tooltipElement) tooltipElement.dataset.visible = 'false';
  }

  /**
   * Attaches pointer tracking to a canvas. The handler receives plot-space
   * coordinates plus the raw event; hit areas are generous by design.
   */
  function attachHover(plot, handler) {
    const canvas = plot.canvas;
    const move = (event) => {
      const rect = canvas.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      handler(
        {
          px,
          py,
          x: plot.dataX(px),
          y: plot.dataY(py),
          inside:
            px >= plot.margin.left - 6 &&
            px <= plot.margin.left + plot.plotWidth + 6 &&
            py >= plot.margin.top - 6 &&
            py <= plot.margin.top + plot.plotHeight + 6,
        },
        event
      );
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerdown', move);
    canvas.addEventListener('pointerleave', () => {
      hideTooltip();
      handler(null, null);
    });
    return plot;
  }

  global.Viz = {
    Plot,
    Theme,
    attachHover,
    showTooltip,
    hideTooltip,
    niceTicks,
    mixColors,
    withAlpha,
    parseColor,
    fontStack,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
