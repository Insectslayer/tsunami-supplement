/*
 * Folds the whole of web/ into one self-contained file, next to this script as
 * build/bundle/supplement.html. It is a review artifact, not part of the site,
 * so it is gitignored and rebuilt on demand.
 *
 *   node build/bundle/bundle.js          everything embedded (default)
 *   node build/bundle/bundle.js --lean   pages and figures only, no data
 *
 * Why this exists: a browser opening a file:// page cannot always see the files
 * next to it. A sandboxed browser (Flatpak, Snap) handed a single file through
 * the document portal sees *only* that file, and a reader clicking index.html
 * inside an unextracted ZIP is in the same position — every relative stylesheet,
 * script and image 404s and the page arrives as unstyled text. A reviewer who
 * cannot install a web server, and will not debug ours, needs one file that
 * opens by double-click.
 *
 * So the three pages of the site become three views of one document, and every
 * asset they reference is embedded:
 *
 *   CSS, JS, KaTeX fonts   inline (shared with assemble.js through inline.js)
 *   result figures (SVG)   data: URIs on the <img>
 *   CSVs, notebooks, ZIP   SUPPLEMENT_FILES, served as blob downloads
 *
 * The dataset previews need nothing here: supplement.py renders those tables
 * into the page, so they are already part of the markup.
 *
 * The multi-file site in web/ is untouched and still works; this is an
 * additional artifact built from the same sources. Everything specific to it
 * lives in this folder: extra.css and router.js are bundle-only, and the shared
 * asset inlining is in ../inline.js, which assemble.js uses too.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const { WEB, read, usedFontFamilies, inlineStyles, inlineScripts } = require('../inline');

const LEAN = process.argv.includes('--lean');
const OUT = path.join(__dirname, 'supplement.html');

const VIEWS = [
  { name: 'appendix', label: 'Interactive appendix' },
  { name: 'quantitative-results', label: 'Quantitative results' },
  { name: 'qualitative-results', label: 'Qualitative results' },
];

const MIME = {
  '.csv': 'text/csv',
  '.zip': 'application/zip',
  '.ipynb': 'application/x-ipynb+json',
  '.md': 'text/markdown',
  '.txt': 'text/plain',
  '.svg': 'image/svg+xml',
};

/* ------------------------------------------------------------------ *
 * Embedded asset stores
 * ------------------------------------------------------------------ */

/** Files offered for download, keyed by the path the markup referenced. */
const files = new Map();
/** Bytes embedded per category, for the size report. */
const weights = { figures: 0, downloads: 0 };

function assetPath(reference) {
  return path.join(WEB, reference);
}

/**
 * A data: URI for an SVG. Percent-encoding usually beats base64 on SVG (which
 * is markup, not entropy), but not always, so both are measured.
 */
function svgDataUri(file) {
  const text = fs.readFileSync(file, 'utf8');
  const encoded = encodeURIComponent(text.replace(/\s+/g, ' ').trim())
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
  const percent = `data:image/svg+xml,${encoded}`;
  const base64 = `data:image/svg+xml;base64,${Buffer.from(text).toString('base64')}`;
  return percent.length <= base64.length ? percent : base64;
}

function registerDownload(reference) {
  if (files.has(reference)) return true;
  const file = assetPath(reference);
  if (!fs.existsSync(file)) {
    console.warn(`  ! missing, left as a relative link: ${reference}`);
    return false;
  }
  const extension = path.extname(reference).toLowerCase();
  const type = MIME[extension] || 'application/octet-stream';
  const buffer = fs.readFileSync(file);
  // Text rides as text; anything else has to be base64.
  const textual = ['.csv', '.md', '.txt', '.ipynb', '.svg'].includes(extension);
  files.set(reference, {
    name: path.basename(reference),
    type,
    ...(textual ? { text: buffer.toString('utf8') } : { base64: buffer.toString('base64') }),
  });
  weights.downloads += buffer.length;
  return true;
}

/* ------------------------------------------------------------------ *
 * Page surgery
 * ------------------------------------------------------------------ */

/**
 * JSON safe to place inside a <script> element.
 *
 * An embedded file can contain the literal `</script>` — the analysis notebook
 * does, in its saved pandas and Colab HTML outputs — and that sequence closes
 * the script element wherever it appears, leaving the rest of the data to be
 * parsed as markup. Escaping `<` prevents it; the paragraph separators are
 * escaped too, being legal in JSON but not in older JavaScript string literals.
 */
function jsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003C')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function bodyOf(html) {
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
  if (!match) throw new Error('no <body> found');
  return match[1];
}

/** The generated nav is rebuilt for in-document switching. */
function stripSiteNav(html) {
  return html.replace(/<nav class="site-nav"[\s\S]*?<\/nav>\s*/, '');
}

function stripScriptTags(html) {
  return html.replace(/<script\b[^>]*\bsrc="[^"]*"[^>]*>\s*<\/script>\s*/g, '');
}

/**
 * Rewrites every reference a results page makes to a file on disk. Figures
 * become data: URIs, every referenced file gains a download key, and the anchors
 * that opened a figure in a new tab are unwrapped — a data: URI cannot be
 * navigated to, so the lightbox in router.js takes over.
 */
function embedResultAssets(html) {
  let out = html;

  out = out.replace(
    /<a href="(materials\/[^"]+\.svg)"[^>]*>(\s*<img\b[^>]*>\s*)<\/a>/g,
    (match, reference, image) => image.trim()
  );

  out = out.replace(/<img\b([^>]*?)src="(materials\/[^"]+\.svg)"([^>]*)>/g,
    (match, before, reference, after) => {
      const file = assetPath(reference);
      if (!fs.existsSync(file)) {
        console.warn(`  ! missing figure, left as a relative link: ${reference}`);
        return match;
      }
      weights.figures += fs.statSync(file).size;
      // loading="lazy" is pointless on a data: URI and delays the first paint.
      const attributes = `${before}${after}`.replace(/\s*loading="lazy"/, '');
      return `<img${attributes} src="${svgDataUri(file)}">`;
    }
  );

  out = out.replace(
    /<a([^>]*?)href="((?:materials|downloads)\/[^"]+)"([^>]*?)>/g,
    (match, before, reference, after) => {
      // Lean embeds no data at all, so its download links resolve only when
      // the web/ folder is there beside the file.
      if (LEAN) return match;
      return registerDownload(reference)
        ? `<a${before}href="${reference}" data-download="${reference}"${after}>`
        : match;
    }
  );

  return out;
}

/* ------------------------------------------------------------------ *
 * Build
 * ------------------------------------------------------------------ */

function viewMarkup({ name, label }, inner) {
  return [
    `<section class="view" data-view="${name}" data-title="${label}"${
      name === VIEWS[0].name ? '' : ' hidden'
    }>`,
    // Each page carries its own id="toc"; three of them in one document would
    // be invalid. The scripts find the rail by class, so renaming is safe.
    inner.trim().replace(/\bid="toc"/g, `id="toc-${name}"`),
    '</section>',
  ].join('\n');
}

function build() {
  const template = read('template.html');
  const content = read('content.html');

  console.log(`bundling web/ -> build/bundle/supplement.html${LEAN ? '  (lean)' : ''}`);

  // --- appendix view ---------------------------------------------------
  const appendixBody = stripScriptTags(
    stripSiteNav(bodyOf(template)).replace('<!--CONTENT-->', content)
  ).replace('<!--SCRIPTS-->', '');

  // --- results views ---------------------------------------------------
  const resultViews = VIEWS.slice(1).map((view) => {
    const page = read(`${view.name}.html`);
    const body = embedResultAssets(stripScriptTags(stripSiteNav(bodyOf(page))));
    return viewMarkup(view, body);
  });

  const views = [viewMarkup(VIEWS[0], appendixBody), ...resultViews].join('\n\n');

  // --- shared chrome ---------------------------------------------------
  const nav = [
    '<nav class="site-nav" aria-label="Supplement sections">',
    ...VIEWS.map(
      ({ name, label }) =>
        `  <a href="#${name}" data-view-link="${name}"${
          name === VIEWS[0].name ? ' aria-current="page"' : ''
        }>${label}</a>`
    ),
    '</nav>',
  ].join('\n');

  const families = usedFontFamilies(content);
  const styles = [
    inlineStyles(families),
    `<style>\n${fs.readFileSync(path.join(__dirname, 'extra.css'), 'utf8')}\n</style>`,
  ].join('\n');

  const stores = [
    '<script>',
    `window.SUPPLEMENT_FILES = ${jsonForScript(Object.fromEntries(files))};`,
    '</script>',
  ].join('\n');

  const scripts = [
    stores,
    inlineScripts(),
    `<script>\n${read('js/results.js')}\n</script>`,
    `<script>\n${fs.readFileSync(path.join(__dirname, 'router.js'), 'utf8')}\n</script>`,
  ].join('\n');

  const head = template.match(/<head>([\s\S]*?)<\/head>/)[1]
    .replace('<!--STYLES-->', styles)
    .replace(
      /<title>[\s\S]*?<\/title>/,
      '<title>Tsunami Supplement</title>'
    )
    .replace(
      /<meta name="description"[^>]*>/,
      '<meta name="description" content="Complete offline supplement: the interactive appendix, the quantitative results and the qualitative results in a single file.">'
    );

  const document = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    head.trim(),
    '</head>',
    `<body data-bundle="${LEAN ? 'lean' : 'full'}">`,
    nav,
    '',
    views,
    '',
    scripts,
    '</body>',
    '</html>',
    '',
  ].join('\n');

  fs.writeFileSync(OUT, document, 'utf8');

  const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  const total = Buffer.byteLength(document);
  console.log(`  figures    ${String(weights.figures).padStart(9)} B raw`);
  console.log(`  downloads  ${String(weights.downloads).padStart(9)} B  (${files.size} files)`);
  console.log(`build/bundle/supplement.html  ${mb(total)}  ${VIEWS.length} views, fonts: ${[...families].join(', ')}`);
  if (!LEAN) console.log('  (--lean omits the downloadable data entirely)');
}

build();
