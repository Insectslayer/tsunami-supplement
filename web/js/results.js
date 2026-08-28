(function () {
  'use strict';

  function buildContents() {
    const rail = document.getElementById('toc');
    if (!rail) return;
    const headings = [...document.querySelectorAll('.paper h2, .paper h3')];
    const links = [];
    headings.forEach((heading) => {
      if (!heading.id) return;
      const link = document.createElement('a');
      link.className = heading.tagName === 'H2' ? 'level-1' : 'level-2';
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent;
      rail.appendChild(link);
      links.push({ heading, link });
    });
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach(({ heading, link }) =>
          link.setAttribute('aria-current', String(heading === entry.target))
        );
      }),
      { rootMargin: '-15% 0px -70% 0px' }
    );
    links.forEach(({ heading }) => observer.observe(heading));
  }

  function wirePreviews() {
    document.querySelectorAll('.preview-button[aria-controls]').forEach((button) => {
      button.addEventListener('click', () => {
        const target = document.getElementById(button.getAttribute('aria-controls'));
        const opening = target.hidden;
        document.querySelectorAll('.dataset-preview').forEach((panel) => {
          if (panel !== target) panel.hidden = true;
        });
        if (!opening) {
          target.hidden = true;
          button.setAttribute('aria-expanded', 'false');
          return;
        }
        target.hidden = false;
        button.setAttribute('aria-expanded', 'true');
      });
    });
  }

  function svgElement(name, attributes = {}) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }

  function buildInteractivePrecisionScatter(figure) {
    const points = JSON.parse(figure.dataset.points || '[]').filter((point) =>
      ['baseline', 'map', 'tsunami'].includes(point.method)
      && Number.isFinite(point.x)
      && Number.isFinite(point.z)
    );
    if (!points.length) throw new Error('no valid embedded points');

    const absValues = points.flatMap((point) => [Math.abs(point.x), Math.abs(point.z)]).sort((a, b) => a - b);
    const extent = Math.max(6, absValues[Math.floor((absValues.length - 1) * 0.99)] * 1.08);
    const width = 560;
    const height = 560;
    const margin = { top: 35, right: 24, bottom: 72, left: 76 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const sx = (value) => margin.left + ((value + extent) / (2 * extent)) * innerWidth;
    const sy = (value) => margin.top + ((extent - value) / (2 * extent)) * innerHeight;
    const colors = { baseline: '#7f7f7f', map: '#dd8452', tsunami: '#4c72b0' };
    const labels = { baseline: 'Baseline', map: 'Minimap', tsunami: 'Tsunami' };
    const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' });

    [1, 2, 5].forEach((radius) => svg.appendChild(svgElement('circle', {
      cx: sx(0), cy: sy(0), r: radius / (2 * extent) * innerWidth,
      fill: 'none', stroke: '#999', 'stroke-width': 1, 'stroke-dasharray': '4 4'
    })));
    svg.appendChild(svgElement('line', { x1: sx(-extent), y1: sy(0), x2: sx(extent), y2: sy(0), stroke: '#bbb' }));
    svg.appendChild(svgElement('line', { x1: sx(0), y1: sy(-extent), x2: sx(0), y2: sy(extent), stroke: '#bbb' }));
    svg.appendChild(svgElement('rect', {
      x: margin.left, y: margin.top, width: innerWidth, height: innerHeight,
      fill: 'none', stroke: '#777', 'stroke-width': 1
    }));

    [-1, -0.5, 0, 0.5, 1].forEach((fraction) => {
      const value = fraction * extent;
      const x = sx(value);
      const y = sy(value);
      svg.appendChild(svgElement('line', {
        x1: x, y1: margin.top + innerHeight, x2: x, y2: margin.top + innerHeight + 5,
        stroke: '#777'
      }));
      const xTick = svgElement('text', {
        x, y: margin.top + innerHeight + 22, 'text-anchor': 'middle',
        fill: 'currentColor', 'font-size': 11
      });
      xTick.textContent = `${value.toFixed(0)} m`;
      svg.appendChild(xTick);
      svg.appendChild(svgElement('line', {
        x1: margin.left - 5, y1: y, x2: margin.left, y2: y, stroke: '#777'
      }));
      const yTick = svgElement('text', {
        x: margin.left - 10, y: y + 4, 'text-anchor': 'end',
        fill: 'currentColor', 'font-size': 11
      });
      yTick.textContent = `${value.toFixed(0)} m`;
      svg.appendChild(yTick);
    });

    const groups = {};
    ['baseline', 'map', 'tsunami'].forEach((method) => {
      const group = svgElement('g', { 'data-method': method });
      points.filter((point) => point.method === method).forEach((point) => {
        const circle = svgElement('circle', {
          cx: sx(point.x), cy: sy(point.z), r: 4.2,
          fill: colors[method], opacity: 0.58
        });
        const title = svgElement('title');
        title.textContent = `${labels[method]}: X ${point.x.toFixed(2)} m, Z ${point.z.toFixed(2)} m`;
        circle.appendChild(title);
        group.appendChild(circle);
      });
      groups[method] = group;
      svg.appendChild(group);
    });
    const target = svgElement('g', { stroke: '#111', 'stroke-width': 2.4 });
    target.appendChild(svgElement('line', { x1: sx(0) - 8, y1: sy(0), x2: sx(0) + 8, y2: sy(0) }));
    target.appendChild(svgElement('line', { x1: sx(0), y1: sy(0) - 8, x2: sx(0), y2: sy(0) + 8 }));
    svg.appendChild(target);

    const xLabel = svgElement('text', { x: width / 2, y: height - 18, 'text-anchor': 'middle', fill: 'currentColor' });
    xLabel.textContent = 'Target-centred X offset (m)';
    svg.appendChild(xLabel);
    const yLabel = svgElement('text', {
      x: 18, y: height / 2, 'text-anchor': 'middle', fill: 'currentColor',
      transform: `rotate(-90 18 ${height / 2})`
    });
    yLabel.textContent = 'Target-centred Z offset (m)';
    svg.appendChild(yLabel);
    figure.querySelector('.interactive-chart').appendChild(svg);

    const legend = figure.querySelector('.interactive-legend');
    ['baseline', 'map', 'tsunami'].forEach((method) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-pressed', 'true');
      button.innerHTML = `<span class="legend-dot" style="background:${colors[method]}"></span>${labels[method]}`;
      button.addEventListener('click', () => {
        const visible = button.getAttribute('aria-pressed') === 'true';
        button.setAttribute('aria-pressed', String(!visible));
        if (visible) groups[method].setAttribute('display', 'none');
        else groups[method].removeAttribute('display');
      });
      legend.appendChild(button);
    });
  }

  function wireInteractiveFigures() {
    document.querySelectorAll('.interactive-scatter[data-points]').forEach((figure) => {
      try {
        buildInteractivePrecisionScatter(figure);
      } catch (error) {
        figure.querySelector('.interactive-chart').innerHTML =
          `<p class="preview-error">Interactive chart unavailable (${error.message}).</p>`;
      }
    });
  }

  buildContents();
  wirePreviews();
  wireInteractiveFigures();
  document.body.dataset.ready = 'true';
})();
