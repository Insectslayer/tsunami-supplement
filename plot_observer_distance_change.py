# -*- coding: utf-8 -*-
"""
Plot how the distance from the observer to surface points changes
under tsunami uplift.

For each supported method, the script generates two figures:

1. Absolute change:
       distance_after_uplift - distance_on_flat_ground

2. Relative change:
       (distance_after_uplift - distance_on_flat_ground)
       / distance_on_flat_ground

Each curve corresponds to one precomputed uplift level. Curve color encodes
the angle under which the end of the world is visible for that uplift.

The figures are saved to files and immediately closed.
"""

import json
from pathlib import Path

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.cm import ScalarMappable
from matplotlib.colors import Normalize

import tsunami as ts


WORLD_SIZE = 500
H = 100

YLIM_REL = [-.95, 0.]
YLIM = [-285,0]

NUM_SAMPLES = 300

PARAMS_FILE = f"tsunami_angle_params_{WORLD_SIZE}.npz"
# PARAMS_FILE = f"tsunami_angle_params_{WORLD_SIZE}.json"

OUTPUT_DIR = Path("distance_change_plots")
# OUTPUT_DPI = 300

METHODS = [
    "ParabolicTsunami",
    "HyperbolicTsunami",
    "AngularTsunami",
    "SphericalTsunami",
]

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 18,
    "axes.labelsize": 20,
    "axes.titlesize": 20,
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


def load_all_params(filename: str):
    """
    Load precomputed uplift parameters for all methods.

    Expected NPZ keys:
        angles_deg
        ParabolicTsunami
        HyperbolicTsunami
        AngularTsunami
        SphericalTsunami
    """
    if filename.endswith(".npz"):
        data = np.load(filename, allow_pickle=True)

        result = {
            "angles_deg": np.asarray(data["angles_deg"], dtype=float),
        }
        for method in METHODS:
            result[method] = np.asarray(data[method], dtype=float)

        return result

    with open(filename, "r", encoding="utf8") as f:
        raw = json.load(f)

    result = {
        "angles_deg": np.asarray(raw["angles_deg"], dtype=float),
    }
    for method in METHODS:
        result[method] = np.asarray(raw[method], dtype=float)

    return result


def observer_distances(x, y):
    """Euclidean distances from observer position (0,H) to points (x,y)."""
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    return np.hypot(x, y - H)


def plot_change(method: str,
                ground_distances,
                end_angles_deg,
                params,
                quantity: str):
    """
    Plot either absolute or relative distance change for one method.

    quantity:
        "absolute" or "relative"
    """
    flat_distances = observer_distances(
        ground_distances,
        np.zeros_like(ground_distances),
    )

    fig, ax = plt.subplots(figsize=(10, 6))

    cmap = plt.get_cmap("viridis")
    norm = Normalize(
        vmin=float(np.nanmin(end_angles_deg)),
        vmax=float(np.nanmax(end_angles_deg)),
    )

    if quantity == "absolute":
        ylabel = "Distance change from observer"
        title_quantity = "absolute distance change"
        filename_suffix = "absolute"
    elif quantity == "relative":
        ylabel = "Relative distance change"
        title_quantity = "relative distance change"
        filename_suffix = "relative"
    else:
        raise ValueError(f"Unknown quantity: {quantity}")

    for end_angle, p in zip(end_angles_deg, params):
        tsunami = create_instance(method)
        tsunami.lift(float(p))

        x, y = tsunami.uplift_ground(ground_distances)
        lifted_distances = observer_distances(x, y)

        absolute_change = lifted_distances - flat_distances

        if quantity == "absolute":
            values = absolute_change
        else:
            values = absolute_change / flat_distances

        ax.plot(
            ground_distances,
            values,
            color=cmap(norm(end_angle)),
            linewidth=1.5,
        )

    ax.axhline(0, color="black", linewidth=0.8, alpha=0.4)
    ax.grid(True, alpha=0.3)

    ax.set_xlim(0, WORLD_SIZE)
    ax.set_ylim(YLIM if quantity == "absolute" else YLIM_REL)
    ax.set_title(f"{method}: {title_quantity}")
    ax.set_xlabel("Surface distance from origin")
    ax.set_ylabel(ylabel)

    if quantity == "relative":
        ax.yaxis.set_major_formatter(
            plt.FuncFormatter(lambda value, _: f"{100 * value:.1f}%")
        )

    sm = ScalarMappable(norm=norm, cmap=cmap)
    sm.set_array([])
    cbar = fig.colorbar(sm, ax=ax, pad=0.02)
    cbar.set_label("Uplift level: angle of world end [degs.]")

    fig.tight_layout()

    output_path = OUTPUT_DIR / f"{method}_observer_distance_change_{filename_suffix}.pdf"
    fig.savefig(output_path, bbox_inches="tight")
    plt.close(fig)

    return output_path


def main():
    plt.ioff()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    data = load_all_params(PARAMS_FILE)
    end_angles_deg = data["angles_deg"]

    ground_x, _ = ts.create_flat_ground(
        WORLD_SIZE,
        num_samples=NUM_SAMPLES,
    )

    saved_files = []

    for method in METHODS:
        print(f"Computing {method}...")
        params = data[method]

        saved_files.append(
            plot_change(
                method=method,
                ground_distances=ground_x,
                end_angles_deg=end_angles_deg,
                params=params,
                quantity="absolute",
            )
        )

        saved_files.append(
            plot_change(
                method=method,
                ground_distances=ground_x,
                end_angles_deg=end_angles_deg,
                params=params,
                quantity="relative",
            )
        )

    print("Saved figures:")
    for filename in saved_files:
        print(f"  {filename}")


if __name__ == "__main__":
    main()
