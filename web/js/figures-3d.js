/*
 * figures-3d.js — the three-dimensional extension: the reference zero plane in
 * normal coordinates, and the height constraint imposed by curvature.
 */
(function (global) {
  'use strict';

  const {
    createFigure,
    drawGroundTiles,
    drawObserver,
    formatDegrees,
  } = global.FigureKit;

  const { PARAMS, PROFILE_SLOT, model } = global.TsunamiModel;
  const { withAlpha } = global.Viz;

  const figures = {};

  /* A small deterministic skyline, so the cross-section has something in it. */
  const BUILDINGS = (() => {
    const list = [];
    let seed = 20250324;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    let position = 25;
    while (position < PARAMS.worldRadius - 20) {
      const width = 12 + random() * 26;
      const height = 14 + random() * 46;
      const depth = random() < 0.35 ? -(6 + random() * 16) : 0;
      list.push({ from: position, to: position + width, height, depth });
      position += width + 12 + random() * 34;
    }
    return list;
  })();

  /* ================================================================ *
   * the reference zero plane
   * ================================================================ */

  figures['zero-plane'] = (slot) =>
    createFigure(slot, {
      title: 'The reference zero plane and normal coordinates',
      note:
        'A vertical cross-section through the world. Every point keeps its signed height q above the zero plane ' +
        'and is placed along the normal of the transformed surface, so object heights are preserved while ' +
        'tangential distances are compressed on one side of the profile and expanded on the other. Move the zero ' +
        'plane to redistribute the deformation between the two sides.',
      local: { h0: 0, showNormals: true },
      controls: [
        {
          type: 'range',
          id: 'h0',
          label: 'zero plane h₀',
          min: -40,
          max: 70,
          step: 5,
          format: (value) => `${value.toFixed(0)} m`,
        },
        { type: 'checkbox', id: 'showNormals', label: 'show normals' },
      ],
      columns: 2,
      panels: [
        {
          key: 'before',
          title: 'Before the transformation',
          aspect: 0.55,
          margin: { top: 14, right: 16, bottom: 34, left: 46 },
          draw: drawZeroPlaneBefore,
        },
        {
          key: 'after',
          title: 'After the transformation',
          aspect: 0.55,
          equalAspect: false,
          margin: { top: 14, right: 16, bottom: 34, left: 46 },
          draw: drawZeroPlaneAfter,
        },
      ],
      legend: [
        { label: 'zero plane', color: 'var(--accent)' },
        { label: 'above the zero plane (q > 0)', color: 'var(--series-2)', kind: 'square' },
        { label: 'below the zero plane (q < 0)', color: 'var(--series-1)', kind: 'square' },
        { label: 'surface normals', color: 'var(--text-muted)', kind: 'dashed' },
        {
          label: 'uplifted ground',
          color: (current) => `var(--series-${PROFILE_SLOT[current.profile] + 1})`,
        },
      ],
      caption:
        'the normal-coordinate construction with the zero plane at h₀. Placing it near the ' +
        'vertical centre of the world splits the required normal range between the two sides of the curved ' +
        'surface, instead of assigning the whole object height to one side.',
    });

  function drawZeroPlaneBefore(plot, context) {
    const radius = PARAMS.worldRadius;
    const h0 = context.local.h0;
    const theme = plot.theme;

    plot.setDomain(-20, radius + 20, -70, 110);
    plot.axes({ xLabel: 'x  [m]', yLabel: 'z  [m]' });

    plot.clip(() => {
      drawGroundTiles(plot, PARAMS, { from: 0, to: radius, width: 3 });

      for (const building of BUILDINGS) {
        drawBox(
          plot,
          building.from,
          building.to,
          h0,
          building.height,
          theme.series[1],
          0.5
        );
        if (building.depth < 0) {
          drawBox(
            plot,
            building.from,
            building.to,
            h0,
            building.depth,
            theme.series[0],
            0.4
          );
        }
      }

      plot.line(0, h0, radius, h0, { color: theme.accent, width: 2 });
    });

    plot.label(radius, h0, 'zero plane', {
      dx: -6,
      dy: -10,
      align: 'right',
      color: theme.accent,
    });
  }

  function drawBox(plot, from, to, base, height, color, alpha) {
    plot.polygon(
      [
        [from, base],
        [to, base],
        [to, base + height],
        [from, base + height],
      ],
      { fill: withAlpha(color, alpha), stroke: withAlpha(color, 0.95), width: 1 }
    );
  }

  function drawZeroPlaneAfter(plot, context) {
    const radius = PARAMS.worldRadius;
    const h0 = context.local.h0;
    const profileName = context.state.profile;
    const profile = model(profileName).at(context.state.alphaW);
    const color = plot.theme.series[PROFILE_SLOT[profileName]];
    const theme = plot.theme;

    // The zero plane at height h0 is itself carried by the profile; points are
    // then offset along the surface normal by their signed height q.
    const place = (distance, q) => {
      const [x, z] = profile.dToXY(distance);
      const t = profile.distanceToT(distance);
      const [nx, nz] = profile.tToNormal(t);
      return [x + (q + h0) * nx, z + (q + h0) * nz];
    };

    const surface = [];
    let maxZ = 0;
    let maxX = 0;
    for (let i = 0; i <= 240; i += 1) {
      const d = (i / 240) * radius;
      const point = place(d, 0);
      surface.push(point);
      maxZ = Math.max(maxZ, point[1]);
      maxX = Math.max(maxX, point[0]);
    }

    const span = Math.max(maxX, maxZ) * 1.12 + 40;
    plot.setDomain(-30, Math.max(span, 160), -80, Math.max(span * 0.62, 140));
    plot.axes({ xLabel: 'x  [m]', yLabel: 'z  [m]' });

    plot.clip(() => {
      // the uplifted ground itself
      const ground = [];
      for (let i = 0; i <= 240; i += 1) {
        ground.push(profile.dToXY((i / 240) * radius));
      }
      plot.polyline(ground, { color: withAlpha(theme.text, 0.3), width: 1.5 });

      if (context.local.showNormals) {
        for (let d = 0; d <= radius; d += 25) {
          const foot = place(d, 0);
          const tip = place(d, 55);
          plot.line(foot[0], foot[1], tip[0], tip[1], {
            color: withAlpha(theme.muted, 0.55),
            dash: [3, 3],
            width: 1,
          });
        }
      }

      for (const building of BUILDINGS) {
        drawNormalBox(plot, place, building.from, building.to, 0, building.height, theme.series[1], 0.5);
        if (building.depth < 0) {
          drawNormalBox(plot, place, building.from, building.to, 0, building.depth, theme.series[0], 0.4);
        }
      }

      plot.polyline(surface, { color: theme.accent, width: 2 });
    });

    drawObserver(plot, PARAMS.observerHeight, {
      color: theme.critical,
      label: false,
      radius: 3.5,
    });
    plot.labelPx(
      plot.margin.left + 8,
      plot.margin.top + 12,
      `${profileName} · α′_w = ${context.state.alphaW.toFixed(0)}° · h₀ = ${h0.toFixed(0)} m`,
      { color, haloColor: theme.surface }
    );
  }

  /** A box whose sides follow the normals of the transformed surface. */
  function drawNormalBox(plot, place, from, to, base, height, color, alpha) {
    const steps = 6;
    const points = [];
    for (let i = 0; i <= steps; i += 1) {
      points.push(place(from + ((to - from) * i) / steps, base));
    }
    for (let i = steps; i >= 0; i -= 1) {
      points.push(place(from + ((to - from) * i) / steps, base + height));
    }
    plot.polygon(points, {
      fill: withAlpha(color, alpha),
      stroke: withAlpha(color, 0.95),
      width: 1,
    });
  }

  /* ================================================================ *
   * the curvature band
   * ================================================================ */

  figures['curvature-band'] = (slot) =>
    createFigure(slot, {
      title: 'Where tall objects still fit',
      note:
        'At each point of the uplifted profile a band of width min(h_w, η·R) is drawn along the normal, where R ' +
        'is the local radius of curvature. Green means the full world height h_w fits without neighbouring ' +
        'normals crossing; red means the band had to be cut back because the profile bends too sharply.',
      local: { worldHeight: PARAMS.worldHeight, eta: PARAMS.safetyFactor },
      controls: [
        {
          type: 'range',
          id: 'worldHeight',
          label: 'world height h_w',
          min: 5,
          max: 160,
          step: 5,
          format: (value) => `${value.toFixed(0)} m`,
        },
        {
          type: 'range',
          id: 'eta',
          label: 'safety factor η',
          min: 0.1,
          max: 0.99,
          step: 0.01,
          format: (value) => value.toFixed(2),
        },
      ],
      columns: 1,
      rows: [
        {
          columns: 1,
          panels: [
            {
              key: 'band',
              title: 'Admissible height band along the profile',
              aspect: 0.42,
              margin: { top: 14, right: 18, bottom: 34, left: 50 },
              draw: drawCurvatureBand,
              hover: hoverCurvature,
            },
          ],
        },
        {
          columns: 1,
          panels: [
            {
              key: 'radius',
              title: 'Local safe height η/κ against the world height',
              aspect: 0.3,
              margin: { top: 14, right: 18, bottom: 38, left: 56 },
              draw: drawSafeHeight,
              hover: hoverCurvature,
            },
          ],
        },
      ],
      legend: [
        { label: 'full world height fits', color: 'var(--status-good)' },
        { label: 'band reduced by curvature', color: 'var(--status-critical)' },
        { label: 'uplifted profile', color: 'var(--text-primary)' },
        { label: 'world height h_w', color: 'var(--text-muted)', kind: 'dashed' },
      ],
      caption:
        'as the uplift grows the curvature radius falls, particularly in the strongly bent parts ' +
        'of the profile, and the admissible band narrows. Where the band is red, the rigid-height model would ' +
        'push points onto the local focal surface and additional height compression is required.',
      table: (context) => {
        const profile = model(context.state.profile).at(context.state.alphaW);
        const rows = [];
        for (let d = 0; d <= PARAMS.worldRadius; d += 50) {
          const curvature = profile.curvatureAtDistance(d);
          const radius = curvature < 1e-14 ? Infinity : 1 / curvature;
          const safe = context.local.eta * radius;
          rows.push([
            `${d}`,
            isFinite(radius) ? radius.toFixed(1) : '∞',
            isFinite(safe) ? safe.toFixed(1) : '∞',
            safe >= context.local.worldHeight ? 'fits' : 'reduced',
          ]);
        }
        return {
          columns: ['s [m]', 'R [m]', 'η·R [m]', 'verdict'],
          rows,
        };
      },
    });

  /** Profile samples with the normal-offset band edges. */
  function bandGeometry(profile, worldHeight, eta, samples = 260) {
    const radius = PARAMS.worldRadius;
    const points = [];
    for (let i = 0; i <= samples; i += 1) {
      const d = (i / samples) * radius;
      const t = profile.distanceToT(d);
      const [x, z] = profile.tToXY(t);
      const [nx, nz] = profile.tToNormal(t);
      const curvature = profile.curvatureAtT(t);
      const curvatureRadius = curvature < 1e-14 ? Infinity : 1 / curvature;
      const safe = eta * curvatureRadius;
      const width = Math.min(worldHeight, safe);
      points.push({
        d,
        x,
        z,
        nx,
        nz,
        width,
        safe,
        curvatureRadius,
        reduced: safe < worldHeight,
      });
    }
    return points;
  }

  function drawCurvatureBand(plot, context) {
    const radius = PARAMS.worldRadius;
    const profileName = context.state.profile;
    const profile = model(profileName).at(context.state.alphaW);
    const theme = plot.theme;
    const points = bandGeometry(profile, context.local.worldHeight, context.local.eta);

    let maxX = 0;
    let maxZ = 0;
    for (const point of points) {
      maxX = Math.max(maxX, point.x + point.width * Math.abs(point.nx));
      maxZ = Math.max(maxZ, point.z + point.width * Math.abs(point.nz));
    }

    plot.setDomain(-30, Math.max(maxX * 1.06, 120), -40, Math.max(maxZ * 1.1, 120));
    plot.axes({ xLabel: 'x  [m]', yLabel: 'z  [m]' });

    plot.clip(() => {
      // The band is filled in runs of equal verdict so the colour change lands
      // exactly where the constraint starts biting.
      let start = 0;
      for (let i = 1; i <= points.length; i += 1) {
        const last = i === points.length;
        if (!last && points[i].reduced === points[start].reduced) continue;
        const run = points.slice(start, Math.min(points.length, i + 1));
        if (run.length > 1) {
          const polygon = run.map((point) => [point.x, point.z]);
          for (let k = run.length - 1; k >= 0; k -= 1) {
            polygon.push([
              run[k].x + run[k].width * run[k].nx,
              run[k].z + run[k].width * run[k].nz,
            ]);
          }
          const reduced = points[start].reduced;
          plot.polygon(polygon, {
            fill: withAlpha(reduced ? theme.critical : theme.good, reduced ? 0.22 : 0.16),
            stroke: withAlpha(reduced ? theme.critical : theme.good, 0.9),
            width: 1.5,
          });
        }
        start = i;
      }

      plot.polyline(
        points.map((point) => [point.x, point.z]),
        { color: theme.text, width: 2 }
      );
    });

    drawObserver(plot, PARAMS.observerHeight, {
      color: theme.critical,
      label: false,
      radius: 3.5,
    });

    const reducedCount = points.filter((point) => point.reduced).length;
    plot.labelPx(
      plot.margin.left + 8,
      plot.margin.top + 12,
      `${profileName} · α′_w = ${context.state.alphaW.toFixed(0)}° · ${
        reducedCount === 0
          ? 'the full height fits everywhere'
          : `${((100 * reducedCount) / points.length).toFixed(0)}% of the profile is constrained`
      }`,
      { color: reducedCount === 0 ? theme.good : theme.critical, haloColor: theme.surface }
    );
  }

  function drawSafeHeight(plot, context) {
    const radius = PARAMS.worldRadius;
    const profile = model(context.state.profile).at(context.state.alphaW);
    const theme = plot.theme;
    const worldHeight = context.local.worldHeight;
    const points = bandGeometry(profile, worldHeight, context.local.eta, 200);

    let maxSafe = worldHeight * 1.6;
    for (const point of points) {
      if (isFinite(point.safe)) {
        maxSafe = Math.max(maxSafe, Math.min(point.safe, worldHeight * 6));
      }
    }
    // headroom so a constant-curvature profile does not sit on the frame
    maxSafe *= 1.12;

    plot.setDomain(0, radius, 0, maxSafe);
    plot.axes({
      xLabel: 'ground distance s  [m]',
      yLabel: 'height  [m]',
    });

    plot.clip(() => {
      plot.line(0, worldHeight, radius, worldHeight, {
        color: theme.muted,
        dash: [5, 4],
        width: 1.5,
      });

      const safeCurve = points.map((point) => [
        point.d,
        isFinite(point.safe) ? Math.min(point.safe, maxSafe * 1.2) : maxSafe * 1.2,
      ]);
      plot.polyline(safeCurve, { color: theme.good, width: 2.25 });

      // mark the constrained stretch on the axis
      for (let i = 1; i < points.length; i += 1) {
        if (!points[i].reduced) continue;
        plot.line(points[i - 1].d, 0, points[i].d, 0, {
          color: theme.critical,
          width: 4,
        });
      }
    });

    plot.label(radius, worldHeight, 'h_w', {
      dx: -6,
      dy: -9,
      align: 'right',
      color: theme.muted,
    });
    plot.label(radius * 0.5, maxSafe * 0.92, 'η / κ', {
      align: 'center',
      color: theme.good,
    });
  }

  function hoverCurvature(point, context) {
    const radius = PARAMS.worldRadius;
    const d = Math.min(radius, Math.max(0, point.x));
    const profile = model(context.state.profile).at(context.state.alphaW);
    const curvature = profile.curvatureAtDistance(d);
    const curvatureRadius = curvature < 1e-14 ? Infinity : 1 / curvature;
    const safe = context.local.eta * curvatureRadius;
    return (
      `<div class="tip-title">s = ${d.toFixed(0)} m</div>` +
      `<div class="tip-row"><span>curvature κ</span><strong>${curvature.toExponential(2)} 1/m</strong></div>` +
      `<div class="tip-row"><span>radius R</span><strong>${
        isFinite(curvatureRadius) ? `${curvatureRadius.toFixed(0)} m` : '∞'
      }</strong></div>` +
      `<div class="tip-row"><span>safe height η·R</span><strong>${
        isFinite(safe) ? `${safe.toFixed(0)} m` : '∞'
      }</strong></div>` +
      `<div class="tip-row"><span>${
        safe >= context.local.worldHeight ? 'full height fits' : 'band reduced'
      }</span></div>`
    );
  }

  global.Figures3D = figures;
})(typeof globalThis !== 'undefined' ? globalThis : this);
