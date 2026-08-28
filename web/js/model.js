/*
 * model.js — shared state for the page.
 *
 * Holds the world/camera parameters of Table 1, one cached model per
 * transformation profile, and the distance-field constructions of the
 * two-dimensional extensions (radial, directional, mixed).
 *
 * The uplift is driven by the transformed boundary angle alpha'_w, exactly as
 * the paper describes: the parameter p for a discrete sequence of target
 * angles is precomputed once per profile and reused by every figure.
 */
(function (global) {
  'use strict';

  const { createProfile, angleAt, integrate } = global.TsunamiMath;

  /* Table 1 — basic parameters used in the figures. */
  const PARAMS = {
    worldRadius: 500, // d_w  [m]
    tileSize: 30, // d_T  [m]
    observerHeight: 100, // h    [m]
    azimuth: 0, // phi  [deg]
    viewingDirection: 65, // alpha [deg]
    focalDistance: 0.007, // f    [m]
    pixelSize: 0.00005, // d_p  [m]
    halfWidth: 400, // N
    halfHeight: 300, // M
    worldHeight: 50, // h_w, used by the curvature band
    safetyFactor: 0.9, // eta
  };

  const PROFILE_NAMES = ['Parabolic', 'Hyperbolic', 'Angular', 'Spherical'];

  /** Categorical slot per profile — fixed order, never cycled. */
  const PROFILE_SLOT = {
    Parabolic: 0,
    Hyperbolic: 1,
    Angular: 2,
    Spherical: 3,
  };

  const FLAT_BOUNDARY_ANGLE =
    (Math.atan(PARAMS.worldRadius / PARAMS.observerHeight) * 180) / Math.PI; // ~78.7 deg

  const LEVEL_MIN = Math.round(FLAT_BOUNDARY_ANGLE * 10) / 10;
  const LEVEL_MAX = 175;
  const LEVEL_STEP = 1;

  /* ---------------------------------------------------------------- *
   * ProfileModel — a profile plus its precomputed uplift table
   * ---------------------------------------------------------------- */

  class ProfileModel {
    constructor(name) {
      this.name = name;
      this.slot = PROFILE_SLOT[name];
      const options = {
        worldSize: PARAMS.worldRadius,
        keepLengths: true,
      };
      if (name === 'Hyperbolic') options.b = PARAMS.worldRadius;
      this.profile = createProfile(name, options);
      this._liftTable = null;
      this._lutCache = new Map();
    }

    /**
     * Samples p and records the boundary angle it produces, giving a monotone
     * table that inverts to "p for a prescribed alpha'_w" by interpolation.
     * This is the precomputation described in the paper; doing the bisection
     * per frame instead would be far too slow to drag a slider through.
     */
    _buildLiftTable() {
      if (this._liftTable) return this._liftTable;
      const profile = this.profile;
      const h = PARAMS.observerHeight;
      const d = PARAMS.worldRadius;
      const previous = profile.p;

      // dToXYDirect avoids rebuilding the profile's arc-length table for each
      // trial parameter, which dominates the cost of this sweep.
      const angleForP = (p) => {
        profile.lift(p);
        const [x, z] = profile.dToXYDirect(d);
        return (angleAt([0, 0], [0, h], [x, z]) * 180) / Math.PI;
      };

      // Upper bound: for the spherical profile the first semicircle is the
      // documented limit; the others are unbounded, so grow until the target
      // range is covered.
      let pMax;
      if (this.name === 'Spherical') {
        pMax = profile.maxP();
      } else {
        pMax = 1e-4;
        let guard = 0;
        while (angleForP(pMax) < 179 && guard < 200) {
          pMax *= 1.7;
          guard += 1;
        }
      }

      const samples = 400;
      const ps = new Float64Array(samples + 1);
      const angles = new Float64Array(samples + 1);
      for (let i = 0; i <= samples; i += 1) {
        // Geometric-ish spacing: the boundary angle changes fastest for small p.
        const u = i / samples;
        const p = pMax * Math.pow(u, 2.4);
        ps[i] = p;
        angles[i] = angleForP(p);
      }

      const levels = [];
      for (let angle = LEVEL_MIN; angle <= LEVEL_MAX + 1e-9; angle += LEVEL_STEP) {
        levels.push({ alphaW: angle, p: this._invert(ps, angles, angle) });
      }
      // The first level is the flat world by construction.
      levels[0].p = 0;

      profile.lift(previous);
      this._liftTable = { ps, angles, pMax, levels };
      return this._liftTable;
    }

    /** Inverse of the sampled angle(p) relation, refined by bisection. */
    _invert(ps, angles, targetAngle) {
      const last = angles.length - 1;
      if (targetAngle <= angles[0]) return ps[0];
      if (targetAngle >= angles[last]) return ps[last];

      let lo = 0;
      let hi = last;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (angles[mid] <= targetAngle) lo = mid;
        else hi = mid;
      }

      const profile = this.profile;
      const h = PARAMS.observerHeight;
      const d = PARAMS.worldRadius;
      const angleForP = (p) => {
        profile.lift(p);
        const [x, z] = profile.dToXYDirect(d);
        return (angleAt([0, 0], [0, h], [x, z]) * 180) / Math.PI;
      };

      // The sampled bracket is already tight; a dozen bisection steps take the
      // boundary angle to well under a thousandth of a degree.
      let pLo = ps[lo];
      let pHi = ps[hi];
      for (let i = 0; i < 14; i += 1) {
        const pMid = 0.5 * (pLo + pHi);
        if (angleForP(pMid) < targetAngle) pLo = pMid;
        else pHi = pMid;
      }
      return 0.5 * (pLo + pHi);
    }

    get levels() {
      return this._buildLiftTable().levels;
    }

    /** Uplift parameter for a prescribed transformed boundary angle. */
    pForAngle(alphaWDeg) {
      const levels = this.levels;
      if (alphaWDeg <= levels[0].alphaW) return 0;
      const last = levels[levels.length - 1];
      if (alphaWDeg >= last.alphaW) return last.p;
      const position = (alphaWDeg - levels[0].alphaW) / LEVEL_STEP;
      const index = Math.min(levels.length - 2, Math.floor(position));
      const fraction = position - index;
      return levels[index].p + fraction * (levels[index + 1].p - levels[index].p);
    }

    /** Lifts the profile to the given boundary angle and returns it. */
    at(alphaWDeg) {
      this.profile.lift(this.pForAngle(alphaWDeg));
      return this.profile;
    }

    /**
     * Angle-to-distance lookup table for the current uplift, cached because
     * every camera pixel interpolates into it.
     *
     * Built by sampling the profile forward rather than by casting a ray per
     * table entry. Requirement (3) of the transformation — the apparent
     * ordering of points is preserved — means the viewing angle is strictly
     * increasing along the profile, so walking the profile and recording
     * (angle, arc length) produces the same table. Ray casting per entry costs
     * a quartic solve per angle for the angular profile; this does not.
     */
    lut(alphaWDeg, h = PARAMS.observerHeight, samples = 900) {
      const key = `${alphaWDeg.toFixed(4)}:${h.toFixed(3)}:${samples}`;
      const cached = this._lutCache.get(key);
      if (cached) return cached;

      const profile = this.at(alphaWDeg);
      const dw = PARAMS.worldRadius;

      // Dense inside the modelled world, then geometric so that the sampled
      // angles reach the transformed horizon (or 180 deg where there is none).
      const inner = 700;
      const outer = 400;
      const ts = new Float64Array(inner + outer);
      for (let i = 0; i < inner; i += 1) ts[i] = (i / (inner - 1)) * dw;
      for (let i = 0; i < outer; i += 1) {
        ts[inner + i] = dw * Math.pow(10, ((i + 1) / outer) * 3);
      }

      // Arc length is accumulated panel by panel between consecutive samples.
      // Calling arcLength(t) per sample would re-integrate from the origin
      // every time, which is quadratic and ruinous over a geometric range.
      const speed = (tau) => {
        const [dx, dz] = profile.derivativeAtT(tau);
        return Math.hypot(dx, dz);
      };

      const sampleAngles = new Float64Array(ts.length);
      const sampleArc = new Float64Array(ts.length);
      let count = 0;
      let previousAngle = -1;
      let accumulated = 0;
      for (let i = 0; i < ts.length; i += 1) {
        const t = ts[i];
        if (i > 0) accumulated += integrate(speed, ts[i - 1], t);
        const [x, z] = profile.tToXY(t);
        const angle = angleAt([0, 0], [0, h], [x, z]);
        if (!isFinite(angle) || angle <= previousAngle) break; // monotone only
        sampleAngles[count] = angle;
        sampleArc[count] = accumulated;
        previousAngle = angle;
        count += 1;
      }

      const theta = new Float64Array(samples);
      const distance = new Float64Array(samples);
      let cursor = 0;
      for (let i = 0; i < samples; i += 1) {
        const angle = (i / (samples - 1)) * Math.PI;
        theta[i] = angle;
        if (count === 0 || angle > sampleAngles[count - 1]) {
          distance[i] = Infinity; // above the transformed horizon
          continue;
        }
        while (cursor < count - 1 && sampleAngles[cursor + 1] < angle) cursor += 1;
        const a0 = sampleAngles[cursor];
        const a1 = sampleAngles[Math.min(count - 1, cursor + 1)];
        const s0 = sampleArc[cursor];
        const s1 = sampleArc[Math.min(count - 1, cursor + 1)];
        const span = a1 - a0;
        distance[i] = span < 1e-15 ? s0 : s0 + ((angle - a0) / span) * (s1 - s0);
      }

      const table = { theta, distance };
      if (this._lutCache.size > 24) this._lutCache.clear();
      this._lutCache.set(key, table);
      return table;
    }
  }

  /** Monotone table interpolation; non-finite entries stay non-finite. */
  function interpolate(table, angle) {
    const { theta, distance } = table;
    const last = theta.length - 1;
    if (angle <= theta[0]) return distance[0];
    if (angle >= theta[last]) return distance[last];

    const position = (angle / Math.PI) * last;
    const index = Math.min(last - 1, Math.floor(position));
    const a = distance[index];
    const b = distance[index + 1];
    if (!isFinite(a) || !isFinite(b)) return !isFinite(a) ? a : b;
    return a + (position - index) * (b - a);
  }

  /* ---------------------------------------------------------------- *
   * Camera — the pinhole model of the paper, at a reduced resolution
   * ---------------------------------------------------------------- */

  class Camera {
    constructor(options = {}) {
      this.scale = options.scale || 4; // 1 = full 801x601 sensor
      this.f = PARAMS.focalDistance;
      this.pixelSize = PARAMS.pixelSize * this.scale;
      this.N = Math.round(PARAMS.halfWidth / this.scale);
      this.M = Math.round(PARAMS.halfHeight / this.scale);
      this.alpha = PARAMS.viewingDirection;
      this.azimuth = PARAMS.azimuth;
      this.h = PARAMS.observerHeight;
      this._geometry = null;
      this._geometryKey = '';
    }

    get width() {
      return 2 * this.N + 1;
    }

    get height() {
      return 2 * this.M + 1;
    }

    /** Half of the vertical field of view, in degrees. */
    get halfVFov() {
      return (Math.atan((this.M * this.pixelSize) / this.f) * 180) / Math.PI;
    }

    get halfHFov() {
      return (Math.atan((this.N * this.pixelSize) / this.f) * 180) / Math.PI;
    }

    /** Per-pixel ray components before the azimuth rotation. */
    geometry() {
      const key = `${this.alpha}:${this.scale}`;
      if (this._geometry && this._geometryKey === key) return this._geometry;

      const width = this.width;
      const height = this.height;
      const size = width * height;
      const dx = new Float64Array(size);
      const dy = new Float64Array(size);
      const dz = new Float64Array(size);
      const pixelD = new Float64Array(size);

      const alphaRad = (this.alpha * Math.PI) / 180;
      const sinA = Math.sin(alphaRad);
      const cosA = Math.cos(alphaRad);

      for (let row = 0; row < height; row += 1) {
        // the j axis points upward, so the top image row is the largest j
        const j = this.M - row;
        const jm = j * this.pixelSize;
        const rowDy = this.f * sinA + jm * cosA;
        const rowDz = this.f * cosA - jm * sinA;
        for (let col = 0; col < width; col += 1) {
          const index = row * width + col;
          const im = (col - this.N) * this.pixelSize;
          dx[index] = im;
          dy[index] = rowDy;
          dz[index] = rowDz;
          pixelD[index] = Math.hypot(im, rowDy);
        }
      }

      this._geometry = { dx, dy, dz, pixelD, width, height };
      this._geometryKey = key;
      return this._geometry;
    }

    /** Distance field of the untransformed flat plane. */
    flatDistances() {
      const { dz, pixelD, width, height } = this.geometry();
      const d = new Float64Array(width * height);
      for (let i = 0; i < d.length; i += 1) {
        d[i] = dz[i] > 0 ? (this.h * pixelD[i]) / dz[i] : Infinity;
      }
      return d;
    }

    /**
     * Radial extension: the one-dimensional profile is rotated about the
     * vertical axis, so the visible distance depends only on the angle between
     * the ray and the downward vertical.
     */
    radialDistances(lut) {
      const { dz, pixelD, width, height } = this.geometry();
      const d = new Float64Array(width * height);
      for (let i = 0; i < d.length; i += 1) {
        d[i] = interpolate(lut, Math.atan2(pixelD[i], dz[i]));
      }
      return d;
    }

    /**
     * Directional extension: the profile is extruded laterally, so every pixel
     * in an image row shares one forward distance. The forward distance is then
     * converted to the radial distance used by the renderer.
     */
    directionalDistances(lut) {
      const { dy, dz, pixelD, width, height } = this.geometry();
      const d = new Float64Array(width * height);

      for (let row = 0; row < height; row += 1) {
        const index0 = row * width;
        const rowDy = dy[index0];
        const rowDz = dz[index0];

        /*
         * The directional construction only uplifts the half-plane in front
         * of the observer.  Rays that cross alpha = 0 point behind the
         * observer; if they still point downward they hit the unchanged flat
         * continuation of the ground rather than the sky.
         */
        if (rowDy <= 0) {
          for (let col = 0; col < width; col += 1) {
            const index = index0 + col;
            d[index] = dz[index] > 0 ? (this.h * pixelD[index]) / dz[index] : Infinity;
          }
          continue;
        }

        // In front of the observer, keep the full transformed angular range:
        // a lifted profile can be hit even by a ray whose vertical component
        // points upward (angles above 90 degrees).
        const forward = interpolate(lut, Math.atan2(rowDy, rowDz));
        for (let col = 0; col < width; col += 1) {
          const index = index0 + col;
          if (!isFinite(forward)) {
            d[index] = Infinity;
            continue;
          }
          const value = (pixelD[index] * forward) / rowDy;
          d[index] = isFinite(value) && value > 0 ? value : Infinity;
        }
      }
      return d;
    }

    /**
     * Reciprocal interpolation between the two extensions.
     *
     * Infinity is a meaningful distance here: its reciprocal is zero.  Do not
     * fall back to the other construction when only one branch is finite,
     * because that silently turns the mix into mu = 0 or mu = 1.  Applying the
     * reciprocal formula literally also gives the correct limiting behaviour
     * across the directional/radial horizons.
     */
    static mixDistances(directional, radial, mu) {
      const d = new Float64Array(directional.length);
      const wDirectional = 1 - mu;
      const wRadial = mu;
      for (let i = 0; i < d.length; i += 1) {
        const a = directional[i];
        const b = radial[i];
        const invA = isFinite(a) && a > 0 ? 1 / a : 0;
        const invB = isFinite(b) && b > 0 ? 1 / b : 0;
        const inverse = wDirectional * invA + wRadial * invB;
        d[i] = inverse > 0 ? 1 / inverse : Infinity;
      }
      return d;
    }

    distances(method, lut, mu = 0.5) {
      if (method === 'flat') return this.flatDistances();
      if (method === 'radial') return this.radialDistances(lut);
      if (method === 'directional') return this.directionalDistances(lut);
      if (method === 'mixed') {
        return Camera.mixDistances(
          this.directionalDistances(lut),
          this.radialDistances(lut),
          mu
        );
      }
      throw new Error(`Unknown extension: ${method}`);
    }

    /** Ground coordinates seen by each pixel, after the azimuth rotation. */
    groundCoordinates(distances) {
      const { dx, dy, pixelD, width, height } = this.geometry();
      const rx = new Float64Array(width * height);
      const ry = new Float64Array(width * height);
      const azRad = (-this.azimuth * Math.PI) / 180;
      const cosAz = Math.cos(azRad);
      const sinAz = Math.sin(azRad);

      for (let i = 0; i < rx.length; i += 1) {
        const d = distances[i];
        if (!isFinite(d) || pixelD[i] === 0) {
          rx[i] = NaN;
          ry[i] = NaN;
          continue;
        }
        const x = (dx[i] / pixelD[i]) * d;
        const y = (dy[i] / pixelD[i]) * d;
        rx[i] = cosAz * x + sinAz * y;
        ry[i] = -sinAz * x + cosAz * y;
      }
      return { rx, ry, width, height };
    }

    /**
     * Outlines of the visible ground regions, for top views.
     *
     * A camera FOV can split into more than one connected ground region when
     * it crosses a singular direction (notably the radial construction near
     * alpha = 180 deg).  Treating all finite perimeter samples as one polygon
     * connects the regions by a spurious long edge and makes the fill jump to
     * the opposite half-plane.  We therefore label connected finite pixels,
     * build the exposed cell-edge loops of each component, and map those loops
     * to ground coordinates.
     */
    fieldOfViewPolygons(distances, maxDistance = Infinity) {
      const { rx, ry, width, height } = this.groundCoordinates(distances);
      const size = width * height;
      const labels = new Int32Array(size);
      const components = [];
      let nextLabel = 0;

      const valid = (index) =>
        isFinite(rx[index]) && isFinite(ry[index]) &&
        isFinite(distances[index]) && distances[index] <= maxDistance;
      const neighbours = (index) => {
        const row = Math.floor(index / width);
        const col = index - row * width;
        const out = [];
        if (row > 0) out.push(index - width);
        if (col + 1 < width) out.push(index + 1);
        if (row + 1 < height) out.push(index + width);
        if (col > 0) out.push(index - 1);
        return out;
      };

      for (let seed = 0; seed < size; seed += 1) {
        if (labels[seed] !== 0 || !valid(seed)) continue;
        nextLabel += 1;
        const queue = [seed];
        labels[seed] = nextLabel;
        const pixels = [];
        for (let q = 0; q < queue.length; q += 1) {
          const index = queue[q];
          pixels.push(index);
          for (const nb of neighbours(index)) {
            if (labels[nb] === 0 && valid(nb)) {
              labels[nb] = nextLabel;
              queue.push(nb);
            }
          }
        }
        components.push({ label: nextLabel, pixels });
      }

      const vertexKey = (x, y) => `${x},${y}`;
      const parseVertex = (key) => key.split(',').map(Number);

      const groundAtVertex = (vx, vy, label) => {
        let sx = 0;
        let sy = 0;
        let count = 0;
        for (let dr = -1; dr <= 0; dr += 1) {
          for (let dc = -1; dc <= 0; dc += 1) {
            const row = vy + dr;
            const col = vx + dc;
            if (row < 0 || row >= height || col < 0 || col >= width) continue;
            const index = row * width + col;
            if (labels[index] !== label) continue;
            sx += rx[index];
            sy += ry[index];
            count += 1;
          }
        }
        return count ? [sx / count, sy / count] : null;
      };

      const polygons = [];
      for (const component of components) {
        const label = component.label;
        const edges = new Map();
        const addEdge = (x0, y0, x1, y1) => {
          const key = vertexKey(x0, y0);
          if (!edges.has(key)) edges.set(key, []);
          edges.get(key).push(vertexKey(x1, y1));
        };
        const same = (row, col) =>
          row >= 0 && row < height && col >= 0 && col < width &&
          labels[row * width + col] === label;

        for (const index of component.pixels) {
          const row = Math.floor(index / width);
          const col = index - row * width;
          // Directed clockwise in image coordinates (y increases downward).
          if (!same(row - 1, col)) addEdge(col, row, col + 1, row);
          if (!same(row, col + 1)) addEdge(col + 1, row, col + 1, row + 1);
          if (!same(row + 1, col)) addEdge(col + 1, row + 1, col, row + 1);
          if (!same(row, col - 1)) addEdge(col, row + 1, col, row);
        }

        while (edges.size) {
          const start = edges.keys().next().value;
          const loop = [];
          let current = start;
          let guard = 0;
          do {
            loop.push(current);
            const outgoing = edges.get(current);
            if (!outgoing || !outgoing.length) break;
            const next = outgoing.pop();
            if (!outgoing.length) edges.delete(current);
            current = next;
            guard += 1;
          } while (current !== start && guard <= component.pixels.length * 8 + 16);

          if (current !== start || loop.length < 3) continue;
          const points = [];
          for (const key of loop) {
            const [vx, vy] = parseVertex(key);
            const point = groundAtVertex(vx, vy, label);
            if (point && isFinite(point[0]) && isFinite(point[1])) points.push(point);
          }
          if (points.length > 2) {
            let twiceArea = 0;
            for (let i = 0; i < points.length; i += 1) {
              const a = points[i];
              const b = points[(i + 1) % points.length];
              twiceArea += a[0] * b[1] - b[0] * a[1];
            }
            // Suppress tiny loops caused by one or two marginal sensor cells.
            if (Math.abs(twiceArea) > 2) polygons.push(points);
          }
        }
      }

      return polygons;
    }

    /**
     * Piecewise-linear fill of the visible ground region.
     *
     * Mapping one large sensor-boundary polygon into the ground plane is not
     * reliable when the camera crosses the zenith: the projection can wrap
     * through infinity and the boundary polygon self-intersects.  Triangulating
     * the sensor locally avoids that global wrap.  Cells touching invalid rays
     * (or points beyond maxDistance) are simply omitted.
     */
    fieldOfViewMesh(distances, maxDistance = Infinity, stride = 3) {
      const { rx, ry, width, height } = this.groundCoordinates(distances);
      const triangles = [];
      const valid = (index) =>
        isFinite(rx[index]) && isFinite(ry[index]) &&
        isFinite(distances[index]) && distances[index] <= maxDistance;
      const point = (index) => [rx[index], ry[index]];
      const maxEdge = isFinite(maxDistance) ? Math.max(20, maxDistance * 0.35) : Infinity;
      const saneTriangle = (a, b, c) => {
        const ab = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const bc = Math.hypot(b[0] - c[0], b[1] - c[1]);
        const ca = Math.hypot(c[0] - a[0], c[1] - a[1]);
        return ab <= maxEdge && bc <= maxEdge && ca <= maxEdge;
      };

      const step = Math.max(1, Math.floor(stride));
      for (let row = 0; row < height - 1; row += step) {
        const nextRow = Math.min(height - 1, row + step);
        for (let col = 0; col < width - 1; col += step) {
          const nextCol = Math.min(width - 1, col + step);
          const i00 = row * width + col;
          const i10 = row * width + nextCol;
          const i01 = nextRow * width + col;
          const i11 = nextRow * width + nextCol;

          if (valid(i00) && valid(i10) && valid(i11)) {
            const a = point(i00);
            const b = point(i10);
            const c = point(i11);
            if (saneTriangle(a, b, c)) triangles.push([a, b, c]);
          }
          if (valid(i00) && valid(i11) && valid(i01)) {
            const a = point(i00);
            const b = point(i11);
            const c = point(i01);
            if (saneTriangle(a, b, c)) triangles.push([a, b, c]);
          }
        }
      }
      return triangles;
    }

    /**
     * Simple sensor-perimeter FOV outline.
     *
     * This is the original smooth construction and is ideal for the flat
     * plane, where the finite ground region is a single non-wrapping patch.
     * Transformed top views that can cross a singular direction use
     * fieldOfViewPolygons() instead.
     */
    fieldOfView(distances) {
      const { rx, ry, width, height } = this.groundCoordinates(distances);
      let firstRow = 0;
      for (let row = 0; row < height; row += 1) {
        if (isFinite(rx[row * width + 1])) {
          firstRow = row;
          break;
        }
      }
      const points = [];
      const push = (index) => {
        if (isFinite(rx[index]) && isFinite(ry[index])) points.push([rx[index], ry[index]]);
      };
      for (let col = 0; col < width; col += 1) push(firstRow * width + col);
      for (let row = firstRow; row < height; row += 1) push(row * width + (width - 1));
      for (let col = width - 1; col >= 0; col -= 1) push((height - 1) * width + col);
      for (let row = height - 1; row >= firstRow; row -= 1) push(row * width);
      return points;
    }
  }

  /* ---------------------------------------------------------------- *
   * Global state
   * ---------------------------------------------------------------- */

  const models = new Map();

  function model(name) {
    if (!models.has(name)) models.set(name, new ProfileModel(name));
    return models.get(name);
  }

  const listeners = new Set();

  const state = {
    profile: 'Parabolic',
    alphaW: 130,

    get model() {
      return model(this.profile);
    },

    get p() {
      return this.model.pForAngle(this.alphaW);
    },

    set(changes) {
      let changed = false;
      for (const [key, value] of Object.entries(changes)) {
        if (this[key] !== value) {
          this[key] = value;
          changed = true;
        }
      }
      if (changed) emit();
      return changed;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  let frame = null;
  function emit() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      listeners.forEach((listener) => listener(state));
    });
  }

  function redrawAll() {
    listeners.forEach((listener) => listener(state));
  }

  /**
   * The camera code works with the forward axis along +y (as render_grid.py
   * does); the paper puts the azimuth phi = 0 on the positive x-axis. Top views
   * are drawn in the paper's convention, so ground points are mapped here.
   */
  function toPaperPlane(point) {
    return [point[1], -point[0]];
  }

  global.TsunamiModel = {
    PARAMS,
    toPaperPlane,
    PROFILE_NAMES,
    PROFILE_SLOT,
    FLAT_BOUNDARY_ANGLE,
    LEVEL_MIN,
    LEVEL_MAX,
    LEVEL_STEP,
    ProfileModel,
    Camera,
    model,
    state,
    interpolate,
    redrawAll,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
