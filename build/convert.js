/*
 * Converts the appendix of paper/main.md into an HTML fragment.
 *
 * The prose is preserved verbatim. Only the markup around it changes:
 *   - $...$ / $$...$$ are pre-rendered with KaTeX,
 *   - pandoc cross-reference links keep their printed number and point at the
 *     matching interactive figure,
 *   - an `@@figure:<name>@@` anchor line becomes a slot that app.js fills with
 *     the interactive visualisation registered under that name in web/js.
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

/* Raw markup the appendix should no longer contain — see FIGURE_ANCHOR. */
const LEFTOVER_MARKUP = /^\s*<(figure|embed|img|figcaption)\b/;

/*
 * Anchor targets for pandoc's `Figure [n](#id)` references.
 *
 * Only ids that do not slugify to their own anchor are listed: a reference is
 * resolved by replacing `:` with `-` (which is what section headings and the
 * parameter table get), so `sec:1d_tsunami` finds `sec-1d_tsunami` by itself.
 * The entries below are the figures the paper split into subfigures — each one
 * points at the interactive figure that now shows the same thing.
 */
const REFERENCE_TARGETS = {
  'fig:lifting_transformations': 'fig-profiles',
  'fig:angular_tsunami': 'fig-angular-construction',
  'fig:lifting_in_space': 'fig-extensions-2d',
  'fig:camera_original': 'fig-extensions-2d',
  'fig:parabolic_radial': 'fig-extensions-2d',
  'fig:parabolic_directional': 'fig-extensions-2d',
  'fig:parabolic_mixed': 'fig-extensions-2d',
  'fig:parabolic_sideview': 'fig-extensions-2d',
  'fig:parabolic_radial_topview': 'fig-extensions-2d',
  'fig:parabolic_directional_topview': 'fig-extensions-2d',
  'fig:parabolic_mixed_topview': 'fig-extensions-2d',
  'fig:zero_planes': 'fig-zero-plane',
  'fig:curvature_band': 'fig-curvature-band',
};

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

function convertReferences(text) {
  // [1](#fig:notation){reference-type="ref" reference="fig:notation"}
  return text.replace(
    /\[([^\]]*)\]\(#([^)]+)\)(?:\{[^}]*\})?/g,
    (match, label, target) => {
      const anchor = REFERENCE_TARGETS[target] || target.replace(/:/g, '-');
      return `<a class="xref" href="#${anchor}">${label}</a>`;
    }
  );
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

/** The single pandoc table in the appendix is converted by hand. */
const PARAMETER_TABLE = `<figure class="table-figure" id="tab-parameters">
<table class="parameter-table">
<caption>Table 1: Basic parameters used in the figures.</caption>
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

function renderParameterTable() {
  return PARAMETER_TABLE.replace(/@MATH:([^@]+)@/g, (match, tex) =>
    renderMath(tex.replace(/\\\\/g, '\\'), false)
  );
}

function stripDivBlock(lines) {
  const output = [];
  let inside = false;
  for (const line of lines) {
    if (/^::: /.test(line)) {
      inside = true;
      output.push('@@TABLE@@');
      continue;
    }
    if (/^:::\s*$/.test(line)) {
      inside = false;
      continue;
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
    if (trimmed.startsWith('@@')) {
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

  blocks.forEach((block, index) => {
    if (block.type === 'heading') {
      closeList();
      if (sectionOpen && block.level <= 2) {
        html.push('</section>');
        sectionOpen = false;
      }
      const id = slugForHeading(block, index);
      if (block.level <= 2) {
        html.push(`<section id="${id}" class="paper-section">`);
        sectionOpen = true;
      }
      const level = Math.min(block.level + 1, 6);
      const anchorId = block.level <= 2 ? `${id}-title` : id;
      html.push(
        `<h${level} id="${anchorId}" class="heading-l${block.level}">${convertInlineText(block.text)}</h${level}>`
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
      if (block.value === '@@TABLE@@') {
        html.push(renderParameterTable());
        return;
      }
      const anchor = block.value.match(FIGURE_ANCHOR);
      if (!anchor) throw new Error(`Unrecognised anchor in the source: ${block.value}`);
      html.push(figureSlot(anchor[1]));
      return;
    }

    html.push(convertParagraph(block.value));
  });

  closeList();
  if (sectionOpen) html.push('</section>');
  return html.join('\n');
}

function figureSlot(name) {
  return `<figure class="fig-slot" id="fig-${name}" data-figure="${name}"></figure>`;
}

function main() {
  const markdown = fs.readFileSync(SOURCE, 'utf8');
  let lines = markdown.split(/\r?\n/);
  checkNoRawMarkup(lines);
  lines = stripDivBlock(lines);

  const blocks = blockify(lines);
  const html = render(blocks);
  fs.writeFileSync(OUTPUT, `${html}\n`, 'utf8');

  const slots = [...html.matchAll(/data-figure="([^"]+)"/g)].map((m) => m[1]);
  console.log(`Wrote ${OUTPUT}`);
  console.log(`  ${blocks.length} blocks, ${slots.length} figure slots: ${slots.join(', ')}`);
}

main();
