/*
 * Assembles web/index.html from the template, the converted appendix text and
 * the scripts, and also emits a single self-contained file with the CSS, JS
 * and KaTeX fonts inlined.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WEB = path.join(ROOT, 'web');

const SCRIPTS = [
  'js/tsunami.js',
  'js/plot.js',
  'js/model.js',
  'js/figure-kit.js',
  'js/figures-1d.js',
  'js/figures-2d.js',
  'js/figures-3d.js',
  'js/app.js',
];

const STYLES = ['vendor/katex/katex.min.css', 'css/style.css'];

function read(relative) {
  return fs.readFileSync(path.join(WEB, relative), 'utf8');
}

/** Inlines the KaTeX web fonts that the rendered content actually uses. */
function inlineKatexFonts(css, usedFamilies) {
  const fontDir = path.join(WEB, 'vendor', 'katex', 'fonts');
  return css.replace(
    /url\(fonts\/(KaTeX_[A-Za-z0-9-]+)\.(woff2|woff|ttf)\)\s*format\("(woff2|woff|truetype)"\)/g,
    (match, name, extension) => {
      if (extension !== 'woff2') return 'local("__none__")';
      const family = name.split('_')[1].split('-')[0];
      if (usedFamilies && !usedFamilies.has(family)) return 'local("__none__")';
      const file = path.join(fontDir, `${name}.woff2`);
      if (!fs.existsSync(file)) return match;
      const base64 = fs.readFileSync(file).toString('base64');
      return `url(data:font/woff2;base64,${base64}) format("woff2")`;
    }
  );
}

/** KaTeX marks each glyph run with the font family it needs. */
function usedFontFamilies(html) {
  const families = new Set(['Main', 'Math', 'Size1', 'Size2', 'Size3', 'Size4']);
  const classes = html.match(/class="[^"]*"/g) || [];
  for (const value of classes) {
    if (value.includes('amsrm')) families.add('AMS');
    if (value.includes('mathcal') || value.includes('mathscr')) families.add('Caligraphic');
    if (value.includes('mathfrak')) families.add('Fraktur');
    if (value.includes('mathsf')) families.add('SansSerif');
    if (value.includes('mathtt')) families.add('Typewriter');
    if (value.includes('mathbb')) families.add('AMS');
  }
  return families;
}

function build() {
  const template = read('template.html');
  const content = read('content.html');

  // --- multi-file page -------------------------------------------------
  const linkedStyles = STYLES.map(
    (href) => `<link rel="stylesheet" href="${href}">`
  ).join('\n');
  const linkedScripts = SCRIPTS.map((src) => `<script src="${src}"></script>`).join('\n');

  const page = template
    .replace('<!--STYLES-->', linkedStyles)
    .replace('<!--CONTENT-->', content)
    .replace('<!--SCRIPTS-->', linkedScripts);
  fs.writeFileSync(path.join(WEB, 'index.html'), page, 'utf8');

  // --- single self-contained file --------------------------------------
  const families = usedFontFamilies(content);
  const inlineStyles = STYLES.map((href) => {
    let css = read(href);
    if (href.includes('katex')) css = inlineKatexFonts(css, families);
    return `<style>\n${css}\n</style>`;
  }).join('\n');
  const inlineScripts = SCRIPTS.map(
    (src) => `<script>\n${read(src)}\n</script>`
  ).join('\n');

  const bundle = template
    .replace('<!--STYLES-->', inlineStyles)
    .replace('<!--CONTENT-->', content)
    .replace('<!--SCRIPTS-->', inlineScripts);
  fs.writeFileSync(path.join(WEB, 'appendix.html'), bundle, 'utf8');

  const size = (value) => `${(Buffer.byteLength(value) / 1024).toFixed(0)} KB`;
  console.log(`web/index.html     ${size(page)}  (linked assets)`);
  console.log(`web/appendix.html  ${size(bundle)}  (self-contained, fonts: ${[...families].join(', ')})`);
}

build();
