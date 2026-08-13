/*
 * Checks web/js/tsunami.js against values produced by build/reference.py.
 *
 * The strict comparison is against the "exact" columns, which scipy computes
 * with quad + brentq at tight tolerance. tsunami.py's own d_to_xy path is
 * reported alongside for context: it goes through np.gradient + trapezoid +
 * linear interpolation and carries a relative error near 1e-5, so it is not
 * the right thing to hold the port to.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
require(path.join(ROOT, 'web', 'js', 'tsunami.js'));
const { createProfile } = globalThis.TsunamiMath;

const reference = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'reference.json'), 'utf8')
);

const H = 100;
const WORLD_SIZE = 500;

/* Relative tolerances against the exact values. */
const RELATIVE_TOLERANCE = 1e-6;
const ABSOLUTE_FLOOR = 1e-7;

let failures = 0;
let checks = 0;
let worstPython = 0;
let worstJs = 0;

function decode(value) {
  if (value === 'inf') return Infinity;
  if (value === 'nan') return NaN;
  return value;
}

function relativeError(expected, actual) {
  if (!isFinite(expected) || !isFinite(actual)) {
    const same =
      (expected === Infinity && actual === Infinity) ||
      (Number.isNaN(expected) && Number.isNaN(actual));
    return same ? 0 : Infinity;
  }
  const denominator = Math.max(Math.abs(expected), ABSOLUTE_FLOOR);
  return Math.abs(expected - actual) / denominator;
}

function check(label, expectedRaw, actual, tolerance = RELATIVE_TOLERANCE) {
  const expected = decode(expectedRaw);
  checks += 1;
  const error = relativeError(expected, actual);
  worstJs = Math.max(worstJs, isFinite(error) ? error : 0);
  if (error > tolerance) {
    failures += 1;
    console.log(
      `  FAIL ${label}: expected ${expected}, got ${actual} (rel ${error.toExponential(2)})`
    );
  }
}

for (const [name, entry] of Object.entries(reference)) {
  const options = { worldSize: WORLD_SIZE, keepLengths: true };
  if (name === 'Hyperbolic') options.b = WORLD_SIZE;
  const profile = createProfile(name, options);

  for (const level of entry.levels) {
    const angle = (level.angle_deg * Math.PI) / 180;
    const tag = `${name} alpha_w=${level.angle_deg}`;

    const p = profile.angleToP(H, angle, WORLD_SIZE);
    check(`${tag} p`, level.p, p);
    profile.lift(p);

    // The transformed boundary really is seen under the requested angle.
    const boundary = (profile.boundaryAngle(H, WORLD_SIZE) * 180) / Math.PI;
    check(`${tag} boundary angle`, level.angle_deg, boundary, 1e-6);

    level.profile.forEach((point, index) => {
      const [x, z] = profile.dToXY(point.d);
      const t = profile.distanceToT(point.d);
      check(`${tag} d=${point.d} x`, point.x, x);
      check(`${tag} d=${point.d} z`, point.z, z);
      check(`${tag} d=${point.d} curvature`, point.curvature, profile.curvatureAtT(t));

      // Arc length really is preserved: |T(d)| along the curve equals d.
      check(`${tag} d=${point.d} arc length`, point.d, profile.tToS(t), 1e-6);

      const python = level.profile_python[index];
      worstPython = Math.max(
        worstPython,
        relativeError(decode(point.x), decode(python.x)),
        relativeError(decode(point.z), decode(python.z))
      );
    });

    for (const ray of level.rays) {
      const a = (ray.angle_deg * Math.PI) / 180;
      const t = profile.tSeenInDirection([Math.sin(a), -Math.cos(a)], H);
      const s = isFinite(t) ? profile.tToS(t) : Infinity;
      check(`${tag} ray=${ray.angle_deg} t`, ray.t, t, 1e-5);
      check(`${tag} ray=${ray.angle_deg} s`, ray.s, s, 1e-5);
    }
  }
}

console.log(`${checks - failures}/${checks} checks passed against exact values.`);
console.log(`  worst JS relative error       ${worstJs.toExponential(2)}`);
console.log(`  worst tsunami.py d_to_xy error ${worstPython.toExponential(2)}`);
if (failures > 0) {
  console.log(`${failures} FAILURES`);
  process.exitCode = 1;
}
