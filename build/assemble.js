/*
 * Assembles web/index.html from the template, the converted appendix text and
 * the scripts, and also emits a single self-contained file with the CSS, JS
 * and KaTeX fonts inlined.
 *
 * This covers the appendix alone. build/bundle.js folds all three pages of the
 * site into one offline file.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const {
  WEB,
  SCRIPTS,
  STYLES,
  read,
  usedFontFamilies,
  inlineStyles,
  inlineScripts,
} = require('./inline');

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

  const bundle = template
    .replace('<!--STYLES-->', inlineStyles(families))
    .replace('<!--CONTENT-->', content)
    .replace('<!--SCRIPTS-->', inlineScripts());
  fs.writeFileSync(path.join(WEB, 'appendix.html'), bundle, 'utf8');

  const size = (value) => `${(Buffer.byteLength(value) / 1024).toFixed(0)} KB`;
  console.log(`web/index.html     ${size(page)}  (linked assets)`);
  console.log(`web/appendix.html  ${size(bundle)}  (self-contained, fonts: ${[...families].join(', ')})`);
}

build();
