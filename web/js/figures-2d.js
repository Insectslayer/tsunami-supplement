/*
 * figures-2d.js — the two-dimensional extensions of a one-dimensional profile:
 * radial, directional and mixed, seen through the camera and from above.
 */
(function (global) {
  'use strict';

  const {
    createFigure,
    renderCameraImage,
    cameraColors,
    drawTopViewGround,
    drawGroundTiles,
    drawObserver,
    formatDegrees,
  } = global.FigureKit;

  const { PARAMS, PROFILE_NAMES, PROFILE_SLOT, model, Camera, toPaperPlane } =
    global.TsunamiModel;
  const { withAlpha } = global.Viz;

  const DEG = Math.PI / 180;
  const figures = {};

  const EXTENSIONS = [
    { key: 'flat', label: 'Original flat plane' },
    { key: 'radial', label: 'Radial uplifting' },
    { key: 'directional', label: 'Directional uplifting' },
    { key: 'mixed', label: 'Mixed uplifting' },
  ];

  /** Cameras are reused so the per-pixel ray geometry is only built once. */
  const cameras = new Map();
  function cameraFor(key, scale) {
    const id = `${key}:${scale}`;
    if (!cameras.has(id)) cameras.set(id, new Camera({ scale }));
    return cameras.get(id);
  }

  function configureCamera(camera, local) {
    camera.alpha = local.alpha;
    camera.azimuth = local.azimuth != null ? local.azimuth : 0;
    camera.h = PARAMS.observerHeight;
    return camera;
  }

  /** Fits the sensor rectangle inside the panel and draws the rendered image. */
  function drawSensor(plot, camera, image) {
    const sensorAspect = camera.height / camera.width;
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
    return { left, top, width: drawWidth, height: drawHeight };
  }

  function distanceFieldFor(camera, extension, profileName, alphaW, mu) {
    if (extension === 'flat') return camera.distances('flat');
    const lut = model(profileName).lut(alphaW);
    return camera.distances(extension, lut, mu);
  }

  /* ================================================================ *
   * Figures 40–48 — the three extensions side by side
   * ================================================================ */

  figures['extensions-2d'] = (slot) =>
    createFigure(slot, {
      number: 'Figures 40–48',
      title: 'Radial, directional and mixed uplifting',
      note:
        'The same one-dimensional profile extended over the plane in three ways. The camera views show what the ' +
        'observer sees; the top views show which part of the ground each one reaches (the outline is the field of ' +
        'view projected onto the plane). The side view along the central viewing direction is common to all three.',
      local: { alpha: PARAMS.viewingDirection, azimuth: 0, mu: 0.5 },
      controls: [
        {
          type: 'range',
          id: 'alpha',
          label: 'viewing direction α',
          min: 5,
          max: 175,
          step: 1,
          format: formatDegrees,
        },
        {
          type: 'range',
          id: 'azimuth',
          label: 'azimuth φ',
          min: -90,
          max: 90,
          step: 5,
          format: formatDegrees,
        },
        {
          type: 'range',
          id: 'mu',
          label: 'mixing μ',
          min: 0,
          max: 1,
          step: 0.05,
          format: (value) => value.toFixed(2),
        },
      ],
      rows: [
        {
          columns: 4,
          panels: EXTENSIONS.map((extension) => ({
            key: `cam-${extension.key}`,
            title: extension.label,
            aspect: 0.78,
            margin: { top: 8, right: 8, bottom: 8, left: 8 },
            draw: (plot, context) => drawExtensionCamera(plot, context, extension.key),
          })),
        },
        {
          columns: 4,
          panels: EXTENSIONS.map((extension) => ({
            key: `top-${extension.key}`,
            title: `Ground reached — ${extension.label.toLowerCase()}`,
            aspect: 0.92,
            equalAspect: true,
            margin: { top: 10, right: 10, bottom: 26, left: 30 },
            draw: (plot, context) => drawExtensionTop(plot, context, extension.key),
          })),
        },
        {
          columns: 1,
          panels: [
            {
              key: 'side',
              title: 'Side view along the central viewing direction — common to all three',
              aspect: 0.34,
              margin: { top: 14, right: 18, bottom: 34, left: 50 },
              draw: drawExtensionSide,
            },
          ],
        },
      ],
      legend: [
        { label: 'field of view of the flat plane', color: 'var(--text-muted)' },
        { label: 'field of view after uplifting', color: 'var(--accent)' },
        { label: 'world boundary in the image', color: 'var(--text-primary)' },
      ],
      caption:
        'Figures 40–48: the radial construction is rotationally symmetric and bends structures perpendicular to ' +
        'the viewing direction; the directional construction is cylindrical and keeps them straight but singles ' +
        'out one horizontal direction; μ interpolates the two ray-distance fields reciprocally.',
    });

  function drawExtensionCamera(plot, context, extension) {
    const camera = configureCamera(cameraFor('main', 4), context.local);
    const distances = distanceFieldFor(
      camera,
      extension,
      context.state.profile,
      context.state.alphaW,
      context.local.mu
    );
    const colors = cameraColors(plot.theme, plot.theme.text);
    const image = renderCameraImage(camera, distances, PARAMS, colors);
    const box = drawSensor(plot, camera, image);

    if (extension === 'mixed') {
      plot.labelPx(box.left + 6, box.top + 10, `μ = ${context.local.mu.toFixed(2)}`, {
        color: '#ffffff',
        haloColor: 'rgba(0,0,0,0.55)',
      });
    }
  }

  function drawExtensionTop(plot, context, extension) {
    const radius = PARAMS.worldRadius;
    const border = radius * 0.35;
    plot.setDomain(-radius - border, radius + border, -radius - border, radius + border);
    plot.axes({ grid: false, xTicks: [-500, 0, 500], yTicks: [-500, 0, 500] });

    const theme = plot.theme;
    const camera = configureCamera(cameraFor('main', 4), context.local);

    plot.clip(() => {
      drawTopViewGround(plot, PARAMS, { alpha: 0.14 });

      const flatFov = camera.fieldOfView(camera.distances('flat')).map(toPaperPlane);
      if (flatFov.length > 2) {
        plot.polygon(flatFov, { stroke: withAlpha(theme.muted, 0.9), width: 1.25 });
      }

      if (extension !== 'flat') {
        const distances = distanceFieldFor(
          camera,
          extension,
          context.state.profile,
          context.state.alphaW,
          context.local.mu
        );
        const fov = camera.fieldOfView(distances).map(toPaperPlane);
        if (fov.length > 2) {
          plot.polygon(fov, {
            fill: withAlpha(theme.accent, 0.14),
            stroke: theme.accent,
            width: 1.75,
          });
        }
      }
    });

    plot.marker(0, 0, { color: theme.critical, shape: 'star', radius: 3.5 });
  }

  function drawExtensionSide(plot, context) {
    const radius = PARAMS.worldRadius;
    const h = PARAMS.observerHeight;
    const profileName = context.state.profile;
    const profile = model(profileName).at(context.state.alphaW);
    const color = plot.theme.series[PROFILE_SLOT[profileName]];
    const theme = plot.theme;

    const points = [];
    let maxZ = h * 1.2;
    for (let i = 0; i <= 240; i += 1) {
      const d = (i / 240) * radius;
      const [x, z] = profile.dToXY(d);
      points.push([x, z]);
      maxZ = Math.max(maxZ, z);
    }

    plot.setDomain(-40, radius + 40, -40, maxZ * 1.1);
    plot.axes({ xLabel: 'x  [m]', yLabel: 'z  [m]' });

    plot.clip(() => {
      drawGroundTiles(plot, PARAMS, { from: 0, to: radius, width: 3.5 });
      plot.polyline(points, { color, width: 2.5 });

      const alphaRad = context.local.alpha * DEG;
      const halfV = cameraFor('main', 4).halfVFov * DEG;
      const reach = radius * 2.6;
      for (const edge of [alphaRad - halfV, alphaRad + halfV]) {
        plot.line(0, h, Math.sin(edge) * reach, h - Math.cos(edge) * reach, {
          color: theme.muted,
          dash: [4, 4],
          width: 1.2,
        });
      }

      const [bx, bz] = profile.dToXY(radius);
      plot.marker(bx, bz, { color, radius: 4 });
    });

    drawObserver(plot, h, { color: theme.critical, label: false, radius: 3.5 });
    plot.labelPx(
      plot.margin.left + 8,
      plot.margin.top + 12,
      `${profileName} · α′_w = ${context.state.alphaW.toFixed(0)}° · α = ${context.local.alpha.toFixed(0)}°`,
      { color: theme.secondary }
    );
  }

  /* ================================================================ *
   * Figures 49–60 — the four profiles compared under mixed uplifting
   * ================================================================ */

  figures.comparison = (slot) =>
    createFigure(slot, {
      number: 'Figures 49–60',
      title: 'The four profiles under mixed uplifting',
      note:
        'Camera view, ground reached, and side profile for each transformation at the same transformed boundary ' +
        'angle. Because α′_w is held fixed across the columns, the differences here are differences of shape, not ' +
        'of the amount of uplift.',
      local: { alpha: PARAMS.viewingDirection, mu: 0.5 },
      controls: [
        {
          type: 'range',
          id: 'alpha',
          label: 'viewing direction α',
          min: 5,
          max: 175,
          step: 1,
          format: formatDegrees,
        },
        {
          type: 'range',
          id: 'mu',
          label: 'mixing μ',
          min: 0,
          max: 1,
          step: 0.05,
          format: (value) => value.toFixed(2),
        },
      ],
      rows: [
        {
          columns: 4,
          panels: PROFILE_NAMES.map((name) => ({
            key: `cam-${name}`,
            title: name,
            color: `var(--series-${PROFILE_SLOT[name] + 1})`,
            aspect: 0.78,
            margin: { top: 8, right: 8, bottom: 8, left: 8 },
            draw: (plot, context) => drawComparisonCamera(plot, context, name),
          })),
        },
        {
          columns: 4,
          panels: PROFILE_NAMES.map((name) => ({
            key: `top-${name}`,
            title: `Ground reached`,
            aspect: 0.92,
            equalAspect: true,
            margin: { top: 10, right: 10, bottom: 26, left: 30 },
            draw: (plot, context) => drawComparisonTop(plot, context, name),
          })),
        },
        {
          columns: 4,
          panels: PROFILE_NAMES.map((name) => ({
            key: `side-${name}`,
            title: `Side profile`,
            aspect: 0.92,
            equalAspect: true,
            margin: { top: 10, right: 12, bottom: 26, left: 34 },
            draw: (plot, context) => drawComparisonSide(plot, context, name),
          })),
        },
      ],
      legend: PROFILE_NAMES.map((name) => ({
        label: name,
        color: `var(--series-${PROFILE_SLOT[name] + 1})`,
      })),
      caption:
        'Figures 49–60: the same scene under each transformation, all at the current α′_w and mixed uplifting.',
    });

  function drawComparisonCamera(plot, context, name) {
    const camera = configureCamera(cameraFor('compare', 5), {
      alpha: context.local.alpha,
      azimuth: 0,
    });
    const lut = model(name).lut(context.state.alphaW);
    const distances = camera.distances('mixed', lut, context.local.mu);
    const colors = cameraColors(plot.theme, plot.theme.text);
    const image = renderCameraImage(camera, distances, PARAMS, colors);
    drawSensor(plot, camera, image);
  }

  function drawComparisonTop(plot, context, name) {
    const radius = PARAMS.worldRadius;
    const border = radius * 0.35;
    plot.setDomain(-radius - border, radius + border, -radius - border, radius + border);
    plot.axes({ grid: false, xTicks: [-500, 0, 500], yTicks: [-500, 0, 500] });

    const camera = configureCamera(cameraFor('compare', 5), {
      alpha: context.local.alpha,
      azimuth: 0,
    });
    const color = plot.theme.series[PROFILE_SLOT[name]];

    plot.clip(() => {
      drawTopViewGround(plot, PARAMS, { alpha: 0.12 });
      const flatFov = camera
        .fieldOfView(camera.distances('flat'))
        .map(toPaperPlane);
      if (flatFov.length > 2) {
        plot.polygon(flatFov, { stroke: withAlpha(plot.theme.muted, 0.85), width: 1.1 });
      }
      const lut = model(name).lut(context.state.alphaW);
      const fov = camera
        .fieldOfView(camera.distances('mixed', lut, context.local.mu))
        .map(toPaperPlane);
      if (fov.length > 2) {
        plot.polygon(fov, { fill: withAlpha(color, 0.16), stroke: color, width: 1.75 });
      }
    });

    plot.marker(0, 0, { color: plot.theme.critical, shape: 'star', radius: 3 });
  }

  function drawComparisonSide(plot, context, name) {
    const radius = PARAMS.worldRadius;
    const h = PARAMS.observerHeight;
    const profile = model(name).at(context.state.alphaW);
    const color = plot.theme.series[PROFILE_SLOT[name]];

    plot.setDomain(-40, radius + 40, -60, radius + 60);
    plot.axes({ grid: false, xTicks: [0, 250, 500], yTicks: [0, 250, 500] });

    const points = [];
    for (let i = 0; i <= 200; i += 1) {
      const d = (i / 200) * radius;
      points.push(profile.dToXY(d));
    }

    plot.clip(() => {
      plot.line(0, 0, radius, 0, { color: withAlpha(plot.theme.text, 0.22), width: 1 });
      plot.polyline(points, { color, width: 2.25 });
      const [bx, bz] = profile.dToXY(radius);
      plot.line(0, h, bx, bz, { color: plot.theme.critical, dash: [4, 3], width: 1.1 });
      plot.marker(bx, bz, { color, radius: 3.5 });
    });
    drawObserver(plot, h, { color: plot.theme.critical, label: false, radius: 3 });
  }

  global.Figures2D = figures;
})(typeof globalThis !== 'undefined' ? globalThis : this);
