/*
 * figures-construction.js — the combined flat/uplifted side view.
 *
 * A browser port of animate_sideview.py: the same scene is drawn twice in one
 * panel, once where it started on the flat ground and once on the uplifted
 * profile, with the two stages of the map that the script exposes as sliders
 * exposed here as sliders too.
 *
 * A scene point is a pair (x, q) -- distance along the flat ground, height
 * above it -- and reaches the uplifted world as
 *
 *     u   = (1 - arc) x + arc * L^-1(p, x)        arc-length slider
 *     dir = normalize((1 - nrm) e_y + nrm n(u))   normal slider
 *     P'  = g'(u) + q dir
 *
 * With the arc-length slider at 1 the ground keeps its length and only bends,
 * which is requirement (2) of the appendix; at 0 the distance is handed to the
 * profile as its own parameter and the ground stretches as well. With the
 * normal slider at 1 object heights follow the profile normal, which is the
 * rigid-height model T_3 = S + q n of the normal-layer section; at 0 they stay
 * vertical while their feet ride the curve.
 *
 * The uplift itself is not a local slider: it is the global alpha'_w, so this
 * figure bends in step with every other figure on the page.
 *
 * The cast ray is cast in the *uplifted* world -- it is what the observer looks
 * along -- and is drawn a second time as its pre-image in the flat world, the
 * path the transformation carries onto the ray. Both its ends are drag handles.
 */
(function (global) {
  'use strict';

  const { createFigure, drawObserver } = global.FigureKit;
  const { PARAMS, model, PROFILE_SLOT } = global.TsunamiModel;
  const { attachDrag, withAlpha } = global.Viz;

  const figures = {};

  /* Sampling. Kept modest: the inverse map below scans the ground table once
   * per queried point, so these two numbers multiply. */
  const GROUND_SAMPLES = 420;   // the drawn profile
  const INVERSE_SAMPLES = 640;  // the table the inverse map scans
  const RAY_SAMPLES = 160;      // points of the ray that are pulled back

  /* ---------------------------------------------------------------- *
   * The scene
   * ---------------------------------------------------------------- */

  /** Small deterministic PRNG, so the skyline is the same on every load. */
  function mulberry32(seed) {
    return function random() {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * A skyline of blocks receding to the world end, as one polyline running
   * along the ground and up and over each building.
   *
   * The polyline is densified because the map is nonlinear in s: an edge
   * running along the ground would otherwise be drawn as the chord of the arc
   * the uplifted world bends it into.
   */
  function buildScene(radius, worldHeight) {
    const random = mulberry32(20250828);
    const points = [[0, 0]];
    let s = radius * 0.06;

    while (s < radius * 0.97) {
      const width = (0.04 + random() * 0.06) * radius;
      const gap = (0.025 + random() * 0.055) * radius;
      // Distant buildings are drawn taller, so the uplift has something to
      // show at the far end of the world.
      const height = worldHeight * (0.3 + random() * 0.7) * (0.45 + (0.75 * s) / radius);
      if (s + width > radius) break;
      points.push([s, 0], [s, height], [s + width, height], [s + width, 0]);
      s += width + gap;
    }
    points.push([radius, 0]);

    const step = radius / 220;
    const dense = [points[0]];
    for (let i = 1; i < points.length; i += 1) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      const pieces = Math.max(1, Math.ceil(Math.abs(x1 - x0) / step));
      for (let k = 1; k <= pieces; k += 1) {
        dense.push([x0 + ((x1 - x0) * k) / pieces, y0 + ((y1 - y0) * k) / pieces]);
      }
    }
    return dense;
  }

  const SCENE = buildScene(PARAMS.worldRadius, PARAMS.worldHeight * 1.4);

  /* ---------------------------------------------------------------- *
   * Construction — the map, its inverse, and the ray
   * ---------------------------------------------------------------- */

  class Construction {
    constructor() {
      this.key = '';
      this.grid = null;
      this.profile = null;
      this.arcW = 1;
      this.normalW = 1;
    }

    /**
     * Lifts the shared profile and rebuilds the tables if anything moved.
     *
     * The tables are keyed on everything that shapes them, so dragging a ray
     * handle -- the most frequent interaction here -- reuses them untouched.
     */
    update(profileName, alphaW, normalW, arcW) {
      const key = `${profileName}:${alphaW.toFixed(3)}:${normalW.toFixed(3)}:${arcW.toFixed(3)}`;
      this.profile = model(profileName).at(alphaW);
      this.normalW = normalW;
      this.arcW = arcW;
      if (key !== this.key) {
        this.key = key;
        this.grid = null;
      }
      return this;
    }

    /** Flat distance x to profile parameter u, blended by the arc-length slider. */
    distanceToT(s) {
      if (this.arcW <= 0) return s;
      if (this.arcW >= 1) return this.profile.sToT(s);
      return (1 - this.arcW) * s + this.arcW * this.profile.sToT(s);
    }

    /** The direction object heights are lifted along, blended by the normal slider. */
    offsetDirection(t) {
      if (this.normalW <= 0) return [0, 1];
      const [nx, nz] = this.profile.tToNormal(t);
      if (this.normalW >= 1) return [nx, nz];
      const dx = nx * this.normalW;
      const dz = nz * this.normalW + (1 - this.normalW);
      const length = Math.hypot(dx, dz) || 1;
      return [dx / length, dz / length];
    }

    /** A flat-world (x, q) pair mapped into the uplifted world. */
    mapPoint(s, q) {
      const t = this.distanceToT(s);
      const [x, z] = this.profile.tToXY(t);
      if (q === 0) return [x, z];
      const [dx, dz] = this.offsetDirection(t);
      return [x + q * dx, z + q * dz];
    }

    mapPolyline(points) {
      return points.map(([s, q]) => this.mapPoint(s, q));
    }

    /** The uplifted ground over the modelled world. */
    groundPoints(samples = GROUND_SAMPLES) {
      const radius = PARAMS.worldRadius;
      const points = new Array(samples + 1);
      for (let i = 0; i <= samples; i += 1) {
        points[i] = this.mapPoint((i / samples) * radius, 0);
      }
      return points;
    }

    /**
     * The forward map sampled along the ground, tabulated against the flat
     * distance x rather than the native parameter u, so the inversion returns x
     * directly whatever the arc-length slider is doing.
     */
    table() {
      if (this.grid) return this.grid;
      const reach = PARAMS.worldRadius * 1.05;
      const n = INVERSE_SAMPLES;
      const s = new Float64Array(n);
      const x = new Float64Array(n);
      const z = new Float64Array(n);
      const dx = new Float64Array(n);
      const dz = new Float64Array(n);
      for (let i = 0; i < n; i += 1) {
        const distance = (i / (n - 1)) * reach;
        const t = this.distanceToT(distance);
        const [px, pz] = this.profile.tToXY(t);
        const [ux, uz] = this.offsetDirection(t);
        s[i] = distance;
        x[i] = px;
        z[i] = pz;
        dx[i] = ux;
        dz[i] = uz;
      }
      this.grid = { s, x, z, dx, dz };
      return this.grid;
    }

    /**
     * Pulls a point of the uplifted world back to a flat (x, q) pair.
     *
     * P' came from the ground point whose offset line passes through it, that
     * is, from the x where P' - g'(u(x)) is parallel to the offset direction.
     * The cross product of the two changes sign there, so the roots are found
     * by scanning the tabulated ground for sign changes.
     *
     * Past the focal surface -- where neighbouring offset lines have already
     * crossed, the singularity of the paper's normal-layer section -- there is
     * more than one root, and the nearest sheet is returned. A point no offset
     * line reaches has none, and comes back null so the drawn curve breaks
     * rather than showing an invented position.
     */
    inversePoint(px, pz) {
      const { s, x, z, dx, dz } = this.table();
      let best = null;
      let previous = (px - x[0]) * dz[0] - (pz - z[0]) * dx[0];

      for (let i = 1; i < s.length; i += 1) {
        const cross = (px - x[i]) * dz[i] - (pz - z[i]) * dx[i];
        if ((previous < 0) !== (cross < 0)) {
          const span = previous - cross;
          const local = Math.abs(span) < 1e-18 ? 0 : previous / span;
          const j = i - 1;
          const sRoot = s[j] + local * (s[i] - s[j]);
          const xRoot = x[j] + local * (x[i] - x[j]);
          const zRoot = z[j] + local * (z[i] - z[j]);
          const uxRoot = dx[j] + local * (dx[i] - dx[j]);
          const uzRoot = dz[j] + local * (dz[i] - dz[j]);
          const qRoot = (px - xRoot) * uxRoot + (pz - zRoot) * uzRoot;
          if (!best || Math.abs(qRoot) < Math.abs(best[1])) best = [sRoot, qRoot];
        }
        previous = cross;
      }
      return best;
    }

    /**
     * First intersection of the drawn segment with the uplifted ground.
     *
     * Bounded at both ends: `r` is the position along the segment, so a
     * crossing the segment stops short of, or that lies past the end of the
     * modelled world, is not a hit at all and returns null.
     */
    rayHit(start, end, ground) {
      const dirX = end[0] - start[0];
      const dirZ = end[1] - start[1];
      let best = null;

      for (let i = 1; i < ground.length; i += 1) {
        const ax = ground[i - 1][0];
        const az = ground[i - 1][1];
        const ex = ground[i][0] - ax;
        const ez = ground[i][1] - az;
        // Solve  a + u e = start + r d  by Cramer's rule.
        const denominator = ez * dirX - ex * dirZ;
        if (Math.abs(denominator) < 1e-12) continue;
        const wx = ax - start[0];
        const wz = az - start[1];
        const u = (wx * dirZ - wz * dirX) / denominator;
        const r = (wx * ez - wz * ex) / denominator;
        if (u < 0 || u > 1 || r < 0 || r > 1) continue;
        if (!best || r < best.r) best = { r, point: [ax + u * ex, az + u * ez] };
      }
      return best;
    }
  }

  const construction = new Construction();

  /* ---------------------------------------------------------------- *
   * The figure
   * ---------------------------------------------------------------- */

  const DEFAULT_RAY = {
    start: [0, PARAMS.observerHeight],
    end: [PARAMS.worldRadius, 0],
  };

  const DOMAIN_X = [-55, 575];
  const DOMAIN_Y = [-70, 470];

  figures.construction = (slot) => {
    const figure = createFigure(slot, {
      title: 'Building the transformation, step by step',
      note:
        'Explore how the individual parameters affect the transformation.' +
        'The two sliders control the two aspects of the parametrization.' +
        'The normal weight controls how much the normal is used in the parametrization, and how much object heights follow the profile normal.' +
        'The arc length controls how much the distance is based on the length of the curved profile.' +
        'You can drag the ray to explore how it transforms back into the flat world.',
      local: {
        normalW: 1,
        arcW: 1,
        rayStart: DEFAULT_RAY.start.slice(),
        rayEnd: DEFAULT_RAY.end.slice(),
      },
      controls: [
        {
          type: 'range',
          id: 'normalW',
          label: 'normals',
          min: 0,
          max: 1,
          step: 0.01,
          format: (value) => value.toFixed(2),
        },
        {
          type: 'range',
          id: 'arcW',
          label: 'arc length',
          min: 0,
          max: 1,
          step: 0.01,
          format: (value) => value.toFixed(2),
        },
      ],
      columns: 1,
      panels: [
        {
          key: 'view',
          title: 'Flat and uplifted world in one frame',
          aspect: 0.62,
          equalAspect: true,
          xDomain: DOMAIN_X,
          yDomain: DOMAIN_Y,
          margin: { top: 14, right: 18, bottom: 34, left: 46 },
          ariaLabel:
            'Side view of the flat scene and the same scene uplifted, with a draggable cast ray',
          draw: drawConstruction,
        },
      ],
      legend: [
        { label: 'flat world', color: 'var(--text-muted)' },
        { label: 'curved world', color: 'var(--text-primary)' },
        { label: 'cast ray in the curved world', color: 'var(--accent)' },
        { label: 'cast ray in the flat world', color: 'var(--status-critical)', kind: 'dashed' },
      ],
      caption:
        'the construction of animate_sideview.py, live. Arc length at 1 is requirement (2) of the ' +
        'appendix; at 0 the ground distance is fed to the profile as its own parameter u. Normals at 1 ' +
        'is the rigid-height model, at 0 objects stay upright. The ray is cast in the uplifted world; ' +
        'where it meets the ground, its pre-image ends on the ground point the observer is looking at.',
    });

    attachRayHandles(figure);
    return figure;
  };

  function seriesColor() {
    const slot = PROFILE_SLOT[global.TsunamiModel.state.profile] + 1;
    return `var(--series-${slot})`;
  }

  function current(context) {
    return construction.update(
      context.state.profile,
      context.state.alphaW,
      context.local.normalW,
      context.local.arcW
    );
  }

  /* ---------------------------------------------------------------- *
   * Dragging the ray
   * ---------------------------------------------------------------- */

  function attachRayHandles(figure) {
    const entry = figure.plots.get('view');
    if (!entry) return;
    const plot = entry.plot;

    const handleAt = (point) => {
      const local = figure.local;
      const candidates = [
        ['rayStart', local.rayStart],
        ['rayEnd', local.rayEnd],
      ];
      let best = null;
      for (const [id, position] of candidates) {
        const distance = Math.hypot(
          plot.px(position[0]) - point.px,
          plot.py(position[1]) - point.py
        );
        if (distance <= 14 && (!best || distance < best.distance)) best = { id, distance };
      }
      return best ? best.id : null;
    };

    attachDrag(plot, {
      hitTest: handleAt,
      onDrag: (id, point) => {
        // Clamped to the drawn domain: a handle dragged off the panel would be
        // impossible to pick up again.
        figure.local[id] = [
          Math.min(DOMAIN_X[1], Math.max(DOMAIN_X[0], point.x)),
          Math.min(DOMAIN_Y[1], Math.max(DOMAIN_Y[0], point.y)),
        ];
        figure.redraw();
      },
    });
  }

  /* ---------------------------------------------------------------- *
   * Drawing
   * ---------------------------------------------------------------- */

  function drawConstruction(plot, context) {
    const theme = plot.theme;
    const local = context.local;
    const radius = PARAMS.worldRadius;
    const c = current(context);
    const bent = context.state.alphaW > global.TsunamiModel.LEVEL_MIN + 1e-6;

    plot.setDomain(DOMAIN_X[0], DOMAIN_X[1], DOMAIN_Y[0], DOMAIN_Y[1]);
    plot.axes({ xLabel: 'x′  [m]', yLabel: 'y′  [m]' });

    const ground = c.groundPoints();
    const hit = c.rayHit(local.rayStart, local.rayEnd, ground);

    plot.clip(() => {
      // --- the flat world, underneath -----------------------------------
      if (bent) {
        plot.polyline([[0, 0], [radius, 0]], { color: theme.muted, width: 1.2, alpha: 0.55 });
        plot.polyline(SCENE, { color: theme.muted, width: 1, alpha: 0.55 });
      }

      // --- the uplifted world -------------------------------------------
      plot.polyline(c.mapPolyline(SCENE), { color: seriesHex(plot), width: 1.4 });
      plot.polyline(ground, { color: theme.text, width: 2.6 });

      // --- the ray, and where it came from -------------------------------
      drawRayPreimage(plot, c, local, hit);
      plot.polyline([local.rayStart, local.rayEnd], {
        color: theme.accent,
        width: 1.8,
      });

      if (hit) {
        plot.marker(hit.point[0], hit.point[1], {
          color: theme.accent,
          radius: 4,
          ringColor: plot.theme.surface,
        });
        const seen = c.inversePoint(hit.point[0], hit.point[1]);
        if (seen) plot.marker(seen[0], 0, { color: theme.critical, radius: 3.5 });
      }
    });

    drawObserver(plot, PARAMS.observerHeight, { label: false, radius: 3.5 });
    drawHandles(plot, local);
  }

  /** The ray pulled back into the flat world.
   *
   * Stops at the hit when there is one: past it the ray has entered the ground
   * and its pre-image dives far below the flat world. A segment that misses the
   * ground entirely -- passing over the end of the modelled world, say -- has
   * nothing to stop at, so the whole of it is transformed. Stretches the map
   * does not reach come back null and leave a gap in the curve.
   */
  function drawRayPreimage(plot, c, local, hit) {
    const span = hit ? hit.r : 1;
    const points = [];
    for (let i = 0; i <= RAY_SAMPLES; i += 1) {
      const fraction = (i / RAY_SAMPLES) * span;
      const px = local.rayStart[0] + fraction * (local.rayEnd[0] - local.rayStart[0]);
      const pz = local.rayStart[1] + fraction * (local.rayEnd[1] - local.rayStart[1]);
      const back = c.inversePoint(px, pz);
      points.push(back ? back : [NaN, NaN]);
    }
    plot.polyline(points, {
      color: plot.theme.critical,
      width: 1.6,
      dash: [5, 4],
    });
  }

  function drawHandles(plot, local) {
    [local.rayStart, local.rayEnd].forEach((position) => {
      plot.marker(position[0], position[1], {
        color: plot.theme.surface,
        stroke: plot.theme.accent,
        radius: 5.5,
      });
    });
  }

  /** The panel's series colour, resolved to something canvas can stroke. */
  function seriesHex(plot) {
    return plot.theme.series[PROFILE_SLOT[global.TsunamiModel.state.profile]];
  }

  global.FiguresConstruction = figures;
})(typeof globalThis !== 'undefined' ? globalThis : this);
