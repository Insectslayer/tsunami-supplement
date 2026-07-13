# -*- coding: utf-8 -*-
"""
Visualize precomputed tsunami angle parameters using a colorbar.

Loads tsunami_angle_params.npz (or .json) and plots all ground shapes
for one selected tsunami method into a single matplotlib figure. The color
of each curve encodes the angle under which the end of the world is visible.
"""

import json
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.cm import ScalarMappable
from matplotlib.colors import Normalize

import tsunami as ts

OBSERVER_H = 100
WORLD_SIZE = 500
NUM_SAMPLES = 100

METHODS = ("SphericalTsunami", "ParabolicTsunami", "HyperbolicTsunami", "AngularTsunami")

PARAMS_FILE = f"tsunami_angle_params_{WORLD_SIZE}.npz"
# PARAMS_FILE = f"tsunami_angle_params_{WORLD_SIZE}.json"

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
        return np.asarray(data["angles_deg"], dtype=float), np.asarray(data[method], dtype=float)

    with open(filename, "r", encoding="utf8") as f:
        data = json.load(f)

    return np.asarray(data["angles_deg"], dtype=float), np.asarray(data[method], dtype=float)


for method in METHODS:
    print(f"Computing {method}...")
    angles_deg, params = load_params(PARAMS_FILE, method)

    ground_x, _ = ts.create_flat_ground(WORLD_SIZE, num_samples=NUM_SAMPLES)

    fig, ax = plt.subplots(figsize=(10, 6))

    cmap = plt.get_cmap("viridis")
    norm = Normalize(vmin=float(np.min(angles_deg)), vmax=float(np.max(angles_deg)))

    for angle, p in zip(angles_deg, params):
        tsunami = create_instance(method)
        tsunami.lift(float(p))

        x, y = tsunami.uplift_ground(ground_x)

        ax.plot(x, y, color=cmap(norm(angle)), linewidth=1.8)

    # Draw the original flat ground as a thin reference line.
    ax.plot(ground_x, np.zeros_like(ground_x), "k--", linewidth=0.8, alpha=0.35)

    ax.set_aspect("equal", adjustable="box")
    ax.grid(True, alpha=0.3)
    ax.set_xlim(-0.05*WORLD_SIZE, WORLD_SIZE*1.05)
    ax.set_ylim(-0.05*WORLD_SIZE, WORLD_SIZE*1.05) 
    ax.set_title(f"{method[:-7]} uplift")
    ax.set_xlabel("x")
    ax.set_ylabel("y")

    # if method == "SphericalTsunami":
    sm = ScalarMappable(norm=norm, cmap=cmap)
    sm.set_array([])
    cbar = fig.colorbar(sm, ax=ax, pad=0.02)
    cbar.set_label("Viewing angle of world end [degrees]")
    ax.plot(0, OBSERVER_H, '*r', markersize=10)

    plt.tight_layout()
    # plt.show()
    fig.savefig(f"lifting_{method[:-7].lower()}_{WORLD_SIZE}.pdf", bbox_inches="tight")
    plt.close(fig)

