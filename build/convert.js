/*
 * Converts the appendix of paper/main.md into an HTML fragment.
 *
 * The prose is preserved verbatim. Only the markup around it changes:
 *   - $...$ / $$...$$ are pre-rendered with KaTeX,
 *   - an `@@figure:<name>@@` anchor line becomes a slot that app.js fills with
 *     the interactive visualisation registered under that name in web/js,
 *   - figures, sections and tables are numbered by their order in the source,
 *     and an inline `@@ref:<label>@@` prints the number the target was given:
 *     `@@ref:notation@@` for a figure anchor, `@@ref:sec:1d_tsunami@@` for a
 *     heading carrying `{#sec:1d_tsunami}`, `@@ref:tab:parameters@@` for a
 *     table. No number is ever written down in the source.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const katex = require('katex');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'paper', 'main.md');
const OUTPUT = path.join(ROOT, 'web', 'content.html');

/* Marks an anchor line reserving the place of an interactive figure. */
const FIGURE_ANCHOR = /^@@figure:([a-z0-9-]+)@@$/;

/* The pandoc div holding a table, rewritten to a marker by stripDivBlock. */
const TABLE_MARKER = /^@@table:([a-z0-9:_-]+)@@$/;

/* Raw markup the appendix should no longer contain — see FIGURE_ANCHOR. */
const LEFTOVER_MARKUP = /^\s*<(figure|embed|img|figcaption)\b/;

/* A pandoc cross-reference link, which carries a number the source must not
 * spell out — see REFERENCE. */
const LEFTOVER_REFERENCE = /\[[^\]]*\]\(#[^)]+\)/;

/*
 * Inline `@@ref:<label>@@` reference to a numbered thing: a figure anchor
 * (`notation`), a heading label (`sec:1d_tsunami`) or a table (`tab:foo`).
 * It prints the number that thing was given, so the prose never spells one out.
 */
const REFERENCE = /@@ref:([a-z0-9:_-]+)@@/g;

const FIRST_SECTION_NUMBER = 1;

/*
 * label -> { number, href, kind }, in the order the labelled things appear in
 * the source. Figures are keyed by their anchor name, sections and tables by
 * the id written in the source (`sec:…`, `tab:…`).
 */
const labels = new Map();

const MATH_MACROS = {
  '\\ensuremath': '#1',
};

function renderMath(tex, displayMode) {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: true,
      strict: false,
      macros: MATH_MACROS,
      output: 'htmlAndMathml',
    });
  } catch (error) {
    console.error(`\n  KaTeX failed on ${displayMode ? 'display' : 'inline'} math:`);
    console.error(`  ${tex.replace(/\n/g, ' ')}`);
    console.error(`  ${error.message}\n`);
    process.exitCode = 1;
    return `<code class="math-error">${escapeHtml(tex)}</code>`;
  }
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ------------------------------------------------------------------ *
 * Inline markup
 * ------------------------------------------------------------------ */

/** `@@ref:profiles@@` -> a link printing the number that target was given. */
function convertReferences(text) {
  return text.replace(REFERENCE, (match, label) => {
    const target = labels.get(label);
    if (!target) {
      throw new Error(
        `${match} refers to something that is not numbered in the source. ` +
          `Known labels: ${[...labels.keys()].join(', ')}`
      );
    }
    return `<a class="xref" href="${target.href}">${target.number}</a>`;
  });
}

/**
 * Numbers everything the prose can cite, in source order: figures 1..n by their
 * anchors, tables 1..n by theirs, and headings hierarchically under
 * FIRST_SECTION_NUMBER. The numbers are stored on the blocks as well, so the
 * renderer prints the same one it hands out to the references.
 */
function collectLabels(blocks) {
  labels.clear();
  const counters = [];
  let figures = 0;
  let tables = 0;

  blocks.forEach((block, index) => {
    if (block.type === 'heading') {
      counters.length = block.level;
      for (let depth = 0; depth < block.level; depth += 1) {
        if (counters[depth] == null) counters[depth] = 0;
      }
      counters[block.level - 1] += 1;
      block.number = counters
        .map((count, depth) => (depth === 0 ? count + FIRST_SECTION_NUMBER - 1 : count))
        .join('.');
      block.slug = slugForHeading(block, index);
      if (block.id) {
        labels.set(block.id, { number: block.number, href: `#${block.slug}`, kind: 'section' });
      }
      return;
    }

    if (block.type !== 'marker') return;

    const figure = block.value.match(FIGURE_ANCHOR);
    if (figure) {
      figures += 1;
      block.name = figure[1];
      block.number = figures;
      labels.set(figure[1], { number: figures, href: `#fig-${figure[1]}`, kind: 'figure' });
      return;
    }

    const table = block.value.match(TABLE_MARKER);
    if (table) {
      tables += 1;
      block.name = table[1];
      block.number = tables;
      block.slug = table[1].replace(/:/g, '-');
      labels.set(table[1], { number: tables, href: `#${block.slug}`, kind: 'table' });
    }
  });
}

function convertEmphasis(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
}

/**
 * Splits a paragraph into text and display-math chunks, rendering inline math
 * inside the text chunks.
 */
function convertParagraph(raw) {
  const parts = [];
  let rest = raw;

  while (rest.length > 0) {
    const start = rest.indexOf('$$');
    if (start === -1) {
      parts.push({ type: 'text', value: rest });
      break;
    }
    const end = rest.indexOf('$$', start + 2);
    if (end === -1) {
      parts.push({ type: 'text', value: rest });
      break;
    }
    if (start > 0) parts.push({ type: 'text', value: rest.slice(0, start) });
    parts.push({ type: 'display', value: rest.slice(start + 2, end) });
    rest = rest.slice(end + 2);
  }

  const html = [];
  for (const part of parts) {
    if (part.type === 'display') {
      html.push(`<div class="math-block">${renderMath(part.value.trim(), true)}</div>`);
      continue;
    }
    const text = part.value.trim();
    if (!text) continue;
    html.push(`<p>${convertInlineText(text)}</p>`);
  }
  return html.join('\n');
}

function convertInlineText(text) {
  const chunks = [];
  let buffer = '';
  let index = 0;

  while (index < text.length) {
    const char = text[index];
    if (char === '$') {
      const end = findInlineMathEnd(text, index + 1);
      if (end !== -1) {
        chunks.push({ type: 'text', value: buffer });
        buffer = '';
        chunks.push({ type: 'math', value: text.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }
    buffer += char;
    index += 1;
  }
  chunks.push({ type: 'text', value: buffer });

  return chunks
    .map((chunk) => {
      if (chunk.type === 'math') return renderMath(chunk.value, false);
      let value = escapeHtml(chunk.value);
      value = convertReferences(value);
      value = convertEmphasis(value);
      return value;
    })
    .join('');
}

function findInlineMathEnd(text, from) {
  for (let i = from; i < text.length; i += 1) {
    if (text[i] === '$' && text[i - 1] !== '\\') return i;
  }
  return -1;
}

/* ------------------------------------------------------------------ *
 * Block structure
 * ------------------------------------------------------------------ */

/** Fails the build if pandoc's figure markup was pasted back into the source. */
function checkNoRawMarkup(lines) {
  const offenders = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => LEFTOVER_MARKUP.test(line));
  if (offenders.length === 0) return;
  const { line, index } = offenders[0];
  throw new Error(
    `${SOURCE}:${index + 1}: raw figure markup in the source — replace the ` +
      `block with an @@figure:<name>@@ anchor.\n  ${line.trim()}`
  );
}

/**
 * Fails the build if a pandoc cross-reference link was pasted back into the
 * source. Such a link spells out a number that then goes stale as soon as
 * anything is reordered.
 */
function checkNoStaticReferences(lines) {
  const offenders = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => LEFTOVER_REFERENCE.test(line));
  if (offenders.length === 0) return;
  const { line, index } = offenders[0];
  throw new Error(
    `${SOURCE}:${index + 1}: cross-reference with a written-out number — ` +
      `replace the link with an @@ref:<label>@@ reference.\n  ${line.trim()}`
  );
}

/** The single pandoc table in the appendix is converted by hand. */
const PARAMETER_TABLE = `<figure class="table-figure" id="@ANCHOR@">
<table class="parameter-table">
<caption>Table @NUMBER@: Basic parameters used in the figures.</caption>
<thead>
<tr><th>Parameter</th><th>Description</th><th>Default value</th></tr>
</thead>
<tbody>
<tr><td>@MATH:d_{w}@</td><td>world radius</td><td>500 m</td></tr>
<tr><td>@MATH:d_T@</td><td>tile size</td><td>30 m</td></tr>
<tr><td>@MATH:h@</td><td>observer elevation</td><td>100 m</td></tr>
<tr><td>@MATH:\\phi@</td><td>observer azimuth</td><td>0°</td></tr>
<tr><td>@MATH:\\alpha@</td><td>observer viewing direction</td><td>65°</td></tr>
<tr><td>@MATH:f@</td><td>focal distance</td><td>7 mm</td></tr>
<tr><td>@MATH:d_p@</td><td>camera pixel size</td><td>0.05 mm</td></tr>
<tr><td>@MATH:N@</td><td>half of display width</td><td>400</td></tr>
<tr><td>@MATH:M@</td><td>half of display height</td><td>300</td></tr>
</tbody>
</table>
</figure>`;

function renderParameterTable(block) {
  if (block.name !== 'tab:parameters') {
    throw new Error(
      `Only the parameter table is converted by hand; add markup for ${block.name}.`
    );
  }
  return PARAMETER_TABLE.replace(/@ANCHOR@/, block.slug)
    .replace(/@NUMBER@/, String(block.number))
    .replace(/@MATH:([^@]+)@/g, (match, tex) =>
      renderMath(tex.replace(/\\\\/g, '\\'), false)
    );
}

/**
 * Replaces the pandoc div wrapping a table with a marker carrying the div's
 * id, which is the label the prose cites the table by.
 */
function stripDivBlock(lines) {
  const output = [];
  let inside = false;
  for (const line of lines) {
    const opening = line.match(/^:::\s*\{#([a-z0-9:_-]+)\}\s*$/);
    if (opening) {
      inside = true;
      output.push(`@@table:${opening[1]}@@`);
      continue;
    }
    if (/^:::\s*$/.test(line)) {
      inside = false;
      continue;
    }
    if (/^:::/.test(line)) {
      throw new Error(
        `${SOURCE}: a pandoc div must carry the id the prose cites it by.\n  ${line.trim()}`
      );
    }
    if (inside) continue;
    output.push(line);
  }
  return output;
}

function blockify(lines) {
  const blocks = [];
  let paragraph = [];

  const flush = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: 'paragraph', value: paragraph.join(' ').trim() });
    paragraph = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      flush();
      continue;
    }
    // Only a whole line is a marker; an @@ref:...@@ that happens to start a
    // line is prose and is converted inline.
    if (TABLE_MARKER.test(trimmed) || FIGURE_ANCHOR.test(trimmed)) {
      flush();
      blocks.push({ type: 'marker', value: trimmed });
      continue;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.*?)(?:\s*\{#([^}]+)\})?$/);
    if (heading) {
      flush();
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        text: heading[2],
        id: heading[3] || null,
      });
      continue;
    }
    const bullet = trimmed.match(/^-\s+(.*)$/);
    if (bullet) {
      flush();
      blocks.push({ type: 'bullet', value: bullet[1] });
      continue;
    }
    if (blocks.length && blocks[blocks.length - 1].type === 'bullet' && paragraph.length === 0 && /^\s{2,}/.test(line)) {
      // continuation line of a bullet
      const previous = blocks[blocks.length - 1];
      previous.value += ` ${trimmed}`;
      continue;
    }
    paragraph.push(trimmed);
  }
  flush();
  return blocks;
}

function slugForHeading(block, index) {
  if (block.id) return block.id.replace(/:/g, '-');
  return `sec-${index}`;
}

function render(blocks) {
  const html = [];
  let listOpen = false;
  let sectionOpen = false;

  const closeList = () => {
    if (listOpen) {
      html.push('</ul>');
      listOpen = false;
    }
  };

  blocks.forEach((block) => {
    if (block.type === 'heading') {
      closeList();
      if (sectionOpen && block.level <= 2) {
        html.push('</section>');
        sectionOpen = false;
      }
      const id = block.slug;
      if (block.level <= 2) {
        html.push(`<section id="${id}" class="paper-section">`);
        sectionOpen = true;
      }
      const level = Math.min(block.level + 1, 6);
      const anchorId = block.level <= 2 ? `${id}-title` : id;
      // The number is the one the references print, and app.js reads it back
      // for the contents rail.
      html.push(
        `<h${level} id="${anchorId}" class="heading-l${block.level}" ` +
          `data-number="${block.number}">` +
          `<span class="heading-number">${block.number}</span>` +
          `<span class="heading-text">${convertInlineText(block.text)}</span>` +
          `</h${level}>`
      );
      return;
    }

    if (block.type === 'bullet') {
      if (!listOpen) {
        html.push('<ul>');
        listOpen = true;
      }
      html.push(`<li>${convertInlineText(block.value)}</li>`);
      return;
    }

    closeList();

    if (block.type === 'marker') {
      if (TABLE_MARKER.test(block.value)) {
        html.push(renderParameterTable(block));
        return;
      }
      if (!FIGURE_ANCHOR.test(block.value)) {
        throw new Error(`Unrecognised anchor in the source: ${block.value}`);
      }
      html.push(figureSlot(block));
      return;
    }

    html.push(convertParagraph(block.value));
  });

  closeList();
  if (sectionOpen) html.push('</section>');
  return html.join('\n');
}

function figureSlot(block) {
  return (
    `<figure class="fig-slot" id="fig-${block.name}" data-figure="${block.name}" ` +
    `data-number="${block.number}"></figure>`
  );
}

function main() {
  const markdown = fs.readFileSync(SOURCE, 'utf8');
  let lines = markdown.split(/\r?\n/);
  checkNoRawMarkup(lines);
  checkNoStaticReferences(lines);
  lines = stripDivBlock(lines);

  const blocks = blockify(lines);
  collectLabels(blocks);
  const html = render(blocks);
  fs.writeFileSync(OUTPUT, `${html}\n`, 'utf8');

  const summary = (kind) =>
    [...labels]
      .filter(([, target]) => target.kind === kind)
      .map(([label, target]) => `${target.number} ${label}`)
      .join(', ');
  console.log(`Wrote ${OUTPUT}`);
  console.log(`  ${blocks.length} blocks`);
  console.log(`  figures:  ${summary('figure')}`);
  console.log(`  sections: ${summary('section')}`);
  console.log(`  tables:   ${summary('table')}`);
}

main();
