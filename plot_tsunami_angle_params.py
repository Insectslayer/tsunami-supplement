# -*- coding: utf-8 -*-
"""
Visualize precomputed tsunami angle parameters.

Loads tsunami_angle_params.npz (or .json) and plots all ground shapes
for one selected tsunami method into a single matplotlib figure.
"""

import json
import numpy as np
import matplotlib.pyplot as plt

import tsunami as ts

WORLD_SIZE = 500
NUM_SAMPLES = 100

# Choose one:
METHOD = "SphericalTsunami"
# METHOD = "ParabolicTsunami"
# METHOD = "HyperbolicTsunami"
# METHOD = "AngularTsunami"


def create_instance(name):
    if name == "ParabolicTsunami":
        return ts.ParabolicTsunami(world_size=WORLD_SIZE)
    if name == "HyperbolicTsunami":
        return ts.HyperbolicTsunami(world_size=WORLD_SIZE)
    if name == "AngularTsunami":
        return ts.AngularTsunami(world_size=WORLD_SIZE)
    if name == "SphericalTsunami":
        return ts.SphericalTsunami(world_size=WORLD_SIZE)
    raise ValueError(name)


def load_params(filename=f"tsunami_angle_params_{WORLD_SIZE}.npz"):
    if filename.endswith(".npz"):
        data = np.load(filename, allow_pickle=True)
        return data["angles_deg"], data[METHOD]
    else:
        with open(filename, "r", encoding="utf8") as f:
            data = json.load(f)
        return np.asarray(data["angles_deg"]), np.asarray(data[METHOD])


angles_deg, params = load_params()

ground_x, _ = ts.create_flat_ground(WORLD_SIZE, num_samples=NUM_SAMPLES)

fig, ax = plt.subplots(figsize=(10, 6))

cmap = plt.get_cmap("viridis")

for i, (angle, p) in enumerate(zip(angles_deg, params)):
    tsunami = create_instance(METHOD)
    tsunami.lift(float(p))
    x, y = tsunami.uplift_ground(ground_x)
    ax.plot(x, y, color=cmap(i / max(len(params)-1,1)),
            label=f"{angle:.0f}°")

ax.set_aspect("equal", adjustable="box")
ax.grid(True)
ax.set_title(METHOD)
ax.set_xlabel("x")
ax.set_ylabel("y")

# show every second angle in legend
handles, labels = ax.get_legend_handles_labels()
ax.legend(handles[::2], labels[::2], title="End angle",
          bbox_to_anchor=(1.02, 1), loc="upper left")

plt.tight_layout()
plt.show()
