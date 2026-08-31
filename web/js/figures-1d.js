/*
 * figures-1d.js — figures for the notation and the one-dimensional
 * transformations.
 */
(function (global) {
  'use strict';

  const {
    createFigure,
    drawGroundTiles,
    drawTopViewGround,
    drawObserver,
    drawAngleArc,
    renderCameraImage,
    cameraColors,
    formatDegrees,
    formatP,
  } = global.FigureKit;

  const {
    PARAMS,
    PROFILE_NAMES,
    model,
    Camera,
    interpolate,
    LEVEL_MIN,
    LEVEL_MAX,
    toPaperPlane,
  } = global.TsunamiModel;
  const { withAlpha, mixColors } = global.Viz;

  /**
   * Shade of a profile's own hue for an earlier uplift level.
   *
   * Earlier levels deliberately stay in the panel's categorical hue rather than
   * taking the blue sequential ramp: in the parabolic panel a blue ramp is
   * indistinguishable from the parabolic series colour itself.
   */
  function levelShade(plot, name, fraction) {
    const color = plot.theme.series[global.TsunamiModel.PROFILE_SLOT[name]];
    return mixColors(plot.theme.surface, color, 0.22 + 0.45 * fraction);
  }

  const DEG = Math.PI / 180;
  const figures = {};

  function seriesColor(plot, name) {
    return plot.theme.series[global.TsunamiModel.PROFILE_SLOT[name]];
  }

  /** Sampled profile polyline over the modelled world. */
  function profilePoints(profile, samples = 220, radius = PARAMS.worldRadius) {
    const points = [];
    for (let i = 0; i <= samples; i += 1) {
      const d = (i / samples) * radius;
      const [x, z] = profile.dToXY(d);
      points.push([x, z]);
    }
    return points;
  }

  /* ================================================================ *
   * notation
   * ================================================================ */

  figures.notation = (slot) =>
    createFigure(slot, {
      title: 'The observer, the world and the camera',
      note:
        'The geometry of Table 1. Drag the viewing direction α to sweep the camera through the vertical plane; ' +
        'the ray marks P on the original ground and P′ on the uplifted profile, which follows the global uplift ' +
        'slider above.',
      local: { alpha: PARAMS.viewingDirection, azimuth: 0, h: PARAMS.observerHeight },
      controls: [
        {
          type: 'range',
          id: 'alpha',
          label: 'viewing direction α',
          min: 0,
          max: 180,
          step: 1,
          format: formatDegrees,
        },
        {
          type: 'range',
          id: 'azimuth',
          label: 'azimuth φ',
          min: -180,
          max: 180,
          step: 5,
          format: formatDegrees,
        },
        {
          type: 'range',
          id: 'h',
          label: 'observer elevation h',
          min: 10,
          max: 600,
          step: 5,
          format: (value) => `${value.toFixed(0)} m`,
        },
      ],
      rows: [
        {
          columns: 2,
          panels: [
            {
              key: 'side',
              title: 'Side view — the vertical viewing plane',
              aspect: 0.68,
              equalAspect: true,
              xDomain: [-60, 560],
              yDomain: [-36, 810],
              margin: { top: 16, right: 18, bottom: 34, left: 46 },
              draw: drawNotationSide,
              hover: (point) =>
                `<div class="tip-row"><span>x</span><strong>${point.x.toFixed(0)} m</strong></div>` +
                `<div class="tip-row"><span>z</span><strong>${point.y.toFixed(0)} m</strong></div>`,
            },
            {
              key: 'top',
              title: 'Top view — the ground plane',
              aspect: 0.68,
              equalAspect: true,
              margin: { top: 16, right: 18, bottom: 34, left: 46 },
              draw: drawNotationTop,
            },
          ],
        },
        {
          columns: 1,
          panels: [
            {
              key: 'camera',
              title: 'Camera view — the untransformed plane',
              aspect: 0.4,
              margin: { top: 10, right: 10, bottom: 26, left: 10 },
              draw: drawNotationCamera,
            },
          ],
        },
      ],
      legend: [
        { label: 'original ground g(s)', color: 'var(--text-primary)' },
        {
          label: 'uplifted profile g′(s)',
          color: (current) => `var(--series-${global.TsunamiModel.PROFILE_SLOT[current.profile] + 1})`,
        },
        { label: 'viewing ray', color: 'var(--status-critical)' },
        { label: 'field of view', color: 'var(--text-muted)', kind: 'dashed' },
      ],
      caption:
        'a side view of the world, a top-down view of the plane with a square grid, and the camera view. ' +
        'The observer sits at Q = (0, 0, h); α is measured from the downward vertical, so α = 90° looks at the horizon.',
    });

  function drawNotationSide(plot, context) {
    const { local } = context;
    const h = local.h;
    const radius = PARAMS.worldRadius;
    const border = radius * 0.12;

    const profile = context.state.model.at(context.state.alphaW);
    const points = profilePoints(profile);
    let maxZ = h * 1.25;
    for (const [, z] of points) maxZ = Math.max(maxZ, z);

    plot.setDomain(-border, radius + border, -border * 0.6, maxZ * 1.08);
    plot.axes({
      xLabel: 'x  [m]',
      yLabel: 'z  [m]',
    });

    const theme = plot.theme;
    const accent = seriesColor(plot, context.state.profile);

    plot.clip(() => {
      // original ground
      drawGroundTiles(plot, PARAMS, { from: 0, to: radius, width: 4 });
      plot.line(-border, 0, radius + border, 0, {
        color: withAlpha(theme.text, 0.25),
        width: 1,
      });

      // uplifted profile
      plot.polyline(points, { color: accent, width: 2.5 });

      // camera frustum
      const alphaRad = local.alpha * DEG;
      const halfV = camera().halfVFov * DEG;
      const reach = radius * 2.4;
      for (const edge of [alphaRad - halfV, alphaRad + halfV]) {
        plot.line(
          0,
          h,
          Math.sin(edge) * reach,
          h - Math.cos(edge) * reach,
          { color: theme.muted, dash: [4, 4], width: 1.25 }
        );
      }

      // viewing ray and the two corresponding points
      const dirX = Math.sin(alphaRad);
      const dirZ = -Math.cos(alphaRad);
      plot.line(0, h, dirX * reach, h + dirZ * reach, {
        color: theme.critical,
        width: 1.75,
      });

      if (dirZ < 0) {
        const sFlat = (-dirX * h) / dirZ;
        if (sFlat >= 0 && sFlat < radius * 3) {
          plot.marker(sFlat, 0, { color: theme.critical, radius: 4 });
          plot.label(sFlat, 0, 'P', { dx: 6, dy: -12, color: theme.critical });
        }
      }

      const t = profile.tSeenInDirection([dirX, dirZ], h);
      if (isFinite(t)) {
        const [px, pz] = profile.tToXY(t);
        plot.marker(px, pz, { color: accent, radius: 4 });
        plot.label(px, pz, 'P′', { dx: 7, dy: -12, color: accent });
      }

      // world boundary
      plot.marker(radius, 0, { color: theme.text, radius: 3.5 });
      const [bx, bz] = profile.dToXY(radius);
      plot.marker(bx, bz, { color: accent, radius: 3.5 });

      // observer height guide
      plot.line(0, 0, 0, h, { color: theme.axis, dash: [3, 3], width: 1 });
    });

    drawObserver(plot, h, { color: theme.critical });
    plot.label(0, h / 2, 'h', { dx: 7, color: theme.secondary });
    plot.label(0, 0, 'O', { dx: 6, dy: 12, color: theme.secondary });
    plot.label(radius, 0, 'd_w', { dx: -4, dy: 14, align: 'center', color: theme.secondary });

    // alpha arc
    const arcRadius = Math.min(58, plot.plotHeight * 0.32);
    drawAngleArc(
      plot,
      0,
      local.alpha === 0 ? h : h,
      arcRadius,
      -Math.PI / 2,
      -Math.PI / 2 + local.alpha * DEG,
      'α',
      { color: theme.critical, labelColor: theme.critical }
    );
  }

  function drawNotationTop(plot, context) {
    const { local } = context;
    const radius = PARAMS.worldRadius;
    const border = radius * 0.18;
    plot.setDomain(-radius - border, radius + border, -radius - border, radius + border);
    plot.axes({ xLabel: 'x  [m]', yLabel: 'y  [m]' });

    const theme = plot.theme;
    const cam = camera();
    cam.alpha = local.alpha;
    cam.azimuth = local.azimuth;
    cam.h = local.h;

    plot.clip(() => {
      drawTopViewGround(plot, PARAMS);

      const flat = cam.distances('flat');
      const fov = cam.fieldOfView(flat).map(toPaperPlane);
      if (fov.length > 2) {
        plot.polygon(fov, {
          fill: withAlpha(theme.accent, 0.13),
          stroke: theme.accent,
          width: 1.5,
        });
      }

      // azimuth direction: phi is measured from the positive x axis
      const azRad = local.azimuth * DEG;
      plot.line(0, 0, Math.cos(azRad) * radius, Math.sin(azRad) * radius, {
        color: theme.critical,
        dash: [5, 4],
        width: 1.5,
      });
    });

    plot.marker(0, 0, { color: theme.critical, shape: 'star', radius: 4 });
    plot.label(0, 0, 'O = Q', { dx: 9, dy: 10, color: theme.secondary });
    drawAngleArc(plot, 0, 0, 46, 0, local.azimuth * DEG, 'φ', {
      color: theme.critical,
      labelColor: theme.critical,
    });
    plot.label(0, radius, 'd_w', { dy: 13, align: 'center', color: theme.secondary });
  }

  let sharedCamera = null;
  function camera() {
    if (!sharedCamera) sharedCamera = new Camera({ scale: 4 });
    return sharedCamera;
  }

  function drawNotationCamera(plot, context) {
    const { local } = context;
    const cam = camera();
    cam.alpha = local.alpha;
    cam.azimuth = local.azimuth;
    cam.h = local.h;

    const distances = cam.distances('flat');
    const colors = cameraColors(plot.theme, plot.theme.text);
    const image = renderCameraImage(cam, distances, PARAMS, colors);

    // fit the sensor aspect inside the panel
    const sensorAspect = cam.height / cam.width;
    const availableWidth = plot.width - plot.margin.left - plot.margin.right;
    const availableHeight = plot.height - plot.margin.top - plot.margin.bottom;
    let drawWidth = availableWidth;
    let drawHeight = drawWidth * sensorAspect;
    if (drawHeight > availableHeight) {
      drawHeight = availableHeight;
      drawWidth = drawHeight / sensorAspect;
    }
    const left = plot.margin.left + (availableWidth - drawWidth) / 2;
    const top = plot.margin.top + (availableHeight - drawHeight) / 2;

    plot.image(image, { left, top, width: drawWidth, height: drawHeight, smooth: false });

    const ctx = plot.ctx;
    ctx.save();
    ctx.strokeStyle = plot.theme.axis;
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 0.5, top + 0.5, drawWidth - 1, drawHeight - 1);
    ctx.restore();

    // image axes annotation
    plot.labelPx(left + drawWidth / 2, top + drawHeight + 12, 'u  (2N + 1 pixels)', {
      align: 'center',
      color: plot.theme.muted,
      font: `500 10.5px ${global.Viz.fontStack()}`,
    });
    plot.labelPx(left - 6, top + drawHeight / 2, 'v', {
      align: 'right',
      color: plot.theme.muted,
      font: `500 10.5px ${global.Viz.fontStack()}`,
    });
    plot.labelPx(
      left + drawWidth / 2,
      top + drawHeight / 2,
      '+',
      { align: 'center', color: '#7be07b', font: `700 14px ${global.Viz.fontStack()}` }
    );
    plot.labelPx(
      left + 8,
      top + 12,
      `α = ${local.alpha.toFixed(0)}°   VFOV ${(2 * cam.halfVFov).toFixed(0)}°   HFOV ${(2 * cam.halfHFov).toFixed(0)}°`,
      { color: plot.theme.secondary, haloColor: plot.theme.surface }
    );
  }

  /* ================================================================ *
   * the four lifting transformations
   * ================================================================ */

  figures.profiles = (slot) =>
    createFigure(slot, {
      title: 'The four uplift profiles',
      note:
        'Each panel uplifts the same world of radius 500 m, with arc length preserved. Faint curves are earlier ' +
        'uplift levels; the solid curve is the current one. The ray shows the transformed boundary angle α′_w, ' +
        'which is the parameter the global slider sets — so all four profiles are always compared at the same ' +
        'boundary angle rather than at the same p.',
      local: { trails: true },
      controls: [
        { type: 'checkbox', id: 'trails', label: 'show earlier levels' },
      ],
      columns: 2,
      panels: PROFILE_NAMES.map((name) => ({
        key: name,
        title: `${name} tsunami`,
        color: `var(--series-${global.TsunamiModel.PROFILE_SLOT[name] + 1})`,
        aspect: 0.95,
        equalAspect: true,
        margin: { top: 14, right: 16, bottom: 32, left: 44 },
        draw: (plot, context) => drawProfilePanel(plot, context, name),
        hover: (point, context) => hoverProfile(point, context, name),
      })),
      legend: [
        { label: 'current uplift level', color: 'var(--text-primary)' },
        { label: 'earlier levels', color: 'var(--text-muted)' },
        { label: 'ray to the world boundary', color: 'var(--status-critical)', kind: 'dashed' },
      ],
      caption:
        'a world of radius 500 m uplifted by each transformation for increasing α′_w. ' +
        'The arc length from the origin is the same on every curve, so the boundary marker always sits ' +
        '500 m along the profile.',
      table: (context) => {
        const rows = PROFILE_NAMES.map((name) => {
          const profileModel = model(name);
          const profile = profileModel.at(context.state.alphaW);
          const [x, z] = profile.dToXY(PARAMS.worldRadius);
          return [
            name,
            formatP(profileModel.pForAngle(context.state.alphaW)),
            x.toFixed(1),
            z.toFixed(1),
            (profile.curvatureAtDistance(PARAMS.worldRadius) * 1000).toFixed(3),
          ];
        });
        return {
          columns: ['Profile', 'p', "x′(d_w) [m]", "y′(d_w) [m]", 'curvature ×10⁻³ [1/m]'],
          rows,
        };
      },
    });

  function drawProfilePanel(plot, context, name) {
    const radius = PARAMS.worldRadius;
    const h = PARAMS.observerHeight;
    const profileModel = model(name);

    plot.setDomain(-40, radius + 40, -60, radius + 60);
    plot.axes({ xLabel: 'x′  [m]', yLabel: 'y′  [m]' });

    const theme = plot.theme;
    const color = seriesColor(plot, name);

    plot.clip(() => {
      if (context.local.trails) {
        for (let angle = LEVEL_MIN; angle < context.state.alphaW; angle += 8) {
          const profile = profileModel.at(angle);
          plot.polyline(profilePoints(profile, 120), {
            color,
            width: 1,
            alpha: 0.22,
          });
        }
      }

      const profile = profileModel.at(context.state.alphaW);
      const points = profilePoints(profile, 260);
      plot.polyline(points, { color, width: 2.5 });

      const [bx, bz] = profile.dToXY(radius);
      plot.line(0, h, bx, bz, { color: theme.critical, dash: [4, 3], width: 1.25 });
      plot.line(0, h, 0, -60, { color: theme.axis, dash: [3, 3], width: 1 });
      plot.marker(bx, bz, { color, radius: 4.5 });
    });

    drawObserver(plot, h, { color: theme.critical, label: false, radius: 3.5 });

    const arcRadius = Math.min(26, plot.plotHeight * 0.13);
    drawAngleArc(
      plot,
      0,
      h,
      arcRadius,
      -Math.PI / 2,
      -Math.PI / 2 + context.state.alphaW * DEG,
      null,
      { color: withAlpha(theme.critical, 0.55) }
    );

    plot.labelPx(
      plot.margin.left + 8,
      plot.margin.top + 12,
      `p = ${formatP(profileModel.pForAngle(context.state.alphaW))}`,
      { color, haloColor: theme.surface }
    );
  }

  function hoverProfile(point, context, name) {
    const profile = model(name).at(context.state.alphaW);
    const radius = PARAMS.worldRadius;
    // nearest sample along the profile
    let best = null;
    for (let i = 0; i <= 120; i += 1) {
      const d = (i / 120) * radius;
      const [x, z] = profile.dToXY(d);
      const distance = Math.hypot(x - point.x, z - point.y);
      if (!best || distance < best.distance) best = { distance, d, x, z };
    }
    if (!best || best.distance > radius * 0.09) return null;
    return (
      `<div class="tip-title">${name}</div>` +
      `<div class="tip-row"><span>ground distance x</span><strong>${best.d.toFixed(0)} m</strong></div>` +
      `<div class="tip-row"><span>x′</span><strong>${best.x.toFixed(1)} m</strong></div>` +
      `<div class="tip-row"><span>y′</span><strong>${best.z.toFixed(1)} m</strong></div>`
    );
  }

  /* ================================================================ *
   * the angular construction
   * ================================================================ */

  figures['angular-construction'] = (slot) =>
    createFigure(slot, {
      title: 'The angular construction: d′ = d, α′ = 2α',
      note:
        'The angular transformation keeps the distance from an effective observer at height h′ = 1/p and doubles ' +
        'the viewing angle. Drag the ground point s to watch the pair (α, 2α) move; the global uplift slider sets h′.',
      local: { s: 250 },
      controls: [
        {
          type: 'range',
          id: 's',
          label: 'ground point s',
          min: 0,
          max: PARAMS.worldRadius,
          step: 5,
          format: (value) => `${value.toFixed(0)} m`,
        },
      ],
      columns: 1,
      panels: [
        {
          key: 'construction',
          title: 'Angular tsunami',
          aspect: 0.56,
          equalAspect: true,
          margin: { top: 16, right: 20, bottom: 34, left: 48 },
          draw: drawAngularConstruction,
        },
      ],
      legend: [
        { label: 'original ground', color: 'var(--text-primary)' },
        { label: 'angular profile', color: 'var(--series-3)' },
        { label: 'equal distance d′', color: 'var(--text-muted)', kind: 'dashed' },
      ],
      caption:
        'the point (s, 0) is seen from the effective observer (0, h′) at angle α and distance d′. ' +
        'Its image lies at the same distance d′ but at angle 2α, which is what spreads the ground over the full ' +
        'angular range.',
    });

  function drawAngularConstruction(plot, context) {
    const angularModel = model('Angular');
    const p = angularModel.pForAngle(context.state.alphaW);
    const profile = angularModel.at(context.state.alphaW);
    const radius = PARAMS.worldRadius;
    const theme = plot.theme;
    const color = plot.theme.series[2];

    const hEff = p > 0 ? 1 / p : Infinity;
    const s = context.local.s;

    // Full profile, plus the stretch up to the selected ground point.
    const full = profilePoints(profile, 240);
    const upTo = profilePoints(profile, 120, Math.max(s, 1));

    const flat = !isFinite(hEff);
    const d = flat ? 0 : Math.hypot(s, hEff);
    const alpha = flat ? 0 : Math.atan2(s, hEff);
    const image = flat
      ? [s, 0]
      : [d * Math.sin(2 * alpha), hEff - d * Math.cos(2 * alpha)];

    // Fit everything the construction refers to: the ground point, the
    // effective observer, the image point and the profile itself. Without this
    // the circle of equal distance leaves the panel as soon as s grows.
    let minX = -20;
    let maxX = Math.max(s, image[0], 40);
    let minY = -20;
    let maxY = Math.max(image[1], 40);
    if (!flat) maxY = Math.max(maxY, hEff);
    for (const [x, z] of upTo) {
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, z);
    }
    const padX = (maxX - minX) * 0.08;
    const padY = (maxY - minY) * 0.08;
    plot.setDomain(minX - padX, maxX + padX, minY - padY, maxY + padY);
    plot.axes({ xLabel: 'x′  [m]', yLabel: 'y′  [m]' });

    plot.clip(() => {
      drawGroundTiles(plot, PARAMS, { from: 0, to: radius, width: 4 });
      plot.polyline(full, { color, width: 1.5, alpha: 0.35 });
      plot.polyline(upTo, { color, width: 2.5 });

      if (flat) {
        plot.marker(s, 0, { color: theme.critical, radius: 4.5 });
        return;
      }

      // The arc of constant distance d′, drawn only between the two radii.
      const angleToGround = Math.atan2(-hEff, s);
      const angleToImage = Math.atan2(image[1] - hEff, image[0]);
      plot.arc(0, hEff, d, angleToGround, angleToImage, {
        color: theme.muted,
        dash: [4, 4],
        width: 1.2,
      });

      plot.line(0, hEff, s, 0, { color: theme.muted, width: 1.4 });
      plot.line(0, hEff, image[0], image[1], { color, width: 1.6 });
      plot.line(0, hEff, 0, hEff - d, { color: theme.axis, dash: [3, 3], width: 1 });

      plot.marker(s, 0, { color: theme.critical, radius: 4.5 });
      plot.label(s, 0, 'P', { dx: 6, dy: 13, color: theme.critical });
      plot.marker(image[0], image[1], { color, radius: 4.5 });
      plot.label(image[0], image[1], 'P′', { dx: 8, dy: -10, color });
      plot.marker(0, hEff, { color: theme.secondary, radius: 3.5 });

      const scale = plot.plotWidth / (plot.domain.x1 - plot.domain.x0);
      const arcRadius = Math.min(54, Math.max(26, d * scale * 0.32));
      drawAngleArc(plot, 0, hEff, arcRadius, -Math.PI / 2, -Math.PI / 2 + alpha, 'α', {
        color: theme.muted,
      });
      drawAngleArc(
        plot,
        0,
        hEff,
        arcRadius * 1.42,
        -Math.PI / 2,
        -Math.PI / 2 + 2 * alpha,
        '2α',
        { color, labelColor: color }
      );
    });

    if (!flat) {
      plot.label(0, hEff, "h′ = 1/p", { dx: 9, dy: -10, color: theme.secondary });
      plot.labelPx(
        plot.margin.left + 10,
        plot.margin.top + 14,
        `h′ = ${hEff.toFixed(1)} m     d′ = ${d.toFixed(1)} m     α = ${(
          (alpha * 180) / Math.PI
        ).toFixed(1)}°  →  2α = ${((2 * alpha * 180) / Math.PI).toFixed(1)}°`,
        { color: theme.secondary }
      );
    } else {
      plot.labelPx(
        plot.margin.left + 10,
        plot.margin.top + 14,
        'p = 0 — the profile is the flat ground (h′ → ∞)',
        { color: theme.secondary }
      );
    }
  }

  /* ================================================================ *
   * field of view coverage
   * ================================================================ */

  const COVERAGE_LEVEL_STEP = 8;

  figures.coverage = (slot) =>
    createFigure(slot, {
      title: 'How far the observer sees in each direction',
      note:
        'The visible ground distance as a function of the viewing angle α. Faint curves are lower uplift levels; ' +
        'the solid curve is the current level. Where a curve reaches the dashed line at ' +
        '500 m, the world boundary has come into view — the angle at which it does is exactly α′_w.',
      columns: 2,
      panels: PROFILE_NAMES.map((name) => ({
        key: name,
        title: `${name}`,
        color: `var(--series-${global.TsunamiModel.PROFILE_SLOT[name] + 1})`,
        aspect: 0.7,
        margin: { top: 14, right: 14, bottom: 38, left: 52 },
        draw: (plot, context) => drawCoverage(plot, context, name),
        hover: (point, context) => hoverCoverage(point, context, name),
      })),
      legend: [
        {
          label: 'current level',
          color: (current) => `var(--series-${global.TsunamiModel.PROFILE_SLOT[current.profile] + 1})`,
        },
        { label: 'lower levels, in each panel’s own hue', color: 'var(--text-muted)' },
        { label: 'world boundary d_w', color: 'var(--text-muted)', kind: 'dashed' },
      ],
      caption:
        'ground coverage of the field of view. A flat world runs out of ground at the horizon ' +
        '(α = 90°); every uplifted profile continues past it.',
      table: (context) => {
        const table = model(context.state.profile).lut(context.state.alphaW);
        const rows = [];
        for (let deg = 0; deg <= 180; deg += 10) {
          const value = interpolate(table, deg * DEG);
          rows.push([
            `${deg}°`,
            isFinite(value) ? value.toFixed(1) : 'no intersection',
          ]);
        }
        return {
          columns: [`α (${context.state.profile})`, 'visible ground distance x [m]'],
          rows,
        };
      },
    });

  function drawCoverage(plot, context, name) {
    const radius = PARAMS.worldRadius;
    const profileModel = model(name);
    const theme = plot.theme;
    const color = seriesColor(plot, name);

    plot.setDomain(0, 180, 0, radius * 1.35);
    plot.axes({
      xLabel: 'viewing angle α  [deg]',
      yLabel: 'ground distance x  [m]',
      xTicks: [0, 45, 90, 135, 180],
    });

    plot.clip(() => {
      const curveFor = (angle) => {
        const table = profileModel.lut(angle);
        const points = [];
        for (let i = 0; i < table.theta.length; i += 2) {
          const value = table.distance[i];
          points.push([
            (table.theta[i] * 180) / Math.PI,
            isFinite(value) ? value : NaN,
          ]);
        }
        return points;
      };

      const span = Math.max(1, context.state.alphaW - LEVEL_MIN);
      for (let angle = LEVEL_MIN; angle < context.state.alphaW; angle += COVERAGE_LEVEL_STEP) {
        const fraction = (angle - LEVEL_MIN) / span;
        plot.polyline(curveFor(angle), {
          color: levelShade(plot, name, fraction),
          width: 1.25,
        });
      }

      plot.line(0, radius, 180, radius, {
        color: theme.muted,
        dash: [5, 4],
        width: 1.25,
      });

      plot.polyline(curveFor(context.state.alphaW), { color, width: 2.5 });

      // the boundary angle marker
      plot.marker(context.state.alphaW, radius, { color, radius: 4.5 });
      plot.line(context.state.alphaW, 0, context.state.alphaW, radius, {
        color,
        dash: [3, 3],
        width: 1,
        alpha: 0.5,
      });
    });

    plot.label(180, radius, 'd_w', {
      dx: -6,
      dy: -9,
      align: 'right',
      color: theme.muted,
    });
    plot.labelPx(
      plot.margin.left + 8,
      plot.margin.top + 12,
      `α′_w = ${context.state.alphaW.toFixed(0)}°`,
      { color, haloColor: theme.surface }
    );
  }

  function hoverCoverage(point, context, name) {
    if (point.x < 0 || point.x > 180) return null;
    const table = model(name).lut(context.state.alphaW);
    const value = interpolate(table, point.x * DEG);
    return (
      `<div class="tip-title">${name}</div>` +
      `<div class="tip-row"><span>α</span><strong>${point.x.toFixed(1)}°</strong></div>` +
      `<div class="tip-row"><span>visible s</span><strong>${
        isFinite(value) ? `${value.toFixed(1)} m` : 'no ground'
      }</strong></div>`
    );
  }

  /* ================================================================ *
   * change in distance to the observer
   * ================================================================ */

  figures['distance-change'] = (slot) =>
    createFigure(slot, {
      title: 'How the distance from the observer changes',
      note:
        'Uplifting the ground moves every point closer to the observer, because the arc length to it is preserved ' +
        'while the ground bends upward toward the viewer. Absolute change is in metres; relative change is ' +
        'normalised by the original distance.',
      local: { mode: 'absolute' },
      controls: [
        {
          type: 'segmented',
          id: 'mode',
          label: 'change',
          options: [
            { value: 'absolute', label: 'absolute' },
            { value: 'relative', label: 'relative' },
          ],
        },
      ],
      columns: 2,
      panels: PROFILE_NAMES.map((name) => ({
        key: name,
        title: `${name}`,
        color: `var(--series-${global.TsunamiModel.PROFILE_SLOT[name] + 1})`,
        aspect: 0.7,
        margin: { top: 14, right: 14, bottom: 38, left: 54 },
        draw: (plot, context) => drawDistanceChange(plot, context, name),
        hover: (point, context) => hoverDistanceChange(point, context, name),
      })),
      legend: [
        {
          label: 'current level',
          color: (current) => `var(--series-${global.TsunamiModel.PROFILE_SLOT[current.profile] + 1})`,
        },
        { label: 'lower levels, in each panel’s own hue', color: 'var(--text-muted)' },
      ],
      caption:
        'distance from the observer to a surface point, after uplift minus before, as a function ' +
        'of the original ground distance x.',
    });

  function distanceChangeCurve(profile, mode, h, radius, samples = 150) {
    const points = [];
    for (let i = 1; i <= samples; i += 1) {
      const d = (i / samples) * radius;
      const [x, z] = profile.dToXY(d);
      const before = Math.hypot(d, h);
      const after = Math.hypot(x, z - h);
      const change = after - before;
      points.push([d, mode === 'relative' ? change / before : change]);
    }
    return points;
  }

  function drawDistanceChange(plot, context, name) {
    const radius = PARAMS.worldRadius;
    const h = PARAMS.observerHeight;
    const mode = context.local.mode;
    const profileModel = model(name);
    const theme = plot.theme;
    const color = seriesColor(plot, name);

    const current = distanceChangeCurve(
      profileModel.at(context.state.alphaW),
      mode,
      h,
      radius
    );
    let minValue = 0;
    for (const [, value] of current) minValue = Math.min(minValue, value);
    const lower = mode === 'relative' ? Math.min(-0.05, minValue * 1.15) : Math.min(-5, minValue * 1.15);

    plot.setDomain(0, radius, lower, Math.abs(lower) * 0.06);
    plot.axes({
      xLabel: 'original ground distance x  [m]',
      yLabel: mode === 'relative' ? 'relative change' : 'change  [m]',
      formatY: mode === 'relative' ? (value) => value.toFixed(2) : undefined,
    });

    plot.clip(() => {
      const span = Math.max(1, context.state.alphaW - LEVEL_MIN);
      for (let angle = LEVEL_MIN; angle < context.state.alphaW; angle += COVERAGE_LEVEL_STEP) {
        const fraction = (angle - LEVEL_MIN) / span;
        plot.polyline(
          distanceChangeCurve(profileModel.at(angle), mode, h, radius, 90),
          { color: levelShade(plot, name, fraction), width: 1.25 }
        );
      }
      plot.line(0, 0, radius, 0, { color: theme.axis, width: 1 });
      plot.polyline(current, { color, width: 2.5 });
    });

    const last = current[current.length - 1];
    plot.label(last[0], last[1], name, {
      dx: -6,
      dy: -10,
      align: 'right',
      color,
    });
  }

  function hoverDistanceChange(point, context, name) {
    const radius = PARAMS.worldRadius;
    if (point.x < 0 || point.x > radius) return null;
    const h = PARAMS.observerHeight;
    const profile = model(name).at(context.state.alphaW);
    const [x, z] = profile.dToXY(point.x);
    const before = Math.hypot(point.x, h);
    const after = Math.hypot(x, z - h);
    const change = after - before;
    return (
      `<div class="tip-title">${name}</div>` +
      `<div class="tip-row"><span>s</span><strong>${point.x.toFixed(0)} m</strong></div>` +
      `<div class="tip-row"><span>before</span><strong>${before.toFixed(1)} m</strong></div>` +
      `<div class="tip-row"><span>after</span><strong>${after.toFixed(1)} m</strong></div>` +
      `<div class="tip-row"><span>change</span><strong>${change.toFixed(1)} m (${(
        (100 * change) / before
      ).toFixed(1)}%)</strong></div>`
    );
  }

  /* ================================================================ *
   * evolution of the visible strip
   * ================================================================ */

  const evolutionCache = new Map();
  const EVOLUTION_ANGLES = 300;
  const EVOLUTION_LEVELS = 80;

  /**
   * One row per uplift level, one column per viewing angle, coloured by the
   * ground tile visible there. Built once per profile and cached: it does not
   * depend on the current level, only the marker line does.
   */
  function evolutionImage(name, colors) {
    const key = `${name}:${colors.token}`;
    if (evolutionCache.has(key)) return evolutionCache.get(key);

    const profileModel = model(name);
    const image = new ImageData(EVOLUTION_ANGLES, EVOLUTION_LEVELS);
    const data = image.data;

    for (let row = 0; row < EVOLUTION_LEVELS; row += 1) {
      // Row 0 of the buffer is painted at the top of the plot, where the axis
      // shows the largest alpha'_w, so the levels run downward here.
      const angle =
        LEVEL_MAX - (row / (EVOLUTION_LEVELS - 1)) * (LEVEL_MAX - LEVEL_MIN);
      const table = profileModel.lut(angle, PARAMS.observerHeight, 600);
      for (let col = 0; col < EVOLUTION_ANGLES; col += 1) {
        const theta = (col / (EVOLUTION_ANGLES - 1)) * Math.PI;
        const distance = interpolate(table, theta);
        let color;
        if (!isFinite(distance)) color = colors.sky;
        else if (distance > PARAMS.worldRadius) color = colors.outside;
        else {
          const index = Math.floor(distance / PARAMS.tileSize);
          color = index % 2 === 0 ? colors.dark : colors.light;
        }
        const offset = (row * EVOLUTION_ANGLES + col) * 4;
        data[offset] = color[0];
        data[offset + 1] = color[1];
        data[offset + 2] = color[2];
        data[offset + 3] = 255;
      }
    }

    if (evolutionCache.size > 8) evolutionCache.clear();
    evolutionCache.set(key, image);
    return image;
  }

  figures.evolution = (slot) =>
    createFigure(slot, {
      title: 'Evolution of the visible strip',
      note:
        'Every row is one uplift level and every column one viewing angle; the colour is the ground tile seen in ' +
        'that direction. Reading a row left to right is the strip the observer sees; reading upward shows ' +
        'the world spreading over a wider angular range as the uplift grows. The line marks the current level.',
      columns: 2,
      panels: PROFILE_NAMES.map((name) => ({
        key: name,
        title: `${name}`,
        color: `var(--series-${global.TsunamiModel.PROFILE_SLOT[name] + 1})`,
        aspect: 0.62,
        margin: { top: 12, right: 12, bottom: 36, left: 48 },
        draw: (plot, context) => drawEvolution(plot, context, name),
        hover: (point, context) => hoverEvolution(point, context, name),
      })),
      legend: [
        { label: 'ground tiles', color: '#2f2f2d', kind: 'square' },
        { label: 'beyond the modelled world', color: 'rgb(60,110,85)', kind: 'square' },
        { label: 'no ground in that direction', color: 'rgb(55,80,120)', kind: 'square' },
        { label: 'current level', color: 'var(--status-critical)' },
      ],
      caption:
        'the colour-strip evolution over the uplift levels, produced from the two-dimensional ' +
        'lookup table s(α; p) described in the computational remarks.',
    });

  function evolutionColors(plot) {
    const theme = plot.theme;
    return {
      token: theme.surface,
      sky: global.FigureKit.rgb(global.Viz.mixColors(theme.surface, '#1c3f6e', 0.82)),
      outside: global.FigureKit.rgb(global.Viz.mixColors(theme.surface, '#20583f', 0.72)),
      dark: global.FigureKit.rgb(global.FigureKit.CHESS_DARK),
      light: global.FigureKit.rgb(global.FigureKit.CHESS_LIGHT),
    };
  }

  function drawEvolution(plot, context, name) {
    const theme = plot.theme;
    plot.setDomain(0, 180, LEVEL_MIN, LEVEL_MAX);
    plot.axes({
      grid: false,
      xLabel: 'viewing angle α  [deg]',
      yLabel: "α′_w  [deg]",
      xTicks: [0, 45, 90, 135, 180],
    });

    const image = evolutionImage(name, evolutionColors(plot));
    plot.image(image, { smooth: false });
    plot.frame();

    plot.clip(() => {
      plot.line(0, context.state.alphaW, 180, context.state.alphaW, {
        color: theme.critical,
        width: 2,
      });
    });
    plot.label(180, context.state.alphaW, `${context.state.alphaW.toFixed(0)}°`, {
      dx: -6,
      dy: -8,
      align: 'right',
      color: theme.critical,
    });
  }

  function hoverEvolution(point, context, name) {
    if (point.x < 0 || point.x > 180) return null;
    const level = Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, point.y));
    const table = model(name).lut(level);
    const distance = interpolate(table, point.x * DEG);
    let where = 'inside the modelled world';
    if (!isFinite(distance)) where = 'no ground in this direction';
    else if (distance > PARAMS.worldRadius) where = 'beyond the modelled world';
    return (
      `<div class="tip-title">${name}</div>` +
      `<div class="tip-row"><span>α′_w</span><strong>${level.toFixed(0)}°</strong></div>` +
      `<div class="tip-row"><span>α</span><strong>${point.x.toFixed(0)}°</strong></div>` +
      `<div class="tip-row"><span>s</span><strong>${
        isFinite(distance) ? `${distance.toFixed(0)} m` : '—'
      }</strong></div>` +
      `<div class="tip-row"><span>${where}</span></div>`
    );
  }

  global.Figures1D = figures;
})(typeof globalThis !== 'undefined' ? globalThis : this);
