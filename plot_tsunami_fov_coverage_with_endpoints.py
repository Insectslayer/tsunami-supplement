# -*- coding: utf-8 -*-
"""
Plot field-of-view ground coverage for one tsunami uplift method.

For a selected method and precomputed list of uplift parameters, the script
plots distance from the origin to the visible ground point as a function of
viewing angle.

Important:
Each uplift parameter was computed so that the end of the world is visible
under a specific angle. Therefore, for each curve, the point

    (end_angle_deg, WORLD_SIZE)

is explicitly inserted into the plotted data.

This avoids missing the endpoint because of numerical error or because the
sampled angle grid does not contain the exact end angle.
"""

import json
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.cm import ScalarMappable
from matplotlib.colors import Normalize

import tsunami as ts


WORLD_SIZE = 500
H = 100

ANGLE_START_DEG = 0
ANGLE_STOP_DEG = 175
ANGLE_STEP_DEG = 2

METHODS = ("SphericalTsunami", "ParabolicTsunami", "HyperbolicTsunami", "AngularTsunami")

PARAMS_FILE = f"tsunami_angle_params_{WORLD_SIZE}.npz"
# PARAMS_FILE = f"tsunami_angle_params_{WORLD_SIZE}.json"

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 18,
    "axes.labelsize": 18,
    "axes.titlesize": 18,
    "xtick.labelsize": 18,
    "ytick.labelsize": 18,
    "legend.fontsize": 18,
})

def create_instance(name: str):
    """Create tsunami object. keep_lengths=True must match precomputation."""
    if name == "ParabolicTsunami":
        return ts.ParabolicTsunami(world_size=WORLD_SIZE, keep_lengths=True)
    if name == "HyperbolicTsunami":
        return ts.HyperbolicTsunami(world_size=WORLD_SIZE, keep_lengths=True)
    if name == "AngularTsunami":
        return ts.AngularTsunami(world_size=WORLD_SIZE, keep_lengths=True)
    if name == "SphericalTsunami":
        return ts.SphericalTsunami(world_size=WORLD_SIZE, keep_lengths=True)

    raise ValueError(f"Unsupported method: {name}")


def load_params(filename: str, method: str):
    if filename.endswith(".npz"):
        data = np.load(filename, allow_pickle=True)
        return (
            np.asarray(data["angles_deg"], dtype=float),
            np.asarray(data[method], dtype=float),
        )

    with open(filename, "r", encoding="utf8") as f:
        data = json.load(f)

    return (
        np.asarray(data["angles_deg"], dtype=float),
        np.asarray(data[method], dtype=float),
    )


def visible_distance_for_angle(tsunami, angle_rad: float) -> float:
    """
    Return distance to the visible ground point for one viewing angle.

    Returns nan if there is no visible ground point inside the modelled world.
    """
    distance = float(tsunami.angles_to_dist([angle_rad], H)[0])

    if not np.isfinite(distance):
        return np.nan
    if distance < 0:
        return np.nan
    if distance > WORLD_SIZE:
        # Small numerical overshoot should still be interpreted as the end
        # of the world; larger overshoot is outside the modelled interval.
        if np.isclose(distance, WORLD_SIZE, rtol=1e-9, atol=1e-6):
            return float(WORLD_SIZE)
        return np.nan

    return distance


def coverage_curve(tsunami, end_angle_deg: float):
    """
    Compute one coverage curve and explicitly include its endpoint.

    The ordinary x-grid is 0, 5, 10, ..., 175 degrees. The exact end angle is
    inserted even if it is not exactly on the grid.
    """
    view_angles_deg = np.arange(
        ANGLE_START_DEG,
        ANGLE_STOP_DEG + ANGLE_STEP_DEG,
        ANGLE_STEP_DEG,
        dtype=float,
    )

    # We only plot the physically relevant part up to the angle where the
    # end of the world is visible.
    view_angles_deg = view_angles_deg[view_angles_deg <= end_angle_deg]

    # Insert exact endpoint angle if it is not already present.
    if not np.any(np.isclose(view_angles_deg, end_angle_deg, atol=1e-10)):
        view_angles_deg = np.append(view_angles_deg, end_angle_deg)

    view_angles_deg = np.unique(np.sort(view_angles_deg))

    distances = np.array([
        visible_distance_for_angle(tsunami, np.radians(a))
        for a in view_angles_deg
    ])

    # By construction of the parameter table, this point should be exact.
    # In practice we enforce it because numerical intersection / arclength
    # computations can be off by a tiny amount.
    end_idx = np.argmin(np.abs(view_angles_deg - end_angle_deg))
    distances[end_idx] = float(WORLD_SIZE)

    return view_angles_deg, distances


for method in METHODS:
    print(f"Computing {method}...")
    end_angles_deg, params = load_params(PARAMS_FILE, method)

    fig, ax = plt.subplots(figsize=(10, 6))

    cmap = plt.get_cmap("viridis")
    norm = Normalize(
        vmin=float(np.nanmin(end_angles_deg)),
        vmax=float(np.nanmax(end_angles_deg)),
    )

    for end_angle, p in zip(end_angles_deg, params):
        tsunami = create_instance(method)
        tsunami.lift(float(p))

        angles_deg, distances = coverage_curve(tsunami, float(end_angle))

        ax.plot(
            angles_deg,
            distances,
            color=cmap(norm(end_angle)),
            linewidth=1.8,
        )

        # Mark the guaranteed endpoint.
        # ax.plot(
        #     [end_angle],
        #     [WORLD_SIZE],
        #     marker="o",
        #     markersize=3,
        #     color=cmap(norm(end_angle)),
        # )

    ax.set_xlim(ANGLE_START_DEG, ANGLE_STOP_DEG)
    ax.set_ylim(0, WORLD_SIZE * 1.02)
    ax.grid(True, alpha=0.3)

    ax.set_title(f"Ground distance by viewing angle for {method}")
    ax.set_xlabel("Viewing angle [degrees]")
    ax.set_ylabel("Distance from origin to visible point")

    sm = ScalarMappable(norm=norm, cmap=cmap)
    sm.set_array([])
    cbar = fig.colorbar(sm, ax=ax, pad=0.02)
    cbar.set_label("Uplift level: angle of world end [degrees]")

    plt.tight_layout()
    # plt.show()
    fig.savefig(f"lifting_{method[:-7].lower()}_coverage_{WORLD_SIZE}.pdf", 
                bbox_inches="tight")
    plt.close(fig)
