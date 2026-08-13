/*
 * tsunami.js — JavaScript port of the profile mathematics in tsunami.py.
 *
 * A tsunami profile is a curve in the vertical viewing plane that the flat
 * ground is mapped onto. Four scalars are used throughout and must not be
 * confused:
 *
 *   p  the uplift parameter (state of the profile object); p = 0 is flat
 *   t  the native curve parameter of the profile
 *   s  arc length along the lifted profile, measured from the origin
 *   d  distance on the original flat ground
 *
 * With arc-length preservation (the paper's requirement 2) an original ground
 * distance d is mapped through s, so d -> t requires inverting the arc-length
 * integral. Every profile therefore exposes sToT()/dToXY(); the spherical
 * profile is already arc-length parametrised and overrides them with the
 * identity.
 */
(function (global) {
  'use strict';

  const EPS = 1e-12;
  const isClose = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

  /* ---------------------------------------------------------------- *
   * Gauss-Legendre quadrature (10 point) used for arc-length integrals
   * ---------------------------------------------------------------- */
  const GL_NODES = [
    -0.9739065285171717, -0.8650633666889845, -0.6794095682990244,
    -0.4333953941292472, -0.14887433898163122, 0.14887433898163122,
    0.4333953941292472, 0.6794095682990244, 0.8650633666889845,
    0.9739065285171717,
  ];
  const GL_WEIGHTS = [
    0.06667134430868814, 0.14945134915058059, 0.21908636251598204,
    0.26926671930999635, 0.29552422471475287, 0.29552422471475287,
    0.26926671930999635, 0.21908636251598204, 0.14945134915058059,
    0.06667134430868814,
  ];

  function integrate(fn, a, b) {
    const half = 0.5 * (b - a);
    const mid = 0.5 * (a + b);
    let sum = 0;
    for (let i = 0; i < GL_NODES.length; i += 1) {
      sum += GL_WEIGHTS[i] * fn(mid + half * GL_NODES[i]);
    }
    return sum * half;
  }

  /**
   * Robust bracketed root finder (bisection with a false-position assist).
   * Mirrors the paper's preference for bisection over open methods.
   */
  function bisect(fn, lo, hi, tol = 1e-10, maxIter = 200) {
    let flo = fn(lo);
    let fhi = fn(hi);
    if (flo === 0) return lo;
    if (fhi === 0) return hi;
    if (flo * fhi > 0) return NaN;

    for (let i = 0; i < maxIter; i += 1) {
      const mid = 0.5 * (lo + hi);
      const fmid = fn(mid);
      if (fmid === 0 || 0.5 * (hi - lo) < tol) return mid;
      if (flo * fmid < 0) {
        hi = mid;
        fhi = fmid;
      } else {
        lo = mid;
        flo = fmid;
      }
    }
    return 0.5 * (lo + hi);
  }

  /** Angle A-B-C at vertex B, in [0, pi]. Port of calculate_angle(). */
  function angleAt(a, b, c) {
    const bax = a[0] - b[0];
    const bay = a[1] - b[1];
    const bcx = c[0] - b[0];
    const bcy = c[1] - b[1];
    const na = Math.hypot(bax, bay);
    const nc = Math.hypot(bcx, bcy);
    if (na < EPS || nc < EPS) return 0;
    const cosine = (bax * bcx + bay * bcy) / (na * nc);
    return Math.acos(Math.min(1, Math.max(-1, cosine)));
  }

  /* ---------------------------------------------------------------- *
   * Real roots of a quartic, used by the angular profile.
   * Durand-Kerner iteration on the complex plane; the ordering of the
   * returned roots carries no geometric meaning (see "Numerical
   * robustness" in the paper), so callers must filter candidates.
   * ---------------------------------------------------------------- */
  function realRoots(coefficients) {
    const degree = coefficients.length - 1;
    const lead = coefficients[0];
    if (Math.abs(lead) < 1e-14) return realRoots(coefficients.slice(1));
    const c = coefficients.map((value) => value / lead);

    let re = [];
    let im = [];
    for (let i = 0; i < degree; i += 1) {
      const angle = (2 * Math.PI * i) / degree + 0.5;
      re.push(0.4 * Math.cos(angle) + 0.9 * Math.cos(angle));
      im.push(0.4 * Math.sin(angle) + 0.9 * Math.sin(angle));
    }

    const evaluate = (x, y) => {
      let pr = 1;
      let pi = 0;
      for (let k = 1; k <= degree; k += 1) {
        const nr = pr * x - pi * y + c[k];
        const ni = pr * y + pi * x;
        pr = nr;
        pi = ni;
      }
      return [pr, pi];
    };

    for (let iter = 0; iter < 200; iter += 1) {
      let maxDelta = 0;
      for (let i = 0; i < degree; i += 1) {
        const [fr, fi] = evaluate(re[i], im[i]);
        let dr = 1;
        let di = 0;
        for (let j = 0; j < degree; j += 1) {
          if (i === j) continue;
          const xr = re[i] - re[j];
          const xi = im[i] - im[j];
          const nr = dr * xr - di * xi;
          const ni = dr * xi + di * xr;
          dr = nr;
          di = ni;
        }
        const denominator = dr * dr + di * di;
        if (denominator < 1e-300) continue;
        const qr = (fr * dr + fi * di) / denominator;
        const qi = (fi * dr - fr * di) / denominator;
        re[i] -= qr;
        im[i] -= qi;
        maxDelta = Math.max(maxDelta, Math.hypot(qr, qi));
      }
      if (maxDelta < 1e-14) break;
    }

    const roots = [];
    for (let i = 0; i < degree; i += 1) {
      if (Math.abs(im[i]) < 1e-7) roots.push(re[i]);
    }
    return roots;
  }

  /* ---------------------------------------------------------------- *
   * Base profile
   * ---------------------------------------------------------------- */
  class Tsunami {
    constructor(options = {}) {
      this.worldSize = options.worldSize != null ? options.worldSize : 500;
      this.keepLengths = options.keepLengths !== false;
      this._p = 0;
      this._arcCache = null;
    }

    get name() {
      return this.constructor.profileName;
    }

    get p() {
      return this._p;
    }

    lift(value) {
      if (this._p !== value) {
        this._p = value;
        this._arcCache = null;
      }
      return this;
    }

    /* --- to be provided by subclasses --- */
    tToXY() {
      throw new Error('not implemented');
    }

    derivativeAtT() {
      throw new Error('not implemented');
    }

    secondDerivativeAtT() {
      throw new Error('not implemented');
    }

    tSeenInDirection() {
      throw new Error('not implemented');
    }

    /* --- geometry shared by every profile --- */
    signedCurvatureAtT(t) {
      const [dx, dz] = this.derivativeAtT(t);
      const [ddx, ddz] = this.secondDerivativeAtT(t);
      const speedSq = dx * dx + dz * dz;
      if (speedSq < EPS) return NaN;
      return (dx * ddz - dz * ddx) / Math.pow(speedSq, 1.5);
    }

    curvatureAtT(t) {
      return Math.abs(this.signedCurvatureAtT(t));
    }

    curvatureRadiusAtT(t) {
      const curvature = this.curvatureAtT(t);
      return curvature < 1e-14 ? Infinity : 1 / curvature;
    }

    tToNormal(t) {
      const [dx, dz] = this.derivativeAtT(t);
      const length = Math.hypot(dx, dz);
      if (length < EPS) return [0, 1];
      return [-dz / length, dx / length];
    }

    /** Arc length from the origin to parameter t. */
    arcLength(t) {
      if (!isFinite(t)) return t;
      if (t <= 0) return 0;
      const integrand = (tau) => {
        const [dx, dz] = this.derivativeAtT(tau);
        return Math.hypot(dx, dz);
      };
      // Composite Gauss-Legendre keeps the relative error near 1e-12 for the
      // curvatures used here without the cost of adaptive subdivision. The cap
      // matters for t far outside the modelled world, where the profile is
      // nearly straight and extra panels buy nothing.
      const panels = Math.min(
        4096,
        Math.max(4, Math.ceil(t / (this.worldSize / 32)))
      );
      const step = t / panels;
      let total = 0;
      for (let i = 0; i < panels; i += 1) {
        total += integrate(integrand, i * step, (i + 1) * step);
      }
      return total;
    }

    /**
     * Table of (t, s) pairs covering the modelled world, used to invert the
     * arc-length relation by interpolation instead of per-point root finding.
     */
    _arcTable() {
      if (this._arcCache) return this._arcCache;
      const n = 400;
      const tMax = this._maxTForWorld();
      const ts = new Float64Array(n + 1);
      const ss = new Float64Array(n + 1);
      const integrand = (tau) => {
        const [dx, dz] = this.derivativeAtT(tau);
        return Math.hypot(dx, dz);
      };
      let total = 0;
      ts[0] = 0;
      ss[0] = 0;
      const step = tMax / n;
      for (let i = 1; i <= n; i += 1) {
        total += integrate(integrand, (i - 1) * step, i * step);
        ts[i] = i * step;
        ss[i] = total;
      }
      this._arcCache = { ts, ss };
      return this._arcCache;
    }

    /** Upper bound on t needed to cover an arc length of one world radius. */
    _maxTForWorld() {
      return this.worldSize * 1.05;
    }

    /**
     * Inverse arc length: the parameter t whose arc length equals s.
     *
     * The table gives the bracket and a first guess; Newton steps against the
     * exact integral over the enclosing panel then remove the interpolation
     * error, which is otherwise visible (~1e-4 relative) on strongly bent
     * profiles.
     */
    sToT(s) {
      if (!isFinite(s)) return s;
      if (s <= 0) return 0;
      const { ts, ss } = this._arcTable();
      const last = ss.length - 1;
      if (s >= ss[last]) {
        // Extrapolate with a local bisection beyond the tabulated range.
        return bisect((t) => this.arcLength(t) - s, ts[last], ts[last] * 4 + s, 1e-9);
      }
      let lo = 0;
      let hi = last;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (ss[mid] <= s) lo = mid;
        else hi = mid;
      }
      const span = ss[hi] - ss[lo];
      const fraction = span < EPS ? 0 : (s - ss[lo]) / span;
      let t = ts[lo] + fraction * (ts[hi] - ts[lo]);

      const speed = (tau) => {
        const [dx, dz] = this.derivativeAtT(tau);
        return Math.hypot(dx, dz);
      };
      const base = ss[lo];
      const tBase = ts[lo];
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const residual = base + integrate(speed, tBase, t) - s;
        const derivative = speed(t);
        if (derivative < EPS) break;
        const step = residual / derivative;
        t -= step;
        if (Math.abs(step) < 1e-12 * Math.max(1, Math.abs(t))) break;
      }
      return t;
    }

    tToS(t) {
      return this.arcLength(t);
    }

    /**
     * Arc-length inversion for a single distance, without building or touching
     * the interpolation table.
     *
     * Newton against the exact integral. Every profile here has |g'| >= 1, so
     * t <= s is a safe starting point and the iteration converges in a handful
     * of steps. Used where only one or two points are needed per uplift value
     * (the alpha'_w -> p precomputation), which would otherwise rebuild the
     * whole table for each trial parameter.
     */
    sToTDirect(s) {
      if (!isFinite(s)) return s;
      if (s <= 0) return 0;
      let t = s;
      for (let iteration = 0; iteration < 40; iteration += 1) {
        const residual = this.arcLength(t) - s;
        const [dx, dz] = this.derivativeAtT(t);
        const derivative = Math.hypot(dx, dz);
        if (derivative < EPS) break;
        const step = residual / derivative;
        t -= step;
        if (t < 0) t = 0;
        if (Math.abs(step) < 1e-12 * Math.max(1, Math.abs(t))) break;
      }
      return t;
    }

    dToXYDirect(d) {
      return this.keepLengths ? this.tToXY(this.sToTDirect(d)) : this.tToXY(d);
    }

    /** Original ground distance -> native parameter. */
    distanceToT(d) {
      return this.keepLengths ? this.sToT(d) : d;
    }

    sToXY(s) {
      return this.tToXY(this.sToT(s));
    }

    /** Original ground distance -> point on the lifted profile. */
    dToXY(d) {
      return this.keepLengths ? this.sToXY(d) : this.tToXY(d);
    }

    curvatureAtDistance(d) {
      return this.curvatureAtT(this.distanceToT(d));
    }

    /** Lifted coordinates, unit normals, curvature and curvature radius. */
    groundGeometry(distances) {
      const n = distances.length;
      const x = new Float64Array(n);
      const z = new Float64Array(n);
      const nx = new Float64Array(n);
      const nz = new Float64Array(n);
      const curvature = new Float64Array(n);
      const radius = new Float64Array(n);
      for (let i = 0; i < n; i += 1) {
        const t = this.distanceToT(distances[i]);
        const [px, pz] = this.tToXY(t);
        const [ux, uz] = this.tToNormal(t);
        const k = this.curvatureAtT(t);
        x[i] = px;
        z[i] = pz;
        nx[i] = ux;
        nz[i] = uz;
        curvature[i] = k;
        radius[i] = k < 1e-14 ? Infinity : 1 / k;
      }
      return { x, z, nx, nz, curvature, radius };
    }

    upliftGround(distances) {
      const x = new Float64Array(distances.length);
      const z = new Float64Array(distances.length);
      for (let i = 0; i < distances.length; i += 1) {
        const [px, pz] = this.dToXY(distances[i]);
        x[i] = px;
        z[i] = pz;
      }
      return { x, z };
    }

    /**
     * Lookup table mapping the viewing angle theta (measured from the downward
     * vertical) to the original ground distance visible in that direction.
     */
    buildLutTheta(h, thetaMax = Math.PI, n = 720) {
      const theta = new Float64Array(n);
      const s = new Float64Array(n);
      for (let i = 0; i < n; i += 1) {
        const angle = (i / (n - 1)) * thetaMax;
        theta[i] = angle;
        const t = this.tSeenInDirection([Math.sin(angle), -Math.cos(angle)], h);
        s[i] = isFinite(t) ? this.tToS(t) : Infinity;
      }
      return { theta, s };
    }

    /**
     * Uplift parameter p for which the point at ground distance d is seen from
     * (0, h) under the given angle. Returns 0 when the requested angle is not
     * larger than the flat-ground angle.
     */
    angleToP(h, angle, d = 0, pStart = 0, tol = 1e-10) {
      const distance = d === 0 ? this.worldSize : d;
      const flatAngle = angleAt([0, 0], [0, h], [distance, 0]);
      if (angle <= flatAngle + tol) return 0;

      const angleForP = (param) => {
        const old = this._p;
        this.lift(param);
        const [x, z] = this.dToXY(distance);
        this.lift(old);
        return angleAt([0, 0], [0, h], [x, z]);
      };

      const startAngle = angleForP(pStart);
      if (Math.abs(startAngle - angle) <= tol) return pStart;
      if (startAngle > angle) return pStart;

      let dp = 1;
      let guard = 0;
      while (angleForP(pStart + dp) < angle && guard < 200) {
        dp *= 2;
        guard += 1;
      }
      return bisect((param) => angleForP(param) - angle, pStart, pStart + dp, tol);
    }

    /** Uplift parameters for an increasing sequence of boundary angles. */
    anglesToParams(h, angles, d = 0) {
      const params = [];
      let pStart = 0;
      for (const angle of angles) {
        const p = this.angleToP(h, angle, d, pStart);
        params.push(p);
        pStart = p;
      }
      return params;
    }

    /** Viewing angle of the transformed world boundary for the current p. */
    boundaryAngle(h, d = 0) {
      const distance = d === 0 ? this.worldSize : d;
      const [x, z] = this.dToXY(distance);
      return angleAt([0, 0], [0, h], [x, z]);
    }
  }

  /* ---------------------------------------------------------------- *
   * Parabolic:  (x', z') = (x, p x^2)
   * ---------------------------------------------------------------- */
  class ParabolicTsunami extends Tsunami {
    tToXY(t) {
      return [t, this._p * t * t];
    }

    derivativeAtT(t) {
      return [1, 2 * this._p * t];
    }

    secondDerivativeAtT() {
      return [0, 2 * this._p];
    }

    /** Closed form: integral of sqrt(1 + 4p^2 x^2). */
    arcLength(t) {
      if (!isFinite(t)) return t;
      if (t <= 0) return 0;
      const a = 2 * this._p;
      if (Math.abs(a) < 1e-14) return t;
      const u = a * t;
      return (t * Math.sqrt(1 + u * u)) / 2 + Math.asinh(u) / (2 * a);
    }

    tSeenInDirection(v, h) {
      const [v1, v2] = v;
      const a = this._p;
      if (isClose(v1, 0)) return v2 >= 0 ? Infinity : 0;
      if (isClose(a, 0)) return v2 >= 0 ? Infinity : (-v1 * h) / v2;
      return (v2 + Math.sqrt(v2 * v2 + 4 * a * h * v1 * v1)) / (2 * a * v1);
    }

    xyToP(x, z) {
      return z / (x * x);
    }
  }
  ParabolicTsunami.profileName = 'Parabolic';

  /* ---------------------------------------------------------------- *
   * Hyperbolic: (x', z') = (x, sqrt(p^2 x^2 + b^2) - b)
   *
   * The paper calls the offset b; tsunami.py calls it a.
   * ---------------------------------------------------------------- */
  class HyperbolicTsunami extends Tsunami {
    constructor(options = {}) {
      super(options);
      this._b = options.b != null ? options.b : options.worldSize || 500;
    }

    get b() {
      return this._b;
    }

    set b(value) {
      if (this._b !== value) {
        this._b = value;
        this._arcCache = null;
      }
    }

    tToXY(t) {
      const p = this._p;
      const b = this._b;
      return [t, Math.sqrt(b * b + p * p * t * t) - b];
    }

    derivativeAtT(t) {
      const p = this._p;
      const b = this._b;
      if (isClose(b, 0)) return [1, p];
      const denominator = Math.sqrt(p * p * t * t + b * b);
      return [1, (p * p * t) / denominator];
    }

    secondDerivativeAtT(t) {
      const p = this._p;
      const b = this._b;
      const denominator = Math.pow(b * b + p * p * t * t, 1.5);
      if (denominator < EPS) return [0, 0];
      return [0, (p * p * b * b) / denominator];
    }

    arcLength(t) {
      if (isClose(this._b, 0)) return t * Math.sqrt(1 + this._p * this._p);
      return super.arcLength(t);
    }

    sToT(s) {
      if (isClose(this._b, 0)) return s / Math.sqrt(1 + this._p * this._p);
      return super.sToT(s);
    }

    tSeenInDirection(v, h) {
      const [v1, v2] = v;
      const p = this._p;
      const b = this._b;

      if (isClose(p, 0)) {
        if (v2 >= 0) return Infinity;
        if (isClose(v1, 0)) return 0;
        return (-v1 * h) / v2;
      }
      if (isClose(b, 0)) {
        const denominator = p * v1 - v2;
        if (denominator <= 0) return Infinity;
        if (isClose(v1, 0)) return 0;
        return (h * v1) / denominator;
      }
      if (v2 >= p * v1) return Infinity;
      if (isClose(v1, 0)) return 0;

      const q = v2 / v1;
      const c1 = p * p - q * q;
      const c2 = (b + h) * q;
      if (isClose(c1, 0)) return (-h * (h + 2 * b)) / (2 * c2);

      let discriminant = c2 * c2 + h * (2 * b + h) * c1;
      if (discriminant < 0 && isClose(discriminant, 0, 1e-6)) discriminant = 0;
      if (discriminant < 0) return Infinity;
      return (c2 + Math.sqrt(discriminant)) / c1;
    }

    /** Transformed horizon: 90 deg + arctan(p). */
    horizonAngle() {
      return Math.PI / 2 + Math.atan(this._p);
    }

    xyToP(x, z) {
      return Math.sqrt(z * (z + 2 * this._b)) / x;
    }
  }
  HyperbolicTsunami.profileName = 'Hyperbolic';

  /* ---------------------------------------------------------------- *
   * Angular: viewing angles from the effective height h' = 1/p are doubled
   * while the distance to the observer is preserved.
   * ---------------------------------------------------------------- */
  class AngularTsunami extends Tsunami {
    tToXY(t) {
      const kappa = this._p;
      if (isClose(kappa, 0)) return [t, 0];
      const hEff = 1 / kappa;
      const d = Math.sqrt(hEff * hEff + t * t);
      return [(2 * t * hEff) / d, hEff - (hEff * hEff - t * t) / d];
    }

    derivativeAtT(t) {
      const kappa = this._p;
      if (isClose(kappa, 0)) return [1, 0];
      const hEff = 1 / kappa;
      const d3 = Math.pow(Math.sqrt(hEff * hEff + t * t), 3);
      return [(2 * hEff * hEff * hEff) / d3, (t * (3 * hEff * hEff + t * t)) / d3];
    }

    secondDerivativeAtT(t) {
      const kappa = this._p;
      if (isClose(kappa, 0)) return [0, 0];
      const hEff = 1 / kappa;
      const denominator = Math.pow(hEff * hEff + t * t, 2.5);
      return [
        (-6 * hEff * hEff * hEff * t) / denominator,
        (3 * hEff * hEff * (hEff * hEff - t * t)) / denominator,
      ];
    }

    tSeenInDirection(v, h) {
      const [v1, v2] = v;
      const p = this._p;
      if (isClose(v1, 0)) return v2 >= 0 ? Infinity : 0;
      if (isClose(p, 0)) return v2 >= 0 ? Infinity : (-v1 * h) / v2;

      const q = v1 * v1 * (1 - h * p) * (1 - h * p);
      const coefficients = [
        v1 * v1,
        -4 * v1 * v2,
        4 * v2 * v2 - 2 * v1 * v1 - q,
        4 * v1 * v2,
        v1 * v1 - q,
      ];

      const candidates = [];
      for (const u of realRoots(coefficients)) {
        if (u < 0) continue;
        const residual =
          v1 * (1 - h * p) * Math.sqrt(1 + u * u) - v1 * (1 - u * u) - 2 * v2 * u;
        if (Math.abs(residual) > 1e-6 * Math.max(1, Math.abs(v1))) continue;
        const x = (2 * u) / (p * Math.sqrt(1 + u * u));
        const rayParameter = x / v1;
        if (rayParameter >= 0) candidates.push([rayParameter, u]);
      }
      if (candidates.length === 0) return Infinity;
      candidates.sort((a, b) => a[0] - b[0]);
      return candidates[0][1] / p;
    }

    /** The profile converges to the vertical line x' = 2h'. */
    limitX() {
      return isClose(this._p, 0) ? Infinity : 2 / this._p;
    }
  }
  AngularTsunami.profileName = 'Angular';

  /* ---------------------------------------------------------------- *
   * Spherical: the ground is wrapped onto a circle of radius r = 1/p.
   * Already parametrised by arc length.
   * ---------------------------------------------------------------- */
  class SphericalTsunami extends Tsunami {
    tToXY(t) {
      const kappa = this._p;
      if (isClose(kappa, 0)) return [t, 0];
      const alpha = t * kappa;
      return [Math.sin(alpha) / kappa, (1 - Math.cos(alpha)) / kappa];
    }

    derivativeAtT(t) {
      const alpha = t * this._p;
      return [Math.cos(alpha), Math.sin(alpha)];
    }

    secondDerivativeAtT(t) {
      const kappa = this._p;
      const alpha = kappa * t;
      return [-kappa * Math.sin(alpha), kappa * Math.cos(alpha)];
    }

    signedCurvatureAtT() {
      return this._p;
    }

    arcLength(t) {
      return t;
    }

    sToT(s) {
      return s;
    }

    sToXY(s) {
      return this.tToXY(s);
    }

    tSeenInDirection(v, h) {
      if (h * this._p > 2) return Infinity;
      let [v1, v2] = v;
      const length = Math.hypot(v1, v2);
      if (length < EPS) return Infinity;
      v1 /= length;
      v2 /= length;
      if (isClose(this._p, 0)) return v2 >= 0 ? Infinity : (-v1 * h) / v2;

      const r = 1 / this._p;
      const t = v2 * (r - h) + Math.sqrt(v2 * v2 * (r - h) * (r - h) + h * (2 * r - h));
      const angle = Math.atan2(t * v1, r - h - t * v2);
      const s = Math.abs(angle) * r;
      return isClose(s, 0) ? 0 : s;
    }

    /** Restricted to the first semicircle: 0 <= p <= pi / worldSize. */
    maxP() {
      return Math.PI / this.worldSize;
    }

    angleToP(h, angle, d = 0, pStart = 0, tol = 1e-10) {
      const distance = d === 0 ? this.worldSize : d;
      const flatAngle = angleAt([0, 0], [0, h], [distance, 0]);
      if (angle <= flatAngle) return 0;
      const pMax = Math.PI / distance;
      if (angle >= Math.PI) return pMax;

      const difference = (p) => {
        const old = this._p;
        this.lift(p);
        const [x, z] = this.dToXY(distance);
        this.lift(old);
        return angleAt([0, 0], [0, h], [x, z]) - angle;
      };
      const root = bisect(difference, 0, pMax, tol);
      return isFinite(root) ? root : pMax;
    }

    xyToP(x, z) {
      return (2 * z) / (x * x + z * z);
    }
  }
  SphericalTsunami.profileName = 'Spherical';

  const PROFILES = {
    Parabolic: ParabolicTsunami,
    Hyperbolic: HyperbolicTsunami,
    Angular: AngularTsunami,
    Spherical: SphericalTsunami,
  };

  function createProfile(name, options) {
    const Profile = PROFILES[name];
    if (!Profile) throw new Error(`Unknown tsunami profile: ${name}`);
    return new Profile(options);
  }

  const api = {
    Tsunami,
    ParabolicTsunami,
    HyperbolicTsunami,
    AngularTsunami,
    SphericalTsunami,
    PROFILES,
    createProfile,
    angleAt,
    bisect,
    realRoots,
    integrate,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.TsunamiMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
