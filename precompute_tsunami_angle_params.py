# -*- coding: utf-8 -*-
"""
Precompute lifting parameters for all Tsunami methods.

For each supported method, this script computes parameter p values such that
an end-of-world ground point at distance d=world_size is seen from observer
height h under angles alpha_start, alpha_start+step, ..., alpha_stop degrees.

The result is saved both as JSON (human-readable) and NPZ (easy NumPy loading).

Place this file in the same directory as tsunami.py and run:
    python precompute_tsunami_angle_params.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, Callable

import numpy as np
from scipy.optimize import bisect

from tsunami import (
    AngularTsunami,
    HyperbolicTsunami,
    ParabolicTsunami,
    SphericalTsunami,
    calculate_angle,
)


# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

H = 100
WORLD_SIZE = 500
D = WORLD_SIZE

# Set this as needed. For flat ground and h=100, world_size=5000, the end point
# is already seen at about 88.85 degrees, so smaller angles are not reachable
# by positive lifting from p=0.
ALPHA_STEP_DEG = 5.0
ALPHA_START_DEG = np.ceil(np.degrees(np.atan(WORLD_SIZE/H))/ALPHA_STEP_DEG)*ALPHA_STEP_DEG
ALPHA_STOP_DEG = 180.0-ALPHA_STEP_DEG

OUTPUT_JSON = Path(f"tsunami_angle_params_{WORLD_SIZE}.json")
OUTPUT_NPZ = Path(f"tsunami_angle_params_{WORLD_SIZE}.npz")

# The value is either a factory only or (factory, p_max_function).
# SphericalTsunami reaches angle 180 deg at p = pi / d; after that the endpoint
# starts winding around, so the first monotone solution is in [0, pi/d].
METHODS: dict[str, tuple[Callable[[], Any], Callable[[], float | None]]] = {
    "ParabolicTsunami": (
        lambda: ParabolicTsunami(world_size=WORLD_SIZE, keep_lengths=True),
        lambda: None,
    ),
    "HyperbolicTsunami": (
        lambda: HyperbolicTsunami(world_size=WORLD_SIZE, keep_lengths=True),
        lambda: None,
    ),
    "AngularTsunami": (
        lambda: AngularTsunami(world_size=WORLD_SIZE, keep_lengths=True),
        lambda: None,
    ),
    "SphericalTsunami": (
        lambda: SphericalTsunami(world_size=WORLD_SIZE, keep_lengths=True),
        lambda: math.pi / D,
    ),
}


def make_angles_deg(start: float, stop: float, step: float) -> np.ndarray:
    """Return angles including stop if it lies on the arithmetic grid."""
    n = int(round((stop - start) / step))
    return start + step * np.arange(n + 1, dtype=float)


def angle_for_p(tsunami, p: float, h: float, d: float) -> float:
    """Angle of the lifted point at distance d for a temporary p value."""
    old_p = tsunami.p
    tsunami.lift(p)
    x, y = tsunami.d_to_xy(d)
    tsunami.lift(old_p)
    return calculate_angle((0, 0), (0, h), (x, y))


def find_p_for_angle(tsunami,
                     angle: float,
                     h: float,
                     d: float,
                     p_start: float = 0.0,
                     p_max: float | None = None,
                     tol: float = 1e-12) -> float:
    """
    Find p for which the point at distance d is visible under the given angle.

    For unbounded methods we find an upper bracket by doubling dp. For bounded
    methods, such as the first spherical branch, p_max is used as the upper
    bracket.
    """
    angle_start = angle_for_p(tsunami, p_start, h, d)

    if np.isclose(angle_start, angle, atol=tol):
        return p_start
    if angle_start > angle:
        raise ValueError(
            f"angle at p_start is already larger than target: "
            f"{math.degrees(angle_start):.8f} > {math.degrees(angle):.8f} deg"
        )

    if p_max is None:
        dp = 1.0
        p_hi = p_start + dp
        angle_hi = angle_for_p(tsunami, p_hi, h, d)
        while angle_hi < angle:
            dp *= 2.0
            p_hi = p_start + dp
            angle_hi = angle_for_p(tsunami, p_hi, h, d)
    else:
        p_hi = p_max
        angle_hi = angle_for_p(tsunami, p_hi, h, d)
        if angle_hi < angle:
            raise ValueError(
                f"target angle is not reachable before p_max: "
                f"{math.degrees(angle_hi):.8f} < {math.degrees(angle):.8f} deg"
            )

    return bisect(
        lambda p: angle_for_p(tsunami, p, h, d) - angle,
        p_start,
        p_hi,
        xtol=tol,
    )


def compute_params_for_method(tsunami,
                              angles_rad: np.ndarray,
                              p_max: float | None) -> list[float | None]:
    """
    Compute p values for one Tsunami instance.

    The previous solution is used as p_start for the next angle. This is faster
    and also follows the expected monotone growth of p with alpha.

    If some angle cannot be solved, None is stored in JSON. This keeps the
    output aligned with the angle list.
    """
    params: list[float | None] = []
    p_start = 0.0

    for angle in angles_rad:
        try:
            p = float(find_p_for_angle(tsunami, angle, H, D, p_start, p_max))
        except Exception as exc:
            print(f"{tsunami.name}: angle {math.degrees(angle):.1f} deg failed: {exc}")
            params.append(None)
            continue

        params.append(p)
        p_start = p

    return params


def main() -> None:
    angles_deg = make_angles_deg(ALPHA_START_DEG, ALPHA_STOP_DEG,
                                 ALPHA_STEP_DEG)
    angles_rad = np.radians(angles_deg)

    result: dict[str, Any] = {
        "metadata": {
            "h": H,
            "world_size": WORLD_SIZE,
            "d": D,
            "alpha_start_deg": ALPHA_START_DEG,
            "alpha_stop_deg": ALPHA_STOP_DEG,
            "alpha_step_deg": ALPHA_STEP_DEG,
            "angle_definition": (
                "Angle in radians/degrees as used by calculate_angle: "
                "angle at observer point (0,h) between downward vertical "
                "towards (0,0) and the ray to the lifted point."
            ),
        },
        "angles_deg": angles_deg.tolist(),
        "angles_rad": angles_rad.tolist(),
        "params": {},
    }

    npz_data: dict[str, np.ndarray] = {
        "angles_deg": angles_deg,
        "angles_rad": angles_rad,
    }

    for method_name, (factory, p_max_factory) in METHODS.items():
        tsunami = factory()
        p_max = p_max_factory()
        params = compute_params_for_method(tsunami, angles_rad, p_max)
        result["params"][method_name] = params
        npz_data[method_name] = np.array(
            [np.nan if p is None else p for p in params], dtype=float
        )

    OUTPUT_JSON.write_text(json.dumps(result, indent=4), encoding="utf-8")
    np.savez(OUTPUT_NPZ, **npz_data)

    print(f"Saved {OUTPUT_JSON}")
    print(f"Saved {OUTPUT_NPZ}")    

    # Small preview in the terminal.
    for method_name, params in result["params"].items():
        print(f"\n{method_name}")
        for a, p in zip(angles_deg, params):
            print(f"  {a:6.1f} deg: {p}")


if __name__ == "__main__":
    main()
