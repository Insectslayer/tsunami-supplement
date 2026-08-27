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

  buildContents();
  wirePreviews();
  document.body.dataset.ready = 'true';
})();
