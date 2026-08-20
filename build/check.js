/*
 * Loads web/index.html in headless Chrome, exercises the controls, and reports
 * console errors plus a per-figure render summary. Screenshots go to
 * build/screenshots/.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const TARGET = process.env.PAGE || 'index.html';
const PAGE = pathToFileURL(path.join(ROOT, 'web', TARGET)).href;
const SHOTS = path.join(__dirname, 'screenshots');

const only = process.argv[2];

(async () => {
  const puppeteer = (await import('puppeteer')).default;
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--allow-file-access-from-files', '--font-render-hinting=none'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 2 });

  const problems = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      problems.push(`[${message.type()}] ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => problems.push(`[pageerror] ${error.message}`));
  page.on('requestfailed', (request) =>
    problems.push(`[requestfailed] ${request.url()} — ${request.failure().errorText}`)
  );

  const started = Date.now();
  await page.goto(PAGE, { waitUntil: 'networkidle0', timeout: 120000 });
  await page.waitForSelector('body[data-ready="true"]', { timeout: 60000 });
  console.log(`loaded ${TARGET} in ${Date.now() - started} ms`);

  // Scroll through the whole document so every figure becomes visible and draws.
  await page.evaluate(async () => {
    // The page opts into smooth scrolling; instant jumps are needed here or the
    // viewport never actually reaches the lower figures.
    document.documentElement.style.scrollBehavior = 'auto';
    const height = document.body.scrollHeight;
    for (let y = 0; y < height; y += 420) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 130));
    }
    window.scrollTo(0, 0);
    await new Promise((resolve) => setTimeout(resolve, 400));
  });

  // Report on every canvas: is it blank?
  const report = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('.fig-slot[data-figure]').forEach((slot) => {
      const canvases = [...slot.querySelectorAll('canvas')];
      const blank = [];
      canvases.forEach((canvas, index) => {
        const ctx = canvas.getContext('2d');
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const first = [data[0], data[1], data[2]];
        let varied = false;
        for (let i = 4; i < data.length; i += 4 * 97) {
          if (
            Math.abs(data[i] - first[0]) > 3 ||
            Math.abs(data[i + 1] - first[1]) > 3 ||
            Math.abs(data[i + 2] - first[2]) > 3
          ) {
            varied = true;
            break;
          }
        }
        if (!varied) blank.push(index);
      });
      results.push({
        figure: slot.dataset.figure,
        canvases: canvases.length,
        blank,
        height: Math.round(slot.getBoundingClientRect().height),
      });
    });
    return results;
  });

  console.log('\nfigure                canvases  blank  height');
  for (const row of report) {
    const flag = row.blank.length ? `  <-- BLANK ${row.blank.join(',')}` : '';
    console.log(
      `${row.figure.padEnd(22)}${String(row.canvases).padStart(5)}${String(
        row.blank.length
      ).padStart(7)}${String(row.height).padStart(8)}${flag}`
    );
  }

  // Cross-references: every @@ref@@ link must land on something in the page.
  const refs = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a.xref')];
    const dangling = links
      .filter((link) => !document.getElementById(link.getAttribute('href').slice(1)))
      .map((link) => `${link.textContent} -> ${link.getAttribute('href')}`);
    return { total: links.length, dangling };
  });
  console.log(
    `\ncross-references: ${refs.total} links, ` +
      (refs.dangling.length ? `dangling: ${refs.dangling.join(', ')}` : 'all resolve')
  );
  if (refs.dangling.length) {
    problems.push(`[xref] dangling: ${refs.dangling.join(', ')}`);
  }

  // Exercise the global controls.
  const timings = await page.evaluate(async () => {
    const results = {};
    const slider = document.getElementById('global-uplift');
    const set = (value) => {
      slider.value = value;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const t0 = performance.now();
    for (const value of [90, 110, 130, 150, 170]) {
      set(value);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    results.sliderMs = (performance.now() - t0) / 5;

    const buttons = [...document.querySelectorAll('#controlbar .segmented button')];
    results.profiles = [];
    for (const button of buttons) {
      const t1 = performance.now();
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 700));
      results.profiles.push({
        name: button.textContent.trim(),
        ms: Math.round(performance.now() - t1),
      });
    }
    return results;
  });

  console.log(`\nuplift slider: ${timings.sliderMs.toFixed(0)} ms per step (visible figures)`);
  console.log(
    `profile switch: ${timings.profiles.map((p) => `${p.name} ${p.ms}ms`).join(', ')}`
  );

  // Dark mode: flip the theme and confirm every canvas still renders.
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    globalThis.TsunamiModel.redrawAll();
  });
  await new Promise((resolve) => setTimeout(resolve, 900));
  const darkReport = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('.fig-slot[data-figure]').forEach((slot) => {
      let blank = 0;
      slot.querySelectorAll('canvas').forEach((canvas) => {
        const data = canvas
          .getContext('2d')
          .getImageData(0, 0, canvas.width, canvas.height).data;
        const first = [data[0], data[1], data[2]];
        let varied = false;
        for (let i = 4; i < data.length; i += 4 * 97) {
          if (
            Math.abs(data[i] - first[0]) > 3 ||
            Math.abs(data[i + 1] - first[1]) > 3 ||
            Math.abs(data[i + 2] - first[2]) > 3
          ) {
            varied = true;
            break;
          }
        }
        if (!varied) blank += 1;
      });
      if (blank) results.push(`${slot.dataset.figure}: ${blank} blank`);
    });
    return results;
  });
  console.log(
    `
dark mode: ${darkReport.length ? darkReport.join(', ') : 'all canvases render'}`
  );
  if (process.env.SHOT_DARK) {
    const darkSlots = await page.$$('.fig-slot[data-figure]');
    for (const slot of darkSlots) {
      const name = await slot.evaluate((node) => node.dataset.figure);
      if (only && name !== only) continue;
      await slot.scrollIntoView();
      await new Promise((resolve) => setTimeout(resolve, 400));
      await slot.screenshot({ path: path.join(SHOTS, `dark-${name}.png`) });
    }
  }
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    globalThis.TsunamiModel.redrawAll();
  });
  await new Promise((resolve) => setTimeout(resolve, 700));

  // Screenshots
  const slots = await page.$$('.fig-slot[data-figure]');
  for (const slot of slots) {
    const name = await slot.evaluate((node) => node.dataset.figure);
    if (only && name !== only) continue;
    await slot.scrollIntoView();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await slot.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  }
  await page.screenshot({ path: path.join(SHOTS, '_top.png') });

  // Wide viewport: the contents rail must not reach the figures.
  await page.setViewport({ width: 1700, height: 1100, deviceScaleFactor: 1 });
  await new Promise((resolve) => setTimeout(resolve, 500));
  const railOverlap = await page.evaluate(() => {
    const rail = document.getElementById('toc');
    if (!rail || getComputedStyle(rail).display === 'none') return 'rail hidden';
    const railBox = rail.getBoundingClientRect();
    let worst = null;
    document.querySelectorAll('.fig-slot').forEach((slot) => {
      const box = slot.getBoundingClientRect();
      const overlap = box.right - railBox.left;
      if (worst === null || overlap > worst) worst = overlap;
    });
    return `rail left ${Math.round(railBox.left)}, widest figure right edge overlap ${Math.round(worst)}px`;
  });
  console.log(`wide viewport: ${railOverlap}`);

  // Narrow viewport: nothing may scroll the page sideways.
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await new Promise((resolve) => setTimeout(resolve, 900));
  const narrow = await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const wide = [];
    document.querySelectorAll('.fig-slot, .paper p, .math-block, table').forEach((node) => {
      if (node.scrollWidth > node.clientWidth + 2 && !node.closest('.math-block, .table-scroll, .fig-slot')) {
        wide.push(node.className || node.tagName);
      }
    });
    // Identify what actually sticks out past the viewport.
    const offenders = [];
    const limit = document.documentElement.clientWidth;
    document.querySelectorAll('body *').forEach((node) => {
      const box = node.getBoundingClientRect();
      if (box.width === 0) return;
      if (box.right > limit + 1) {
        offenders.push(
          `${node.tagName.toLowerCase()}.${(node.className || '').toString().split(' ')[0]} right=${Math.round(box.right)} w=${Math.round(box.width)}`
        );
      }
    });
    return { overflow, wide: wide.slice(0, 5), offenders: offenders.slice(0, 8) };
  });
  console.log(
    `narrow viewport (390px): horizontal overflow ${narrow.overflow}px` +
      (narrow.wide.length ? `, unscrollable wide nodes: ${narrow.wide.join(', ')}` : '')
  );
  narrow.offenders.forEach((line) => console.log(`    ${line}`));
  await page.screenshot({ path: path.join(SHOTS, '_narrow.png'), fullPage: false });
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 2 });

  console.log(`\nproblems: ${problems.length}`);
  problems.slice(0, 40).forEach((problem) => console.log(`  ${problem}`));

  await browser.close();
  if (problems.length) process.exitCode = 1;
})();
