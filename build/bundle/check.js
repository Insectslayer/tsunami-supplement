/*
 * Verifies the bundle the way a reviewer meets it: the file alone in a directory
 * with nothing beside it, opened over file:// by a browser that was given no
 * extra permissions. Copies it to a scratch directory first so that a sibling
 * file cannot rescue a broken reference.
 *
 *   node build/bundle/check.js
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const BUNDLE = path.join(__dirname, 'supplement.html');

const VIEWS = ['appendix', 'quantitative-results', 'qualitative-results'];

(async () => {
  if (!fs.existsSync(BUNDLE)) {
    console.error('supplement.html not found — run: node build/bundle/bundle.js');
    process.exit(1);
  }

  // Isolate the file so nothing can load from a sibling path.
  const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'supplement-'));
  const target = path.join(isolated, 'supplement.html');
  fs.copyFileSync(BUNDLE, target);

  const puppeteer = (await import('puppeteer')).default;
  // No --allow-file-access-from-files: this is a stock browser on a file:// URL.
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--font-render-hinting=none'],
    // The scroll pass walks three long views on a multi-megabyte page; the
    // 180 s default is not enough once the embedded notebook is included.
    protocolTimeout: 600000,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });

  const problems = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      problems.push(`[${message.type()}] ${message.text().slice(0, 200)}`);
    }
  });
  page.on('pageerror', (error) => problems.push(`[pageerror] ${error.message.slice(0, 200)}`));
  page.on('requestfailed', (request) =>
    problems.push(
      `[requestfailed] ${request.url().slice(0, 80)} — ${request.failure().errorText}`
    )
  );

  const started = Date.now();
  await page.goto(pathToFileURL(target).href, { waitUntil: 'load', timeout: 120000 });
  await page.waitForSelector('body[data-ready="true"]', { timeout: 60000 });
  console.log(
    `loaded supplement.html (${(fs.statSync(target).size / 1024 / 1024).toFixed(2)} MB) in ${
      Date.now() - started
    } ms, isolated in ${isolated}`
  );

  const structure = await page.evaluate((expected) => {
    const views = [...document.querySelectorAll('.view[data-view]')].map((v) => v.dataset.view);
    const visible = [...document.querySelectorAll('.view[data-view]')]
      .filter((v) => !v.hidden)
      .map((v) => v.dataset.view);
    const ids = [...document.querySelectorAll('[id]')].map((n) => n.id);
    const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    return {
      views,
      missing: expected.filter((name) => !views.includes(name)),
      visible,
      duplicateIds: duplicates,
      mode: document.body.dataset.bundle || 'full',
      // Anything in the body that is not the nav, a view or a script means
      // embedded data escaped its <script> and was parsed as markup.
      strayBodyChildren: [...document.body.children]
        .filter((n) => !n.matches('nav.site-nav, section.view, script, dialog.lightbox'))
        .map((n) => n.tagName.toLowerCase())
        .slice(0, 6),
      documentHeight: document.documentElement.scrollHeight,
      navLinks: document.querySelectorAll('.site-nav a[data-view-link]').length,
      // A download link keeps its relative href as a fallback and is swapped
      // for a blob on first interaction, so it does not count as unresolved.
      relativeAssets: [...document.querySelectorAll('[src],[href]')]
        .filter((n) => !n.dataset.download)
        .map((n) => n.getAttribute('src') || n.getAttribute('href'))
        .filter((v) => v && /^(materials|downloads|css|js|vendor)\//.test(v)),
    };
  }, VIEWS);

  console.log(`build: ${structure.mode}`);
  console.log(`views: ${structure.views.join(', ')}`);
  console.log(`visible at load: ${structure.visible.join(', ') || 'none'}`);
  console.log(`nav links: ${structure.navLinks}`);
  console.log(`duplicate ids: ${structure.duplicateIds.length ? structure.duplicateIds.join(', ') : 'none'}`);
  console.log(
    `unresolved relative asset refs: ${
      structure.relativeAssets.length
        ? structure.relativeAssets.slice(0, 5).join(', ')
        : 'none'
    }`
  );
  // The lean build deliberately leaves the per-file downloads as relative links
  // and ships only the ZIP, so there it is a documented limitation, not a fault.
  if (structure.relativeAssets.length) {
    const message = `${structure.relativeAssets.length} asset refs still point at sibling files`;
    if (structure.mode === 'lean') console.log(`  expected in a --lean build: ${message}`);
    else problems.push(message);
  }
  console.log(`document height: ${structure.documentHeight} px`);
  if (structure.strayBodyChildren.length) {
    problems.push(
      `stray elements in body (embedded data broke out of its script): ${structure.strayBodyChildren.join(', ')}`
    );
  }
  if (structure.missing.length) problems.push(`missing views: ${structure.missing.join(', ')}`);
  if (structure.visible.length !== 1) problems.push(`${structure.visible.length} views visible at load`);
  if (structure.duplicateIds.length) problems.push(`duplicate ids: ${structure.duplicateIds.join(', ')}`);

  /* --- each view ---------------------------------------------------- */
  for (const name of VIEWS) {
    await page.evaluate((view) => {
      document.querySelector(`.site-nav a[data-view-link="${view}"]`).click();
    }, name);
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Scroll the view so every figure is observed and drawn.
    await page.evaluate(async () => {
      document.documentElement.style.scrollBehavior = 'auto';
      // Capped: a correct document is tens of thousands of pixels, and without
      // a limit a runaway one turns this walk into a several-minute crawl.
      const height = Math.min(document.body.scrollHeight, 120000);
      for (let y = 0; y < height; y += 420) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 90));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 400));
    });

    const report = await page.evaluate((view) => {
      const root = document.querySelector(`.view[data-view="${view}"]`);
      let canvases = 0;
      let blank = 0;
      root.querySelectorAll('canvas').forEach((canvas) => {
        canvases += 1;
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let varied = false;
        for (let i = 4; i < data.length; i += 4 * 97) {
          if (
            Math.abs(data[i] - data[0]) > 3 ||
            Math.abs(data[i + 1] - data[1]) > 3 ||
            Math.abs(data[i + 2] - data[2]) > 3
          ) {
            varied = true;
            break;
          }
        }
        if (!varied) blank += 1;
      });
      const images = [...root.querySelectorAll('img')];
      return {
        canvases,
        blank,
        images: images.length,
        brokenImages: images.filter((img) => !img.complete || img.naturalWidth === 0).length,
        tocLinks: root.querySelectorAll('.toc a').length,
        svgCharts: root.querySelectorAll('.interactive-chart svg').length,
        katex: root.querySelectorAll('.katex').length,
      };
    }, name);

    console.log(
      `\n${name}\n  canvases ${report.canvases} (blank ${report.blank})` +
        `  images ${report.images} (broken ${report.brokenImages})` +
        `  toc ${report.tocLinks}  interactive-svg ${report.svgCharts}  katex ${report.katex}`
    );
    if (report.blank) problems.push(`${name}: ${report.blank} blank canvases`);
    if (report.brokenImages) problems.push(`${name}: ${report.brokenImages} broken images`);
    if (!report.tocLinks) problems.push(`${name}: contents rail empty`);
  }

  /* --- dataset previews ---------------------------------------------- */
  // supplement.py renders these tables into the markup, so the check is that
  // the button reveals a populated table — nothing is loaded at click time.
  const previews = await page.evaluate(async () => {
    const results = [];
    const buttons = [...document.querySelectorAll('.preview-button[aria-controls]')];
    for (const button of buttons) {
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      if (!panel) {
        results.push({ id: button.getAttribute('aria-controls'), rows: 0, missing: true });
        continue;
      }
      button.click();
      await new Promise((r) => setTimeout(r, 60));
      results.push({
        id: button.getAttribute('aria-controls'),
        rows: panel.querySelectorAll('tbody tr').length,
        columns: panel.querySelectorAll('thead th').length,
        visible: !panel.hidden,
        note: (panel.querySelector('.preview-note') || {}).textContent || '',
      });
      button.click();
      await new Promise((r) => setTimeout(r, 20));
    }
    return results;
  });

  const badPreviews = previews.filter((p) => p.missing || !p.visible || !p.rows);
  console.log(`\ndataset previews: ${previews.length} tested, ${badPreviews.length} broken`);
  previews.slice(0, 3).forEach((p) =>
    console.log(`  ${p.id}: ${p.rows}x${p.columns} — ${String(p.note).slice(0, 70)}`)
  );
  if (previews.length > 3) console.log(`  … ${previews.length - 3} more`);
  badPreviews.forEach((p) =>
    problems.push(`preview broken: ${p.id} (${p.missing ? 'no panel' : `${p.rows} rows, visible=${p.visible}`})`)
  );
  if (!previews.length) problems.push('no dataset preview buttons found');

  /* --- embedded downloads -------------------------------------------- */
  const downloads = await page.evaluate(() => {
    const anchors = [...document.querySelectorAll('[data-download]')];
    const store = window.SUPPLEMENT_FILES || {};
    const unbacked = anchors.map((a) => a.dataset.download).filter((key) => !store[key]);
    // Drive the real path: a pointerdown must turn the href into a blob, which
    // is what makes both left-click and "Save link as" work.
    let blobOk = false;
    let named = null;
    const anchor = anchors.find((a) => store[a.dataset.download]);
    if (anchor) {
      anchor.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      blobOk = anchor.getAttribute('href').startsWith('blob:');
      named = anchor.getAttribute('download');
    }
    return { anchors: anchors.length, stored: Object.keys(store).length, unbacked, blobOk, named };
  });
  console.log(
    `\ndownloads: ${downloads.anchors} links, ${downloads.stored} files embedded, ` +
      `href becomes blob on interaction: ${downloads.blobOk ? `ok (saves as ${downloads.named})` : 'FAILED'}`
  );
  if (downloads.unbacked.length) {
    console.log(`  not embedded (fall back to relative link): ${downloads.unbacked.length}`);
  }
  if (downloads.anchors && !downloads.blobOk) problems.push('blob download path failed');

  /* --- deep link into a hidden view ---------------------------------- */
  const deepLink = await page.evaluate(async () => {
    const target = document.querySelector('.view[data-view="qualitative-results"] h3[id]');
    if (!target) return 'no target heading';
    document.querySelector('.site-nav a[data-view-link="appendix"]').click();
    await new Promise((r) => setTimeout(r, 200));
    location.hash = `#${target.id}`;
    await new Promise((r) => setTimeout(r, 600));
    const view = document.querySelector('.view[data-view="qualitative-results"]');
    return view.hidden ? `FAILED: view still hidden for #${target.id}` : `ok (#${target.id})`;
  });
  console.log(`deep link into hidden view: ${deepLink}`);
  if (deepLink.startsWith('FAILED')) problems.push(deepLink);

  /* --- lightbox ------------------------------------------------------- */
  const lightbox = await page.evaluate(async () => {
    document.querySelector('.site-nav a[data-view-link="quantitative-results"]').click();
    await new Promise((r) => setTimeout(r, 300));
    const image = document.querySelector('.result-figure img');
    if (!image) return 'no figure images';
    image.click();
    await new Promise((r) => setTimeout(r, 300));
    const dialog = document.querySelector('dialog.lightbox');
    const open = dialog && dialog.open && dialog.querySelector('img').src.startsWith('data:');
    if (dialog && dialog.open) dialog.close();
    return open ? 'ok' : 'FAILED to open';
  });
  console.log(`figure lightbox: ${lightbox}`);
  if (lightbox.startsWith('FAILED')) problems.push(`lightbox ${lightbox}`);

  await browser.close();
  fs.rmSync(isolated, { recursive: true, force: true });

  console.log(`\nproblems: ${problems.length}`);
  problems.forEach((problem) => console.log(`  ${problem}`));
  process.exitCode = problems.length ? 1 : 0;
})();
