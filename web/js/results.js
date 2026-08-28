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

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          field += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\n') {
        row.push(field.replace(/\r$/, ''));
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }
    if (field || row.length) {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
    }
    return rows;
  }

  function renderTable(target, rows, limit) {
    target.replaceChildren();
    const shown = rows.slice(0, limit + 1);
    const scroll = document.createElement('div');
    scroll.className = 'table-scroll';
    const table = document.createElement('table');
    table.className = 'data-table';
    shown.forEach((row, rowIndex) => {
      const tr = document.createElement('tr');
      row.forEach((value) => {
        const cell = document.createElement(rowIndex === 0 ? 'th' : 'td');
        cell.textContent = value;
        tr.appendChild(cell);
      });
      (rowIndex === 0 ? table.createTHead() : table.createTBody()).appendChild(tr);
    });
    scroll.appendChild(table);
    target.appendChild(scroll);
    const note = document.createElement('p');
    note.className = 'preview-note';
    const dataRows = Math.max(0, rows.length - 1);
    note.textContent = dataRows > limit
      ? `Previewing the first ${limit} of ${dataRows.toLocaleString()} data rows. Download the CSV for the complete table.`
      : `${dataRows.toLocaleString()} data rows.`;
    target.appendChild(note);
  }

  function wirePreviews() {
    document.querySelectorAll('.preview-button[data-csv]').forEach((button) => {
      button.addEventListener('click', async () => {
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
        if (target.dataset.loaded === 'true') return;
        target.innerHTML = '<p class="preview-note">Loading preview…</p>';
        try {
          const response = await fetch(button.dataset.csv);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          renderTable(target, parseCsv(await response.text()), 25);
          target.dataset.loaded = 'true';
        } catch (error) {
          target.innerHTML = `<p class="preview-error">Preview unavailable (${error.message}). The complete CSV can still be downloaded.</p>`;
        }
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
