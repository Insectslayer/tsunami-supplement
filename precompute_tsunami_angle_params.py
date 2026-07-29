# -*- coding: utf-8 -*-
"""Precompute and cache tsunami lifting parameters.

The public function :func:`load_or_compute_angle_params` is intended for use
by interactive scripts.  It loads cached values only when all parameters that
influence the result agree with the current configuration; otherwise it
recomputes the values and replaces the cache.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable, Sequence

import numpy as np

from tsunami import (
    Tsunami,
    AngularTsunami,
    HyperbolicTsunami,
    ParabolicTsunami,
    SphericalTsunami,
)

CACHE_VERSION = 1


def _method_configuration(tsunami: Tsunami) -> dict[str, Any]:
    """Return fixed method parameters that affect angle-to-parameter values."""
    config: dict[str, Any] = {}

    if isinstance(tsunami, HyperbolicTsunami):
        config["a"] = float(tsunami.a)

    return config


def make_cache_metadata(
    tsunami: Tsunami,
    *,
    h: float,
    d: float,
    angles_rad: Sequence[float],
) -> dict[str, Any]:
    """Build a complete, JSON-serialisable cache description."""
    angles_rad_array = np.asarray(angles_rad, dtype=float)

    return {
        "cache_version": CACHE_VERSION,
        "method": type(tsunami).__name__,
        "world_size": float(tsunami._world_size),
        "keep_lengths": bool(tsunami._keep_lengths),
        "observer_h": float(h),
        "distance_d": float(d),
        "angles_rad": angles_rad_array.tolist(),
        "method_configuration": _method_configuration(tsunami),
    }


def default_cache_path(
    tsunami: Tsunami,
    *,
    cache_dir: str | Path = ".",
) -> Path:
    """Return a readable cache filename for the current method and world."""
    world_size = float(tsunami._world_size)
    world_label = (
        str(int(world_size)) if world_size.is_integer() else f"{world_size:g}"
    )
    return Path(cache_dir) / (
        f"tsunami_angle_params_{type(tsunami).__name__}_{world_label}.npz"
    )


def _metadata_matches(
    stored: dict[str, Any],
    expected: dict[str, Any],
) -> bool:
    """Compare metadata, treating the angle array numerically."""
    stored = dict(stored)
    expected = dict(expected)

    try:
        stored_angles = np.asarray(stored.pop("angles_rad"), dtype=float)
        expected_angles = np.asarray(expected.pop("angles_rad"), dtype=float)
    except (KeyError, TypeError, ValueError):
        return False

    if stored != expected:
        return False

    return (
        stored_angles.shape == expected_angles.shape
        and np.array_equal(stored_angles, expected_angles)
    )


def load_cached_angle_params(
    cache_path: str | Path,
    expected_metadata: dict[str, Any],
) -> np.ndarray | None:
    """Load cached parameters, or return ``None`` when cache is incompatible."""
    path = Path(cache_path)
    if not path.exists():
        return None

    try:
        with np.load(path, allow_pickle=False) as data:
            metadata_raw = data["metadata_json"]
            metadata_text = str(metadata_raw.item())
            stored_metadata = json.loads(metadata_text)
            params = np.asarray(data["params"], dtype=float)
    except (OSError, KeyError, ValueError, TypeError, json.JSONDecodeError):
        return None

    if not _metadata_matches(stored_metadata, expected_metadata):
        return None

    expected_count = len(expected_metadata["angles_rad"])
    if params.shape != (expected_count,):
        return None

    if not np.all(np.isfinite(params)):
        return None

    return params


def save_angle_params(
    cache_path: str | Path,
    metadata: dict[str, Any],
    params: Sequence[float],
) -> None:
    """Save parameters and their complete configuration to an NPZ file."""
    path = Path(cache_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    np.savez(
        path,
        metadata_json=np.asarray(json.dumps(metadata, sort_keys=True)),
        params=np.asarray(params, dtype=float),
    )


def load_or_compute_angle_params(
    tsunami: Tsunami,
    *,
    h: float,
    angles_rad: Sequence[float],
    d: float | None = None,
    cache_path: str | Path | None = None,
    cache_dir: str | Path = ".",
) -> tuple[np.ndarray, bool, Path]:
    """Load compatible parameters or compute and cache them.

    Returns
    -------
    params
        One lifting parameter for every supplied angle.
    loaded_from_cache
        ``True`` when the values came from a compatible cache.
    path
        Cache file used by the operation.
    """
    if d is None:
        d = float(tsunami._world_size)

    angles_rad_array = np.asarray(angles_rad, dtype=float)
    if angles_rad_array.ndim != 1:
        raise ValueError("angles_rad must be a one-dimensional sequence.")

    metadata = make_cache_metadata(
        tsunami,
        h=h,
        d=d,
        angles_rad=angles_rad_array,
    )

    path = (
        Path(cache_path)
        if cache_path is not None
        else default_cache_path(tsunami, cache_dir=cache_dir)
    )

    cached = load_cached_angle_params(path, metadata)
    if cached is not None:
        return cached, True, path

    params = np.asarray(
        tsunami.angles_to_params(
            h=h,
            angles=angles_rad_array.tolist(),
            d=d,
            use_previous_as_start=True,
        ),
        dtype=float,
    )

    save_angle_params(path, metadata, params)
    return params, False, path


# -----------------------------------------------------------------------------
# Stand-alone precomputation
# -----------------------------------------------------------------------------

H = 100.0
WORLD_SIZE = 500
D = float(WORLD_SIZE)
ELEVATIONS_RAD = np.radians(np.arange(5.0, 176.0, 1.0))

METHODS: dict[str, Callable[[], Tsunami]] = {
    "ParabolicTsunami": lambda: ParabolicTsunami(
        world_size=WORLD_SIZE,
        keep_lengths=True,
    ),
    "HyperbolicTsunami": lambda: HyperbolicTsunami(
        a=WORLD_SIZE,
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


def main() -> None:
    for method_name, factory in METHODS.items():
        tsunami = factory()
        print(f"{method_name}: checking cache...")

        params, loaded, path = load_or_compute_angle_params(
            tsunami,
            h=H,
            angles_rad=ELEVATIONS_RAD,
            d=D,
        )

        action = "Loaded" if loaded else "Computed and saved"
        print(f"  {action} {len(params)} parameters: {path}")


if __name__ == "__main__":
    main()
