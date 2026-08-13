# -*- coding: utf-8 -*-
"""Dump reference values from tsunami.py so the JS port can be checked."""

import json
import math
import sys
from pathlib import Path

import numpy as np
from scipy.integrate import quad
from scipy.optimize import brentq

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tsunami import (  # noqa: E402
    AngularTsunami,
    HyperbolicTsunami,
    ParabolicTsunami,
    SphericalTsunami,
    calculate_angle,
)

H = 100.0
WORLD_SIZE = 500
DISTANCES = [0.0, 50.0, 125.0, 250.0, 375.0, 500.0]
ANGLES_DEG = [95.0, 110.0, 130.0, 150.0, 170.0]
RAY_ANGLES_DEG = [10.0, 45.0, 80.0, 95.0, 120.0, 160.0]


def make(name):
    if name == "Parabolic":
        return ParabolicTsunami(world_size=WORLD_SIZE, keep_lengths=True)
    if name == "Hyperbolic":
        return HyperbolicTsunami(a=WORLD_SIZE, world_size=WORLD_SIZE,
                                 keep_lengths=True)
    if name == "Angular":
        return AngularTsunami(world_size=WORLD_SIZE, keep_lengths=True)
    if name == "Spherical":
        return SphericalTsunami(world_size=WORLD_SIZE, keep_lengths=True)
    raise ValueError(name)


def exact_d_to_xy(tsunami, d):
    """Arc-length preserving map computed with tight quadrature.

    tsunami.py reaches the same quantity through s_to_xy, which uses
    np.gradient + trapezoid + linear interpolation over 1000 samples. That
    path carries a relative error of order 1e-5, so it is not a suitable
    reference for the JS port; this function is.
    """
    if d <= 0:
        return tsunami.t_to_xy(0.0)

    def speed(t):
        dx, dz = tsunami.derivative_at_t(t)
        return math.hypot(dx, dz)

    def arc(t):
        value, _ = quad(speed, 0.0, t, epsabs=1e-13, epsrel=1e-13, limit=200)
        return value

    t = brentq(lambda tt: arc(tt) - d, 0.0, d * 1.5 + 1.0,
               xtol=1e-13, rtol=1e-15)
    return tsunami.t_to_xy(t)


def safe(value):
    if value is None:
        return None
    value = float(value)
    if math.isinf(value):
        return "inf"
    if math.isnan(value):
        return "nan"
    return value


def angle_from_observer(point):
    return calculate_angle((0, 0), (0, H), point)


def exact_angle_to_p(tsunami, name, angle):
    """Uplift parameter for a prescribed boundary angle, evaluated on the
    exact arc-length map rather than the interpolated one."""
    d = float(WORLD_SIZE)
    if angle <= angle_from_observer((d, 0.0)):
        return 0.0

    def difference(p):
        old = tsunami.p
        tsunami.lift(p)
        point = exact_d_to_xy(tsunami, d)
        tsunami.lift(old)
        return angle_from_observer(point) - angle

    if name == "Spherical":
        p_hi = math.pi / d
        if difference(p_hi) <= 0:
            return p_hi
    else:
        p_hi = 1.0
        while difference(p_hi) < 0:
            p_hi *= 2

    return brentq(difference, 0.0, p_hi, xtol=1e-14, rtol=1e-15)


def main():
    result = {}

    for name in ("Parabolic", "Hyperbolic", "Angular", "Spherical"):
        tsunami = make(name)
        entry = {"levels": []}

        for angle_deg in ANGLES_DEG:
            angle = math.radians(angle_deg)
            p_python = tsunami.angle_to_p(H, angle, d=float(WORLD_SIZE))
            p_exact = exact_angle_to_p(tsunami, name, angle)

            tsunami.lift(p_python)
            profile_python = []
            for d in DISTANCES:
                x, y = tsunami.d_to_xy(d)
                profile_python.append({"d": d, "x": safe(x), "z": safe(y)})

            tsunami.lift(p_exact)
            profile_exact = []
            for d in DISTANCES:
                x, y = exact_d_to_xy(tsunami, d)
                t = tsunami.distance_to_t(d)
                profile_exact.append({
                    "d": d,
                    "x": safe(x),
                    "z": safe(y),
                    "curvature": safe(tsunami.curvature_at_t(t)),
                })

            rays = []
            for ray_deg in RAY_ANGLES_DEG:
                a = math.radians(ray_deg)
                v = (math.sin(a), -math.cos(a))
                t = tsunami.t_seen_in_direction(v, H)
                s = tsunami.t_to_s(t) if np.isfinite(t) else float("inf")
                rays.append({
                    "angle_deg": ray_deg,
                    "t": safe(t),
                    "s": safe(s),
                })

            entry["levels"].append({
                "angle_deg": angle_deg,
                "p_python": safe(p_python),
                "p": safe(p_exact),
                "profile_python": profile_python,
                "profile": profile_exact,
                "rays": rays,
            })

        result[name] = entry

    output = Path(__file__).resolve().parent / "reference.json"
    output.write_text(json.dumps(result, indent=1), encoding="utf8")
    print(f"wrote {output}")


if __name__ == "__main__":
    main()
