# -*- coding: utf-8 -*-
"""
Precompute lifting parameters for all tsunami methods.

For each supported method, this script computes parameter values ``p`` such
that the end-of-world ground point is seen from observer height ``H`` under the
requested viewing angles.

The numerical search is implemented by ``Tsunami.angle_to_p`` and, for a whole
sequence, by ``Tsunami.angles_to_params``. Method-specific behaviour, such as
the bounded first branch of ``SphericalTsunami``, therefore remains inside the
corresponding tsunami class instead of being duplicated here.

The results are saved as both JSON (human-readable) and NPZ (easy NumPy
loading).

Place this file in the same directory as ``tsunami.py`` and run:

    python precompute_tsunami_angle_params.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, Callable

import numpy as np

from tsunami import (
    Tsunami,
    AngularTsunami,
    HyperbolicTsunami,
    ParabolicTsunami,
    SphericalTsunami,
    make_angles_deg,
)


# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

H = 100.0
WORLD_SIZE = 500
D = float(WORLD_SIZE)

ALPHA_STEP_DEG = 5.0
ALPHA_START_DEG = (
    np.ceil(np.degrees(np.atan(WORLD_SIZE / H)) / ALPHA_STEP_DEG)
    * ALPHA_STEP_DEG
)
ALPHA_STOP_DEG = 180.0 - ALPHA_STEP_DEG

OUTPUT_JSON = Path(f"tsunami_angle_params_{WORLD_SIZE}.json")
OUTPUT_NPZ = Path(f"tsunami_angle_params_{WORLD_SIZE}.npz")


METHODS: dict[str, Callable[[], Tsunami]] = {
    "ParabolicTsunami": lambda: ParabolicTsunami(
        world_size=WORLD_SIZE,
        keep_lengths=True,
    ),
    "HyperbolicTsunami": lambda: HyperbolicTsunami(
        a=000,
        world_size=WORLD_SIZE,
        keep_lengths=True,
    ),
    "AngularTsunami": lambda: AngularTsunami(
        world_size=WORLD_SIZE,
        keep_lengths=True,
    ),
    "SphericalTsunami": lambda: SphericalTsunami(
        world_size=WORLD_SIZE,
        keep_lengths=True,
    ),
}


def compute_params_for_method(
    tsunami: Tsunami,
    angles_rad: np.ndarray,
    h: float,
    d: float,
) -> list[float | None]:
    """
    Compute lifting parameters for one tsunami method.

    The method delegates the actual numerical search to
    ``tsunami.angle_to_p`` through ``tsunami.angles_to_params``. If the whole
    sequence succeeds, the fast monotone path is used. If it fails, angles are
    retried individually so that the output remains aligned and failed values
    can be represented by ``None``.
    """
    try:
        return [
            float(p)
            for p in tsunami.angles_to_params(
                h=h,
                angles=angles_rad.tolist(),
                d=d,
                use_previous_as_start=True,
            )
        ]
    except (ValueError, RuntimeError, FloatingPointError, OverflowError):
        pass

    params: list[float | None] = []
    p_start = 0.0

    for angle in angles_rad:
        try:
            p = tsunami.angle_to_p(
                h=h,
                angle=float(angle),
                d=d,
                p_start=p_start,
            )
        except (ValueError, RuntimeError, FloatingPointError, OverflowError) as exc:
            print(
                f"{tsunami.name}: angle {math.degrees(angle):.1f} deg "
                f"failed: {exc}"
            )
            params.append(None)
            continue

        p = float(p)
        params.append(p)
        p_start = p

    return params


def main() -> None:
    angles_deg = make_angles_deg(
        ALPHA_START_DEG,
        ALPHA_STOP_DEG,
        ALPHA_STEP_DEG,
    )
    angles_rad = np.radians(angles_deg)

    result: dict[str, Any] = {
        "metadata": {
            "h": H,
            "world_size": WORLD_SIZE,
            "d": D,
            "alpha_start_deg": float(ALPHA_START_DEG),
            "alpha_stop_deg": float(ALPHA_STOP_DEG),
            "alpha_step_deg": float(ALPHA_STEP_DEG),
            "angle_definition": (
                "Angle measured at observer point (0,h), from the downward "
                "vertical direction towards the ray to the lifted point."
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

    for method_name, factory in METHODS.items():
        tsunami = factory()
        params = compute_params_for_method(
            tsunami=tsunami,
            angles_rad=angles_rad,
            h=H,
            d=D,
        )

        result["params"][method_name] = params
        npz_data[method_name] = np.asarray(
            [np.nan if p is None else p for p in params],
            dtype=float,
        )

    OUTPUT_JSON.write_text(
        json.dumps(result, indent=4),
        encoding="utf-8",
    )
    np.savez(str(OUTPUT_NPZ), **npz_data)

    print(f"Saved {OUTPUT_JSON}")
    print(f"Saved {OUTPUT_NPZ}")

    for method_name, params in result["params"].items():
        print(f"\n{method_name}")
        for angle_deg, p in zip(angles_deg, params):
            print(f"  {angle_deg:6.1f} deg: {p}")


if __name__ == "__main__":
    main()
