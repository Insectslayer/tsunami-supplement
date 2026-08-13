# -*- coding: utf-8 -*-
"""High-accuracy arc-length inversion, used to decide whether a disagreement
between tsunami.py and the JS port is an error in the port.

tsunami.py has two different paths to the same quantity:
  * distance_to_t -> s_to_t  uses scipy.quad + bisect (accurate)
  * d_to_xy       -> s_to_xy uses np.gradient + trapezoid + linear interp
                              over 1000 samples (low order)

This script integrates the analytic derivative with scipy.quad at tight
tolerance and inverts with brentq, so it is independent of both.
"""

import math
import sys
from pathlib import Path

from scipy.integrate import quad
from scipy.optimize import brentq

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tsunami import AngularTsunami, HyperbolicTsunami  # noqa: E402

H = 100.0
WORLD_SIZE = 500


def exact_s_to_xy(tsunami, s):
    def speed(t):
        dx, dz = tsunami.derivative_at_t(t)
        return math.hypot(dx, dz)

    def arc(t):
        value, _ = quad(speed, 0.0, t, epsabs=1e-13, epsrel=1e-13, limit=200)
        return value

    if s <= 0:
        return tsunami.t_to_xy(0.0)

    t = brentq(lambda tt: arc(tt) - s, 0.0, s * 1.5 + 1.0, xtol=1e-13, rtol=1e-15)
    return tsunami.t_to_xy(t)


def report(name, tsunami, angle_deg, distances):
    angle = math.radians(angle_deg)
    p = tsunami.angle_to_p(H, angle, d=float(WORLD_SIZE))
    tsunami.lift(p)
    print(f"\n{name}  alpha_w={angle_deg} deg  p={p!r}")
    print(f"{'d':>7} {'exact x':>16} {'tsunami.py x':>16} {'exact z':>16} {'tsunami.py z':>16}")
    for d in distances:
        ex, ez = exact_s_to_xy(tsunami, d)
        px, pz = tsunami.d_to_xy(d)
        print(f"{d:7.0f} {ex:16.9f} {px:16.9f} {ez:16.9f} {pz:16.9f}")


def main():
    report(
        "Angular",
        AngularTsunami(world_size=WORLD_SIZE, keep_lengths=True),
        170.0,
        [50, 125, 250, 500],
    )
    report(
        "Hyperbolic",
        HyperbolicTsunami(a=WORLD_SIZE, world_size=WORLD_SIZE, keep_lengths=True),
        170.0,
        [50, 125, 250, 500],
    )


if __name__ == "__main__":
    main()
