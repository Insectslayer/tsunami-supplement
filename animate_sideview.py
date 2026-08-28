# -*- coding: utf-8 -*-
"""
Side-view demonstration of how a Tsunami transformation is constructed.

The script renders the vertical viewing plane of the paper: the observer at
``(0, h)``, the ground running away from him along the positive x-axis, a scene
standing on that ground, and a cast ray.  Every ingredient of the construction
is exposed as a CLI control, and every one of them may be given as an interval
``a:b`` instead of a single number, in which case it is ramped over the
requested number of animation steps and the result is written as a video.

The construction, step by step
------------------------------
A scene point is given in flat-world coordinates as a pair ``(s, q)``: ``s`` is
its distance from the origin measured along the flat ground, ``q`` its height
above the ground.  It is mapped to the uplifted world in three stages, each one
of which has its own slider:

1. *Bending.*  ``--bending`` runs from 0 (flat world) to 1 (fully spread) and is
   mapped linearly onto the transformed boundary angle alpha'_w, the angle at
   which the observer sees the end of the modelled world.  alpha'_w = the flat
   value arctan(d_w/h) at bending 0, and ``--max-angle`` (175 deg) at bending 1.
   The profile's own uplift parameter p is then obtained by inverting
   alpha'_w(p), which is the paper's "Determining the uplift parameter".
   Driving the uplift this way rather than through p keeps the four profiles
   comparable: the same bending means the same amount of angular spreading, not
   the same numeric p.

2. *Arc length.*  The profile is a curve g'(t) in its own native parameter t,
   which is not arc length.  Requirement (2) of the paper asks for
   ``s'(t(s)) = s``, so the ground distance s must be pushed through the inverse
   arc-length function.  ``--arclength`` interpolates between the two readings:

       t = (1 - a) * s + a * t(s)

   At a = 1 the ground keeps its length and the world only bends; at a = 0 the
   distance is fed to the profile as its native parameter and the ground is
   stretched as well.  a = 0 reproduces ``keep_lengths=False`` of ``tsunami.py``,
   a = 1 reproduces ``keep_lengths=True``.

3. *Normals.*  The height q lifts the point off the profile.  ``--normal``
   interpolates the direction it is lifted along, between the vertical and the
   profile normal n(t):

       dir = normalize((1 - w) * e_z + w * n(t))
       P'  = g'(t) + q * dir

   w = 1 is the paper's rigid-height model T_3 = S + q n, and reproduces
   ``uplift_2D`` of ``tsunami.py``; w = 0 leaves objects standing upright while
   their feet ride the curve.

The cast ray is cast in the *uplifted* world: it leaves its start point in a
straight line, which is what the observer looks along, and its first
intersection with the profile is the point he sees.  It is drawn a second time,
dashed, as its pre-image under the map above -- the path through the original
flat world that the transformation carries onto the ray.  The two coincide while
the world is flat and separate as it bends, and the pre-image of the
ray/profile intersection is the ground point the observer is actually looking
at, that is, the distance the paper's angle-to-distance table would return for
this direction.  ``--ray-visible`` reveals the leading fraction of both in
lock-step, so that a ray can be shot out over the course of an animation.

An interval is walked linearly unless an easing says otherwise.  ``--easing``
sets one for every animated control; a control may override it by naming its own
as ``START:STOP:EASING``.  The frames stay evenly spaced in time -- the easing
only changes how fast the value crosses its interval -- and every curve fixes
both ends, so the first and last frame always show the interval bounds.

Inverting the map is not always possible.  Where the offset lines of
neighbouring ground points have already crossed -- past the focal surface, the
singularity described in the paper's normal-layer section -- a point of the
uplifted world has several pre-images, and the nearest one is used; where no
offset line reaches at all, the dashed curve simply breaks.

Examples
--------
    # default sample scene, parabolic profile, flat -> fully bent, 2 s of video
    python animate_sideview.py

    # a single still at half uplift, upright buildings, no arc-length keeping
    python animate_sideview.py --bending 0.5 --normal 0 --arclength 0

    # shoot the ray out first, then bend the world, on a spherical profile
    python animate_sideview.py --method spherical --ray-visible 0:1 \
        --bending 0.6 --output shot.mp4

    # settle into the bend, but reveal the ray at a constant speed
    python animate_sideview.py --easing ease-in-out --bending 0:1 \
        --ray-visible 0:1:linear

    # own scene, own colours, parameter readout visible
    python animate_sideview.py --scene city.csv --palette dark \
        --color ray=#ffcc00 --readout

Scene files are CSV with two columns, ``s,q`` (ground distance, height above
ground).  Consecutive rows are joined into a polyline drawn as an outline; a
blank line starts a new polyline; ``#`` starts a comment.

This script is a demonstration and is not imported by anything else; it uses the
profile classes of ``tsunami.py`` but does its own arc-length inversion, since
the base-class ``s_to_xy`` rebuilds a table on every call.
"""

from __future__ import annotations

import argparse
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable, NamedTuple, Sequence

import numpy as np
import matplotlib

from tsunami import (
    AngularTsunami,
    HyperbolicTsunami,
    ParabolicTsunami,
    SphericalTsunami,
    Tsunami,
    calculate_angle,
)

# ---------------------------------------------------------------------------
# defaults
# ---------------------------------------------------------------------------

WORLD_SIZE = 500.0        # d_w, world radius in meters
OBSERVER_H = 100.0        # h, observer elevation in meters
TILE_SZ = 25.0            # spacing of the normal hairs of --show-normals
MAX_ANGLE = 175.0         # alpha'_w reached at bending 1, in degrees
WORLD_HEIGHT = 80.0      # h_w, only used to scale the sample scene

DEFAULT_SIZE = (1920, 1080)
DEFAULT_FPS = 60
DEFAULT_STEPS = 120
DEFAULT_DPI = 100
DEFAULT_PADDING_PERCENT = 5.0  # of the matching output dimension
DEFAULT_STEM = "tsunami_sideview"

ARC_TABLE_N = 4001        # arc-length table resolution used per frame
LIFT_TABLE_N = 320        # p samples used to invert alpha'_w(p)
PROFILE_SAMPLES = 1200    # ground polyline resolution
INVERSE_TABLE_N = 1500    # ground samples used to invert the transformation

METHODS: dict[str, type[Tsunami]] = {
    "parabolic": ParabolicTsunami,
    "hyperbolic": HyperbolicTsunami,
    "angular": AngularTsunami,
    "spherical": SphericalTsunami,
}

# ---------------------------------------------------------------------------
# palettes
# ---------------------------------------------------------------------------

PALETTES = {
    "light": {
        "background": "#ffffff",
        "axes": "#404040",
        "ground": "#1f1f1f",
        "scene_edge": "#20405e",
        "flat": "#c8c8c8",
        "normals": "#7fbf7f",
        "ray": "#d62728",
        "ray_flat": "#9467bd",
        "hit": "#ff7f0e",
        "readout": "#303030",
    },
    "dark": {
        "background": "#101418",
        "axes": "#8b949e",
        "ground": "#e6edf3",
        "scene_edge": "#9fd3ef",
        "flat": "#333c45",
        "normals": "#3fa86a",
        "ray": "#ff6b6b",
        "ray_flat": "#c792ea",
        "hit": "#ffb454",
        "readout": "#c9d1d9",
    },
    "paper": {
        "background": "#ffffff",
        "axes": "#000000",
        "ground": "#000000",
        "scene_edge": "#000000",
        "flat": "#aaaaaa",
        "normals": "#666666",
        "ray": "#000000",
        "ray_flat": "#777777",
        "hit": "#000000",
        "readout": "#000000",
    },
}

# ---------------------------------------------------------------------------
# scene loading
# ---------------------------------------------------------------------------

Polyline = np.ndarray  # (n, 2) array of (s, q)


def load_scene(path: Path) -> list[Polyline]:
    """Read a CSV of ``s,q`` rows; blank lines separate polylines."""
    groups: list[list[tuple[float, float]]] = [[]]
    with path.open(encoding="utf-8") as handle:
        for lineno, raw in enumerate(handle, start=1):
            line = raw.split("#", 1)[0].strip()
            if not line:
                if groups[-1]:
                    groups.append([])
                continue
            fields = [f for f in line.replace(";", ",").split(",") if f.strip()]
            if len(fields) < 2:
                raise ValueError(f"{path}:{lineno}: expected two columns, got {raw!r}")
            try:
                s, q = float(fields[0]), float(fields[1])
            except ValueError:
                if lineno == 1:
                    continue  # tolerate a header row
                raise ValueError(f"{path}:{lineno}: not a number: {raw!r}") from None
            groups[-1].append((s, q))

    polylines = [np.asarray(g, dtype=float) for g in groups if len(g) >= 2]
    if not polylines:
        raise ValueError(f"{path}: no polyline with at least two points")
    return polylines


def densify(polyline: Polyline, max_step: float) -> Polyline:
    """Subdivide so that no edge spans more than ``max_step`` of ground.

    The map is nonlinear in the ground distance, so an edge is only drawn
    correctly if it is transformed point by point. Mapping the two endpoints
    and joining them would replace an arc of the uplifted world by its chord,
    which for a scene edge running along the ground is grossly wrong.
    """
    points = [polyline[0]]
    for start, end in zip(polyline[:-1], polyline[1:]):
        pieces = max(1, int(math.ceil(abs(end[0] - start[0]) / max_step)))
        for k in range(1, pieces + 1):
            points.append(start + (end - start) * (k / pieces))
    return np.asarray(points, dtype=float)


def sample_scene(world_radius: float, world_height: float = WORLD_HEIGHT) -> list[Polyline]:
    """A deterministic skyline: blocks of buildings receding to the world end.

    One polyline, running along the ground and up and over each building.
    """
    rng = np.random.default_rng(20250828)
    points: list[tuple[float, float]] = [(0.0, 0.0)]

    s = world_radius * 0.06
    while s < world_radius * 0.97:
        width = float(rng.uniform(0.040, 0.100)) * world_radius
        gap = float(rng.uniform(0.025, 0.080)) * world_radius
        # Distant buildings are drawn taller so that the uplift has something
        # to show at the far end of the world.
        far = s / world_radius
        height = world_height * float(rng.uniform(0.25, 1.0)) * (0.45 + 0.75 * far)
        if s + width > world_radius:
            break
        points.extend([(s, 0.0), (s, height), (s + width, height), (s + width, 0.0)])
        s += width + gap

    points.append((world_radius, 0.0))
    return [np.asarray(points, dtype=float)]


# ---------------------------------------------------------------------------
# the construction
# ---------------------------------------------------------------------------


def make_profile(method: str, world_radius: float, hyperbolic_b: float) -> Tsunami:
    """Instantiate a profile.

    ``keep_lengths`` is left off: this script blends between the two
    parametrizations itself, so it never wants the class to decide.
    """
    cls = METHODS[method]
    if cls is HyperbolicTsunami:
        return HyperbolicTsunami(a=hyperbolic_b, world_size=world_radius, keep_lengths=False)
    return cls(world_size=world_radius, keep_lengths=False)


class Construction:
    """Profile plus the three tunable stages of the mapping.

    Holds the two tables the paper's "Precomputation and caching" section asks
    for: the alpha'_w -> p table, built once, and the arc-length table t(s),
    rebuilt whenever p changes.
    """

    def __init__(
        self,
        method: str,
        world_radius: float = WORLD_SIZE,
        observer_height: float = OBSERVER_H,
        max_angle_deg: float = MAX_ANGLE,
        hyperbolic_b: float | None = None,
        reach: float | None = None,
    ) -> None:
        self.method = method
        self.world_radius = float(world_radius)
        self.h = float(observer_height)
        # Largest ground distance any table has to cover. The scene or the cast
        # ray may reach past the modelled world, and a table that stops at d_w
        # would silently clamp them onto the world boundary.
        self.reach = max(self.world_radius, float(reach or 0.0))
        self.profile = make_profile(
            method,
            self.world_radius,
            self.world_radius if hyperbolic_b is None else hyperbolic_b,
        )

        self.flat_angle = calculate_angle((0.0, 0.0), (0.0, self.h), (self.world_radius, 0.0))
        self.max_angle = math.radians(max_angle_deg)
        if self.max_angle <= self.flat_angle:
            raise ValueError(
                f"--max-angle must exceed the flat boundary angle "
                f"{math.degrees(self.flat_angle):.2f} deg"
            )

        self._lift_ps, self._lift_angles = self._build_lift_table()

        # state, set by set_state()
        self.bending = 0.0
        self.normal_w = 1.0
        self.arc_w = 1.0
        self.alpha_w = self.flat_angle
        self._t_grid = np.zeros(0)
        self._s_grid = np.zeros(0)
        self._speed_grid = np.zeros(0)
        self._inverse_cache: dict | None = None
        self.set_state(0.0, 1.0, 1.0)

    # -- arc length ---------------------------------------------------------

    def _speeds(self, t_values: np.ndarray) -> np.ndarray:
        derivative = self.profile.derivative_at_t
        return np.array([math.hypot(*derivative(float(t))) for t in t_values], dtype=float)

    def _arc_table(self, n: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Sampled ``(t, s(t), |g'(t)|)`` over a range covering the whole world.

        Cumulative trapezoid on a uniform grid. A higher-order rule would be
        cheap to add but is pointless here: at this resolution its error is far
        below the width of a drawn line, and the trapezoid rule has the property
        that matters for the inversion below, namely that the tabulated arc
        length is strictly increasing whenever the speed is positive.
        """
        # All four profiles satisfy |g'| >= 1, so an arc length of `reach` is
        # always attained at t <= reach; the margin covers rounding at the end.
        t_grid = np.linspace(0.0, self.reach * 1.05, n)
        speed = self._speeds(t_grid)
        step = t_grid[1] - t_grid[0]

        s_grid = np.empty_like(t_grid)
        s_grid[0] = 0.0
        np.cumsum(0.5 * step * (speed[1:] + speed[:-1]), out=s_grid[1:])
        return t_grid, s_grid, speed

    def s_to_t(self, s: np.ndarray) -> np.ndarray:
        """Inverse arc length, vectorised.

        Locates the bracketing table node, steps to the target with the node's
        exact speed, then repeats the step with the mean of the two speeds. The
        second pass removes the first-order error of a plain linear
        interpolation, which is otherwise visible on strongly bent profiles.
        """
        s = np.atleast_1d(np.asarray(s, dtype=float))
        t_grid, s_grid, speed_grid = self._t_grid, self._s_grid, self._speed_grid

        index = np.clip(np.searchsorted(s_grid, s, side="right") - 1, 0, len(s_grid) - 2)
        s0 = s_grid[index]
        t0 = t_grid[index]
        v0 = np.maximum(speed_grid[index], 1e-12)

        t = t0 + (s - s0) / v0
        v_mid = np.maximum(np.interp(t, t_grid, speed_grid), 1e-12)
        t = t0 + 2.0 * (s - s0) / (v0 + v_mid)
        return np.maximum(t, 0.0)

    def distance_to_t(self, s: np.ndarray) -> np.ndarray:
        """Ground distance to profile parameter, blended by ``--arclength``."""
        s = np.atleast_1d(np.asarray(s, dtype=float))
        if self.arc_w <= 0.0:
            return s.copy()
        if self.arc_w >= 1.0:
            return self.s_to_t(s)
        return (1.0 - self.arc_w) * s + self.arc_w * self.s_to_t(s)

    # -- uplift parameter ---------------------------------------------------

    def _boundary_angle_for_p(self, p: float) -> float:
        """alpha'_w for a trial p, always with full arc-length preservation.

        The bending control is meant to be comparable across profiles and
        across the other two sliders, so the angle that defines it is the one
        of the paper (requirement 2 in force), independently of where
        ``--arclength`` happens to sit.
        """
        old = self.profile.p
        self.profile.lift(p)
        try:
            t = float(self._s_to_t_direct(self.world_radius))
            x, z = self.profile.t_to_xy(t)
        finally:
            self.profile.lift(old)
        return calculate_angle((0.0, 0.0), (0.0, self.h), (x, z))

    def _s_to_t_direct(self, s: float) -> float:
        """Single-point arc-length inversion that does not touch the tables.

        Used while sweeping p for the lift table, where rebuilding the full
        table for every trial parameter would dominate the cost.
        """
        t_grid, s_grid, speed = self._arc_table(LIFT_TABLE_N)
        if s >= s_grid[-1]:
            return float(t_grid[-1])
        index = int(np.clip(np.searchsorted(s_grid, s, side="right") - 1, 0, len(s_grid) - 2))
        v0 = max(speed[index], 1e-12)
        t = t_grid[index] + (s - s_grid[index]) / v0
        v_mid = max(float(np.interp(t, t_grid, speed)), 1e-12)
        return float(t_grid[index] + 2.0 * (s - s_grid[index]) / (v0 + v_mid))

    def _build_lift_table(self) -> tuple[np.ndarray, np.ndarray]:
        """Sample p, record the boundary angle, giving a monotone table.

        Inverting it by interpolation replaces a bisection per frame, exactly as
        the paper's "Determining the uplift parameter" suggests for interactive
        use. The spacing is biased towards small p, where the boundary angle
        moves fastest.
        """
        if isinstance(self.profile, SphericalTsunami):
            p_max = math.pi / self.world_radius
        else:
            p_max = 1e-4
            guard = 0
            while self._boundary_angle_for_p(p_max) < self.max_angle and guard < 400:
                p_max *= 1.7
                guard += 1

        fractions = np.linspace(0.0, 1.0, LIFT_TABLE_N)
        ps = p_max * fractions**2.4
        angles = np.array([self._boundary_angle_for_p(float(p)) for p in ps], dtype=float)

        # np.interp needs a strictly increasing table; the sweep is monotone by
        # construction but may repeat values where it saturates.
        keep = np.concatenate(([True], np.diff(angles) > 1e-12))
        return ps[keep], angles[keep]

    def bending_to_angle(self, bending: float) -> float:
        bending = float(np.clip(bending, 0.0, 1.0))
        return self.flat_angle + bending * (self.max_angle - self.flat_angle)

    def bending_to_p(self, bending: float) -> float:
        if bending <= 0.0:
            return 0.0
        angle = self.bending_to_angle(bending)
        if angle >= self._lift_angles[-1]:
            return float(self._lift_ps[-1])
        return float(np.interp(angle, self._lift_angles, self._lift_ps))

    # -- state --------------------------------------------------------------

    def set_state(self, bending: float, normal_w: float, arc_w: float) -> None:
        self.bending = float(np.clip(bending, 0.0, 1.0))
        self.normal_w = float(np.clip(normal_w, 0.0, 1.0))
        self.arc_w = float(np.clip(arc_w, 0.0, 1.0))
        self.alpha_w = self.bending_to_angle(self.bending)

        p = self.bending_to_p(self.bending)
        self.profile.lift(p)
        self._t_grid, self._s_grid, self._speed_grid = self._arc_table(ARC_TABLE_N)
        self._inverse_cache = None

    @property
    def p(self) -> float:
        return float(self.profile.p)

    # -- the mapping --------------------------------------------------------

    def ground(self, s: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Points of the uplifted ground at the given flat distances."""
        t = self.distance_to_t(s)
        xy = np.array([self.profile.t_to_xy(float(v)) for v in t], dtype=float)
        return xy[:, 0], xy[:, 1]

    def normals(self, s: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        t = self.distance_to_t(s)
        n = np.array([self.profile.t_to_normal(float(v)) for v in t], dtype=float)
        return n[:, 0], n[:, 1]

    def offset_direction(self, t: np.ndarray) -> np.ndarray:
        """The direction object heights are lifted along, blended by ``--normal``."""
        t = np.atleast_1d(np.asarray(t, dtype=float))
        if self.normal_w <= 0.0:
            direction = np.zeros((len(t), 2))
            direction[:, 1] = 1.0
            return direction

        normal = np.array([self.profile.t_to_normal(float(v)) for v in t], dtype=float)
        if self.normal_w >= 1.0:
            return normal
        direction = normal * self.normal_w
        direction[:, 1] += 1.0 - self.normal_w
        length = np.hypot(direction[:, 0], direction[:, 1])
        return direction / np.maximum(length, 1e-12)[:, None]

    def map_points(self, points: np.ndarray) -> np.ndarray:
        """Map ``(s, q)`` flat-world points to the uplifted world."""
        points = np.atleast_2d(np.asarray(points, dtype=float))
        s, q = points[:, 0], points[:, 1]
        t = self.distance_to_t(s)
        base = np.array([self.profile.t_to_xy(float(v)) for v in t], dtype=float)
        return base + q[:, None] * self.offset_direction(t)

    # -- the inverse mapping ------------------------------------------------

    def _inverse_grid(self) -> dict:
        """The forward map sampled along the ground, for inverting it.

        Everything is tabulated against the flat distance s rather than the
        native parameter t, so that the inversion returns s directly and the
        table stays valid whatever ``--arclength`` is doing.
        """
        if self._inverse_cache is not None:
            return self._inverse_cache
        s = np.linspace(0.0, self.reach * 1.05, INVERSE_TABLE_N)
        t = self.distance_to_t(s)
        base = np.array([self.profile.t_to_xy(float(v)) for v in t], dtype=float)
        direction = self.offset_direction(t)
        self._inverse_cache = {
            "s": s, "t": t,
            "x": base[:, 0], "z": base[:, 1],
            "dx": direction[:, 0], "dz": direction[:, 1],
        }
        return self._inverse_cache

    def t_to_distance(self, t: float) -> float:
        """The flat distance whose image carries the profile parameter t."""
        grid = self._inverse_grid()
        return float(np.interp(t, grid["t"], grid["s"]))

    def inverse_points(self, points: np.ndarray) -> np.ndarray:
        """Pull points of the uplifted world back to flat ``(s, q)`` pairs.

        A point P' of the uplifted world came from the ground point whose offset
        line passes through it, that is, from the s at which P' - g'(t(s)) is
        parallel to the offset direction. The cross product of those two vectors
        changes sign there, so the roots are found by scanning the tabulated
        ground for sign changes and interpolating within the bracketing pair.

        Where the offset lines of neighbouring ground points have already
        crossed -- past the focal surface, the singularity of the paper's
        normal-layer section -- more than one root exists; the one with the
        smallest height is returned, that is, the nearest sheet. Points that no
        offset line reaches at all come back as NaN, which leaves a gap in the
        drawn curve rather than an invented position.
        """
        points = np.atleast_2d(np.asarray(points, dtype=float))
        grid = self._inverse_grid()
        gs, gx, gz, gdx, gdz = grid["s"], grid["x"], grid["z"], grid["dx"], grid["dz"]

        out = np.full((len(points), 2), np.nan)
        for index, (px, pz) in enumerate(points):
            # Cross product of (P' - g') with the offset direction.
            cross = (px - gx) * gdz - (pz - gz) * gdx
            sign_change = np.nonzero(np.diff(np.signbit(cross)))[0]
            if sign_change.size == 0:
                continue

            lo, hi = sign_change, sign_change + 1
            span = cross[lo] - cross[hi]
            local = np.where(np.abs(span) < 1e-18, 0.0, cross[lo] / span)
            s_root = gs[lo] + local * (gs[hi] - gs[lo])
            x_root = gx[lo] + local * (gx[hi] - gx[lo])
            z_root = gz[lo] + local * (gz[hi] - gz[lo])
            dx_root = gdx[lo] + local * (gdx[hi] - gdx[lo])
            dz_root = gdz[lo] + local * (gdz[hi] - gdz[lo])
            q_root = (px - x_root) * dx_root + (pz - z_root) * dz_root

            nearest = int(np.argmin(np.abs(q_root)))
            out[index] = (s_root[nearest], q_root[nearest])
        return out

    # -- the cast ray -------------------------------------------------------

    def ray_hit(self, start: np.ndarray, direction: np.ndarray) -> np.ndarray | None:
        """Where the straight viewing ray meets the uplifted ground.

        For a ray leaving the observer's vertical axis the profile's analytic
        intersection applies directly.  For a start point off the axis, and for
        any ray once ``--arclength`` has pulled the ground off the profile's
        own parametrization, the intersection is taken against the sampled
        ground polyline instead; both give the first hit along the ray.
        """
        on_axis = abs(float(start[0])) < 1e-9 and self.arc_w >= 1.0
        if on_axis:
            v = direction / max(float(np.hypot(*direction)), 1e-12)
            t = self.profile.t_seen_in_direction((float(v[0]), float(v[1])), float(start[1]))
            if np.isfinite(t) and t >= 0.0:
                return np.asarray(self.profile.t_to_xy(float(t)), dtype=float)
            return None

        s = np.linspace(0.0, self.world_radius, PROFILE_SAMPLES)
        gx, gz = self.ground(s)
        return _first_polyline_hit(start, direction, gx, gz)


def _first_polyline_hit(
    start: np.ndarray, direction: np.ndarray, px: np.ndarray, pz: np.ndarray
) -> np.ndarray | None:
    """First intersection of a ray with a polyline, or ``None``."""
    ax, az = px[:-1], pz[:-1]
    ex, ez = px[1:] - ax, pz[1:] - az
    dx, dz = float(direction[0]), float(direction[1])

    # Solve  a + u e = start + r d  for (u, r) by Cramer's rule; the shared
    # determinant below is the cross product of the segment and the direction.
    denominator = ez * dx - ex * dz
    valid = np.abs(denominator) > 1e-12
    with np.errstate(divide="ignore", invalid="ignore"):
        wx, wz = ax - float(start[0]), az - float(start[1])
        u = np.where(valid, (wx * dz - wz * dx) / denominator, np.nan)   # along segment
        r = np.where(valid, (wx * ez - wz * ex) / denominator, np.nan)   # along ray

    hit = valid & (u >= 0.0) & (u <= 1.0) & (r >= 0.0) & np.isfinite(r)
    if not np.any(hit):
        return None
    index = int(np.argmin(np.where(hit, r, np.inf)))
    return np.array([ax[index] + u[index] * ex[index], az[index] + u[index] * ez[index]])


# ---------------------------------------------------------------------------
# frame parameters
# ---------------------------------------------------------------------------


@dataclass
class FrameState:
    bending: float
    normal_w: float
    arc_w: float
    ray_visible: float


# ---------------------------------------------------------------------------
# easing
# ---------------------------------------------------------------------------
#
# An easing reshapes the frame fraction before it drives a control: the frames
# are still evenly spaced in time, but the value moves through its interval at a
# varying rate. Every curve here maps [0, 1] onto [0, 1] and fixes both ends, so
# the first and last frame show exactly the interval bounds whichever is chosen.
# Overshooting families (back, elastic) are deliberately absent: all four
# controls are clamped to [0, 1], so an overshoot would flatten into a hold
# rather than spring back.


def _ease_out(ease_in: Callable[[float], float]) -> Callable[[float], float]:
    """Reverse an ease-in curve, so it decelerates instead of accelerating."""
    return lambda t: 1.0 - ease_in(1.0 - t)


def _ease_in_out(ease_in: Callable[[float], float]) -> Callable[[float], float]:
    """Mirror an ease-in curve about the midpoint: accelerate, then decelerate."""

    def eased(t: float) -> float:
        if t < 0.5:
            return 0.5 * ease_in(2.0 * t)
        return 1.0 - 0.5 * ease_in(2.0 * (1.0 - t))

    return eased


def _expo_in(t: float) -> float:
    return 0.0 if t <= 0.0 else 2.0 ** (10.0 * (t - 1.0))


_EASE_IN_CURVES = {
    "ease": lambda t: t * t,                       # quadratic, the usual default
    "cubic": lambda t: t * t * t,
    "sine": lambda t: 1.0 - math.cos(t * math.pi / 2.0),
    "expo": _expo_in,
}

EASINGS: dict[str, Callable[[float], float]] = {"linear": lambda t: t}
for _family, _curve in _EASE_IN_CURVES.items():
    EASINGS[f"{_family}-in"] = _curve
    EASINGS[f"{_family}-out"] = _ease_out(_curve)
    EASINGS[f"{_family}-in-out"] = _ease_in_out(_curve)
del _family, _curve

DEFAULT_EASING = "linear"


class Ramp:
    """A CLI value: a constant, or an interval ``a:b`` walked with an easing."""

    def __init__(self, start: float, stop: float, animated: bool, easing: str) -> None:
        self.start = start
        self.stop = stop
        self.animated = animated
        self.easing = easing

    def at(self, fraction: float) -> float:
        return self.start + (self.stop - self.start) * EASINGS[self.easing](fraction)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        if not self.animated:
            return f"Ramp({self.start})"
        return f"Ramp({self.start}:{self.stop}:{self.easing})"


def parse_ramp(text: str, low: float, high: float, name: str, easing: str) -> Ramp:
    """``VALUE``, ``START:STOP``, or ``START:STOP:EASING`` overriding --easing."""
    parts = text.split(":")
    if len(parts) == 3:
        easing = parts.pop().strip()
        if easing not in EASINGS:
            raise argparse.ArgumentTypeError(
                f"{name}: unknown easing {easing!r}; choose from {', '.join(EASINGS)}"
            )
    elif len(parts) > 3:
        raise argparse.ArgumentTypeError(
            f"{name}: expected VALUE, START:STOP or START:STOP:EASING, got {text!r}"
        )
    if len(parts) == 2 and parts[1].strip() in EASINGS:
        raise argparse.ArgumentTypeError(
            f"{name}: an easing needs both bounds, as START:STOP:EASING, got {text!r}"
        )

    try:
        values = [float(part) for part in parts]
    except ValueError:
        raise argparse.ArgumentTypeError(f"{name}: not a number in {text!r}") from None
    for value in values:
        if not low - 1e-9 <= value <= high + 1e-9:
            raise argparse.ArgumentTypeError(
                f"{name}: {value} is outside [{low:g}, {high:g}]"
            )
    if len(values) == 1:
        return Ramp(values[0], values[0], animated=False, easing=easing)
    return Ramp(values[0], values[1], animated=True, easing=easing)


def frame_states(ramps: dict[str, Ramp], steps: int) -> list[FrameState]:
    if steps == 1:
        fractions = [0.0 if not any(r.animated for r in ramps.values()) else 1.0]
    else:
        fractions = list(np.linspace(0.0, 1.0, steps))
    return [
        FrameState(
            bending=ramps["bending"].at(f),
            normal_w=ramps["normal"].at(f),
            arc_w=ramps["arclength"].at(f),
            ray_visible=ramps["ray_visible"].at(f),
        )
        for f in fractions
    ]


# ---------------------------------------------------------------------------
# rendering
# ---------------------------------------------------------------------------


def truncate(points: np.ndarray, fraction: float) -> np.ndarray:
    """The leading ``fraction`` of a uniformly sampled polyline.

    Cut by the sampling parameter rather than by accumulated length: the
    straight ray and its deformed image are sampled from the same parameter, so
    cutting both this way reveals the same stretch of the original ray in both,
    which cutting by length would not (the deformed copy is longer).
    """
    fraction = float(np.clip(fraction, 0.0, 1.0))
    if fraction >= 1.0:
        return points
    if fraction <= 0.0 or len(points) < 2:
        return points[:1]

    position = fraction * (len(points) - 1)
    index = min(int(position), len(points) - 2)
    tip = points[index] + (position - index) * (points[index + 1] - points[index])
    return np.vstack([points[: index + 1], tip])


class SideViewRenderer:
    """Draws one frame of the construction into a fixed set of axes."""

    def __init__(self, construction: Construction, options: argparse.Namespace, colors: dict) -> None:
        self.c = construction
        self.o = options
        self.colors = colors
        self.scene = options.scene_polylines
        self.ray_start = options.ray[0]
        self.ray_end = options.ray[1]
        self.ray_direction = self.ray_end - self.ray_start
        self.ground_s = np.linspace(0.0, construction.world_radius, PROFILE_SAMPLES)
        self.ray_s = np.linspace(0.0, 1.0, 400)

    # -- geometry per frame -------------------------------------------------

    def apply(self, state: FrameState) -> None:
        self.c.set_state(state.bending, state.normal_w, state.arc_w)

    def ray_points(self) -> np.ndarray:
        return self.ray_start + self.ray_s[:, None] * self.ray_direction

    def flat_ray(self) -> np.ndarray:
        """The cast ray pulled back to the flat world.

        The ray is cast in the uplifted world, so its counterpart is its
        pre-image under the transformation, not its image: the path through the
        original flat world that the transformation carries onto the ray.
        """
        return self.c.inverse_points(self.ray_points())

    def seen_fraction(self) -> float:
        """How much of the ray the observer actually sees: up to its first hit.

        Past the hit the ray has left the world, and its pre-image lies far
        below the flat ground -- true, but neither meaningful nor drawable at
        the same scale, so the pre-image is only ever shown this far.
        """
        hit = self.c.ray_hit(self.ray_start, self.ray_direction)
        if hit is None:
            return 1.0
        return float(np.clip(self._ray_parameter(hit), 0.0, 1.0))

    def scene_shapes(self) -> list[np.ndarray]:
        """The scene polylines, mapped onto the uplifted world."""
        return [self.c.map_points(polyline) for polyline in self.scene]

    def flat_shapes(self) -> list[np.ndarray]:
        """The same polylines where they started, in the flat world."""
        return [polyline.copy() for polyline in self.scene]

    def bounds(self, states: Iterable[FrameState]) -> tuple[float, float, float, float]:
        """Data bounding box over every frame, so the view never jitters."""
        xs: list[np.ndarray] = []
        zs: list[np.ndarray] = []

        def add(points: np.ndarray) -> None:
            points = np.atleast_2d(points)
            xs.append(points[:, 0])
            zs.append(points[:, 1])

        saved = (self.c.bending, self.c.normal_w, self.c.arc_w)
        for state in states:
            self.apply(state)
            gx, gz = self.c.ground(self.ground_s)
            add(np.column_stack([gx, gz]))
            for mapped in self.scene_shapes():
                add(mapped)
            if not self.o.hide_flat:
                flat = truncate(self.flat_ray(), self.seen_fraction())
                flat = flat[np.all(np.isfinite(flat), axis=1)]
                if len(flat):
                    add(flat)
        self.c.set_state(*saved)

        add(self.ray_points())
        if not self.o.hide_flat:
            for polyline in self.flat_shapes():
                add(polyline)
            add(np.array([[0.0, 0.0], [self.c.world_radius, 0.0]]))

        x = np.concatenate(xs)
        z = np.concatenate(zs)
        return float(np.min(x)), float(np.max(x)), float(np.min(z)), float(np.max(z))

    # -- drawing ------------------------------------------------------------

    def draw(self, ax, state: FrameState) -> None:
        self.apply(state)
        bent = state.bending > 1e-9

        if not self.o.hide_flat and bent:
            self._draw_flat_reference(ax)

        if self.o.show_normals:
            self._draw_normals(ax)
        self._draw_scene(ax)
        self._draw_ground(ax)
        self._draw_rays(ax, state)
        if self.o.readout:
            self._draw_readout(ax, state)

    def _draw_flat_reference(self, ax) -> None:
        colors = self.colors
        ax.plot(
            [0.0, self.c.world_radius], [0.0, 0.0],
            color=colors["flat"], linewidth=self.o.line_scale * 1.2, zorder=1,
        )
        for polyline in self.flat_shapes():
            ax.plot(
                polyline[:, 0], polyline[:, 1],
                color=colors["flat"], linewidth=self.o.line_scale * 1.0, zorder=1,
            )

    def _draw_ground(self, ax) -> None:
        """The uplifted ground, as one solid line."""
        gx, gz = self.c.ground(self.ground_s)
        ax.plot(
            gx, gz,
            color=self.colors["ground"], linewidth=self.o.line_scale * 3.0,
            solid_capstyle="round", zorder=5,
        )

    def _draw_normals(self, ax) -> None:
        from matplotlib.collections import LineCollection

        s = np.arange(0.0, self.c.world_radius + 1e-9, self.o.tile)
        gx, gz = self.c.ground(s)
        nx, nz = self.c.normals(s)
        length = self.o.normal_length
        segments = np.stack(
            [np.column_stack([gx, gz]), np.column_stack([gx + length * nx, gz + length * nz])],
            axis=1,
        )
        ax.add_collection(
            LineCollection(
                segments, colors=self.colors["normals"],
                linewidths=self.o.line_scale * 1.0, zorder=2,
            )
        )

    def _draw_scene(self, ax) -> None:
        colors = self.colors
        for mapped in self.scene_shapes():
            ax.plot(
                mapped[:, 0], mapped[:, 1],
                color=colors["scene_edge"], linewidth=self.o.line_scale * 1.4, zorder=3,
            )

    def _draw_rays(self, ax, state: FrameState) -> None:
        colors = self.colors
        fraction = state.ray_visible
        if fraction <= 0.0:
            return

        straight = truncate(self.ray_points(), fraction)
        ax.plot(
            straight[:, 0], straight[:, 1],
            color=colors["ray"], linewidth=self.o.line_scale * 1.8, zorder=6,
        )

        # The same stretch of the ray, drawn where it came from. Points the
        # transformation does not reach come back as NaN and break the line.
        if not self.o.hide_flat and state.bending > 1e-9:
            flat = truncate(self.flat_ray(), min(fraction, self.seen_fraction()))
            ax.plot(
                flat[:, 0], flat[:, 1],
                color=colors["ray_flat"], linewidth=self.o.line_scale * 1.8,
                linestyle="--", zorder=2,
            )

        # A hit is marked once the revealed part of the ray has reached it, so
        # that shooting the ray out lands on the point rather than announcing it
        # in advance.
        hit = self.c.ray_hit(self.ray_start, self.ray_direction)
        if hit is None or self._ray_parameter(hit) > fraction:
            return
        ax.plot(
            [hit[0]], [hit[1]], marker="o", linestyle="None",
            markersize=self.o.marker_scale * 7.0, color=colors["hit"], zorder=7,
        )
        # Its pre-image is the ground point the observer is actually looking at:
        # the distance the paper's angle-to-distance table would return.
        if not self.o.hide_flat:
            seen = self.c.inverse_points(hit[None, :])[0]
            if np.all(np.isfinite(seen)):
                ax.plot(
                    [seen[0]], [seen[1]], marker="o", linestyle="None",
                    markersize=self.o.marker_scale * 5.0, color=colors["flat"], zorder=2,
                )

    def _ray_parameter(self, point: np.ndarray) -> float:
        """Where a point sits along the cast ray; 1.0 is its finish point."""
        squared = float(np.dot(self.ray_direction, self.ray_direction))
        if squared < 1e-18:
            return 0.0
        return float(np.dot(point - self.ray_start, self.ray_direction) / squared)

    def _draw_readout(self, ax, state: FrameState) -> None:
        lines = [
            self.c.method,
            f"bending       {state.bending:.3f}",
            f"alpha'_w      {math.degrees(self.c.alpha_w):.2f} deg",
            f"p             {self.c.p:.6g}",
            f"normal w      {state.normal_w:.3f}",
            f"arc length a  {state.arc_w:.3f}",
            f"ray visible   {state.ray_visible:.3f}",
        ]
        ax.text(
            0.02, 0.98, "\n".join(lines),
            transform=ax.transAxes, ha="left", va="top",
            color=self.colors["readout"], family="monospace",
            fontsize=self.o.font_size, zorder=10,
        )


# ---------------------------------------------------------------------------
# output
# ---------------------------------------------------------------------------


def make_figure(options: argparse.Namespace, colors: dict):
    import matplotlib.pyplot as plt

    width, height = options.size
    figure = plt.figure(
        figsize=(width / options.dpi, height / options.dpi),
        dpi=options.dpi,
        facecolor=colors["background"],
    )
    axes = figure.add_axes((0.0, 0.0, 1.0, 1.0))
    axes.set_facecolor(colors["background"])
    axes.set_aspect("equal", adjustable="box")
    if options.axes:
        for spine in axes.spines.values():
            spine.set_color(colors["axes"])
        axes.tick_params(colors=colors["axes"], labelsize=options.font_size)
    else:
        axes.set_axis_off()
    return figure, axes


def fit_limits(axes, bounds, size, padding) -> None:
    """Fit the data box into the padded content area, keeping the scale equal.

    ``padding`` is (top, right, bottom, left) in pixels. The data box is first
    widened to the aspect of the content area -- the output minus the padding --
    which fixes the number of data units per pixel; the padding is then added
    back at that scale, so it comes out at exactly the requested pixel width on
    every side.
    """
    x_min, x_max, z_min, z_max = bounds
    top, right, bottom, left = padding
    content_width = size[0] - left - right
    content_height = size[1] - top - bottom
    if content_width <= 0 or content_height <= 0:
        raise SystemExit("--padding leaves no room for the drawing")

    data_width = max(x_max - x_min, 1e-6)
    data_height = max(z_max - z_min, 1e-6)
    aspect = content_width / content_height
    if data_width / data_height < aspect:
        extra = (data_height * aspect - data_width) / 2.0
        x_min -= extra
        x_max += extra
    else:
        extra = (data_width / aspect - data_height) / 2.0
        z_min -= extra
        z_max += extra

    scale = (x_max - x_min) / content_width  # data units per pixel
    axes.set_xlim(x_min - left * scale, x_max + right * scale)
    axes.set_ylim(z_min - bottom * scale, z_max + top * scale)


def render_frames(
    renderer: SideViewRenderer,
    states: Sequence[FrameState],
    options: argparse.Namespace,
    colors: dict,
    emit: Callable[[int], None],
    figure,
    axes,
    bounds,
) -> None:
    for index, state in enumerate(states):
        axes.clear()
        axes.set_facecolor(colors["background"])
        axes.set_aspect("equal", adjustable="box")
        if not options.axes:
            axes.set_axis_off()
        fit_limits(axes, bounds, options.size, options.padding_px)
        renderer.draw(axes, state)
        emit(index)


def write_images(renderer, states, options, colors, figure, axes, bounds) -> list[Path]:
    written: list[Path] = []
    single = len(states) == 1
    target = Path(options.output)

    if single:
        target.parent.mkdir(parents=True, exist_ok=True)
        paths = [target]
    else:
        directory = target if target.suffix == "" else target.with_suffix("")
        directory.mkdir(parents=True, exist_ok=True)
        suffix = target.suffix or ".png"
        paths = [directory / f"frame_{i:05d}{suffix}" for i in range(len(states))]

    def emit(index: int) -> None:
        figure.savefig(paths[index], dpi=options.dpi, facecolor=colors["background"])
        written.append(paths[index])

    render_frames(renderer, states, options, colors, emit, figure, axes, bounds)
    return written


def write_video(renderer, states, options, colors, figure, axes, bounds) -> Path:
    from matplotlib import animation

    target = Path(options.output)
    target.parent.mkdir(parents=True, exist_ok=True)

    if target.suffix.lower() == ".gif":
        writer = animation.PillowWriter(fps=options.fps)
    else:
        if not animation.FFMpegWriter.isAvailable():
            raise SystemExit(
                "ffmpeg is required for video output; install it or use --output "
                "with a .gif suffix, or --format image"
            )
        writer = animation.FFMpegWriter(
            fps=options.fps,
            codec="libx264",
            bitrate=-1,
            extra_args=["-pix_fmt", "yuv420p", "-crf", str(options.crf)],
        )

    with writer.saving(figure, str(target), options.dpi):
        render_frames(
            renderer, states, options, colors,
            lambda index: writer.grab_frame(facecolor=colors["background"]),
            figure, axes, bounds,
        )
    return target


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_size(text: str) -> tuple[int, int]:
    parts = text.lower().replace(",", "x").split("x")
    if len(parts) != 2:
        raise argparse.ArgumentTypeError(f"--size: expected WIDTHxHEIGHT, got {text!r}")
    try:
        width, height = int(parts[0]), int(parts[1])
    except ValueError:
        raise argparse.ArgumentTypeError(f"--size: not an integer in {text!r}") from None
    if width < 16 or height < 16:
        raise argparse.ArgumentTypeError("--size: both dimensions must be at least 16")
    return width, height


class Padding(NamedTuple):
    """One padding value, in pixels or as a percentage of the output."""

    value: float
    percent: bool

    def __repr__(self) -> str:  # what --help prints for the default
        return f"{self.value:g}%" if self.percent else f"{self.value:g}px"


def parse_padding(text: str) -> Padding:
    text = text.strip()
    percent = text.endswith("%")
    number = text[:-1] if percent else text
    try:
        value = float(number)
    except ValueError:
        raise argparse.ArgumentTypeError(f"--padding: not a number: {text!r}") from None
    if value < 0.0:
        raise argparse.ArgumentTypeError(f"--padding: must not be negative: {text!r}")
    return Padding(value, percent)


def padding_pixels(
    values: Sequence[Padding], size: tuple[int, int]
) -> tuple[float, float, float, float]:
    """Expand CSS shorthand to (top, right, bottom, left) in pixels.

    A percentage is taken of the output dimension it sits on -- the height for
    top and bottom, the width for left and right -- rather than of the width
    throughout as CSS does, so that a single percentage pads a portrait frame
    evenly instead of leaving thin bands top and bottom.
    """
    count = len(values)
    if count == 1:
        ordered = values * 4
    elif count == 2:
        ordered = [values[0], values[1], values[0], values[1]]
    elif count == 3:
        ordered = [values[0], values[1], values[2], values[1]]
    elif count == 4:
        ordered = list(values)
    else:
        raise argparse.ArgumentTypeError("--padding: expected 1 to 4 values")

    width, height = size
    against = (height, width, height, width)
    return tuple(
        value * span / 100.0 if percent else value
        for (value, percent), span in zip(ordered, against)
    )


def parse_point(text: str) -> np.ndarray:
    parts = [p for p in text.replace(";", ",").split(",") if p.strip()]
    if len(parts) != 2:
        raise argparse.ArgumentTypeError(f"expected X,Y, got {text!r}")
    try:
        return np.array([float(parts[0]), float(parts[1])], dtype=float)
    except ValueError:
        raise argparse.ArgumentTypeError(f"not a number in {text!r}") from None


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="animate_sideview.py",
        description=(
            "Side-view demonstration of the Tsunami construction. The four "
            "controls below the profile options each accept a single VALUE or "
            "an interval START:STOP; any interval turns the run into an "
            "animation, walked with --easing or with a per-control easing "
            "given as START:STOP:EASING."
        ),
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    scene = parser.add_argument_group("scene and geometry")
    scene.add_argument(
        "--scene", type=Path, default=None,
        help="CSV of 's,q' rows (ground distance, height); blank line starts a "
             "new polyline. A built-in skyline is used when omitted.",
    )
    scene.add_argument(
        "--ray", type=parse_point, nargs=2, metavar=("START", "FINISH"), default=None,
        help="cast ray as two 'X,Y' points in the uplifted world "
             "(default: observer to the world end)",
    )
    scene.add_argument(
        "--observer", type=parse_point, default=None, metavar="X,Y",
        help=f"observer position (default: 0,{OBSERVER_H:g})",
    )
    scene.add_argument("--world-radius", type=float, default=WORLD_SIZE, help="d_w in meters")
    scene.add_argument(
        "--tile", type=float, default=TILE_SZ,
        help="spacing in meters of the normal hairs drawn by --show-normals",
    )
    scene.add_argument(
        "--max-angle", type=float, default=MAX_ANGLE,
        help="alpha'_w in degrees reached at bending 1",
    )
    scene.add_argument(
        "--hyperbolic-b", type=float, default=None,
        help="offset b of the hyperbolic profile (default: the world radius)",
    )

    profile = parser.add_argument_group("profile")
    profile.add_argument(
        "--method", choices=sorted(METHODS), default="parabolic", help="Tsunami profile"
    )

    controls = parser.add_argument_group(
        "construction controls (VALUE, START:STOP, or START:STOP:EASING)"
    )
    controls.add_argument(
        "--bending", default="0:1", metavar="V",
        help="uplift, 0 = flat world, 1 = spread to --max-angle",
    )
    controls.add_argument(
        "--normal", default="1", metavar="V",
        help="how much the profile normal is used to lift object heights, 0..1",
    )
    controls.add_argument(
        "--arclength", default="1", metavar="V",
        help="how much the arc-length parametrization is used, 0..1",
    )
    controls.add_argument(
        "--ray-visible", default="1", metavar="V",
        help="visible leading fraction of the cast ray, 0..1",
    )
    controls.add_argument(
        "--easing", choices=list(EASINGS), default=DEFAULT_EASING, metavar="NAME",
        help="how an interval is walked over the frames, for every control that "
             "does not name its own as START:STOP:EASING. Choices: "
             + ", ".join(EASINGS),
    )

    output = parser.add_argument_group("output")
    output.add_argument("--size", type=parse_size, default=DEFAULT_SIZE, help="WIDTHxHEIGHT in pixels")
    output.add_argument("--output", type=Path, default=None, help=f"default: {DEFAULT_STEM}.mp4/.png")
    output.add_argument(
        "--format", choices=("auto", "image", "video"), default="auto",
        help="auto = video when a control is an interval, otherwise a single image",
    )
    output.add_argument("--fps", type=int, default=DEFAULT_FPS, help="video frame rate")
    output.add_argument("--steps", type=int, default=DEFAULT_STEPS, help="number of animation steps")
    output.add_argument(
        "--padding", type=parse_padding, nargs="+", metavar="V",
        default=[Padding(DEFAULT_PADDING_PERCENT, True)],
        help="space between the drawing and the image border, in pixels or as a "
             "percentage with '%%'. One to four values in CSS order: all; "
             "vertical horizontal; top horizontal bottom; top right bottom left",
    )
    output.add_argument("--dpi", type=int, default=DEFAULT_DPI, help="figure dpi (affects line and text scale)")
    output.add_argument("--crf", type=int, default=18, help="x264 quality, lower is better")

    style = parser.add_argument_group("style")
    style.add_argument("--palette", choices=sorted(PALETTES), default="light")
    style.add_argument(
        "--color", action="append", default=[], metavar="KEY=VALUE",
        help="override one palette entry, repeatable; keys: " + ", ".join(sorted(PALETTES["light"])),
    )
    style.add_argument("--hide-flat", action="store_true", help="do not draw the flat world underneath")
    style.add_argument("--readout", action="store_true", help="show the parameter readout")
    style.add_argument("--axes", action="store_true", help="draw the axis frame and ticks")
    style.add_argument("--show-normals", action="store_true", help="draw profile normals along the ground")
    style.add_argument("--normal-length", type=float, default=None, help="length of the normal hairs in meters")
    style.add_argument("--line-scale", type=float, default=2.0, help="multiplier for all line widths")
    style.add_argument("--marker-scale", type=float, default=1.0, help="multiplier for all marker sizes")
    style.add_argument("--font-size", type=float, default=13.0, help="readout font size")

    return parser


def resolve_colors(options: argparse.Namespace) -> dict:
    colors = dict(PALETTES[options.palette])
    for item in options.color:
        if "=" not in item:
            raise SystemExit(f"--color: expected KEY=VALUE, got {item!r}")
        key, value = item.split("=", 1)
        key = key.strip()
        if key not in colors:
            raise SystemExit(
                f"--color: unknown key {key!r}; choose from {', '.join(sorted(colors))}"
            )
        colors[key] = value.strip()
    return colors


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    options = parser.parse_args(argv)

    try:
        ramps = {
            "bending": parse_ramp(options.bending, 0.0, 1.0, "--bending", options.easing),
            "normal": parse_ramp(options.normal, 0.0, 1.0, "--normal", options.easing),
            "arclength": parse_ramp(options.arclength, 0.0, 1.0, "--arclength", options.easing),
            "ray_visible": parse_ramp(
                options.ray_visible, 0.0, 1.0, "--ray-visible", options.easing
            ),
        }
    except argparse.ArgumentTypeError as error:
        parser.error(str(error))
    animated = any(ramp.animated for ramp in ramps.values())

    if options.format == "auto":
        options.format = "video" if animated else "image"
    if options.steps < 1:
        raise SystemExit("--steps must be at least 1")
    try:
        options.padding_px = padding_pixels(options.padding, options.size)
    except argparse.ArgumentTypeError as error:
        parser.error(str(error))
    top, right, bottom, left = options.padding_px
    if left + right >= options.size[0] or top + bottom >= options.size[1]:
        parser.error(
            f"--padding: {left + right:.0f}x{top + bottom:.0f} px leaves no room in a "
            f"{options.size[0]}x{options.size[1]} image"
        )
    # A video of constant controls is still a video: the frames simply repeat.
    # A still of constant controls is one file, not --steps copies of it.
    steps = options.steps if (animated or options.format == "video") else 1

    if options.output is None:
        options.output = Path(f"{DEFAULT_STEM}.mp4" if options.format == "video" else f"{DEFAULT_STEM}.png")
    if options.format == "video" and options.output.suffix == "":
        options.output = options.output.with_suffix(".mp4")

    observer = np.array([0.0, OBSERVER_H]) if options.observer is None else options.observer
    if abs(observer[0]) > 1e-9:
        print(
            "note: the observer is off the vertical axis; the analytic ray "
            "intersection does not apply and the sampled ground is used instead",
            file=sys.stderr,
        )

    if options.ray is None:
        options.ray = [observer.copy(), np.array([options.world_radius, 0.0])]
    try:
        raw_scene = (
            load_scene(options.scene) if options.scene else sample_scene(options.world_radius)
        )
    except (OSError, ValueError) as error:
        raise SystemExit(f"--scene: {error}") from None
    step = options.world_radius / 250.0
    options.scene_polylines = [densify(polyline, step) for polyline in raw_scene]
    if options.normal_length is None:
        options.normal_length = options.world_radius * 0.04

    # The tables must cover whatever the scene and the ray actually reach, not
    # only the modelled world.
    reach = max(
        options.world_radius,
        max(float(np.max(polyline[:, 0])) for polyline in options.scene_polylines),
        float(max(options.ray[0][0], options.ray[1][0])),
    )
    construction = Construction(
        method=options.method,
        world_radius=options.world_radius,
        observer_height=float(observer[1]),
        max_angle_deg=options.max_angle,
        hyperbolic_b=options.hyperbolic_b,
        reach=reach,
    )

    matplotlib.use("Agg")
    colors = resolve_colors(options)
    states = frame_states(ramps, steps)
    renderer = SideViewRenderer(construction, options, colors)

    figure, axes = make_figure(options, colors)
    bounds = renderer.bounds(states)

    if options.format == "video":
        target = write_video(renderer, states, options, colors, figure, axes, bounds)
        print(f"wrote {target} ({len(states)} frames at {options.fps} fps)")
    else:
        written = write_images(renderer, states, options, colors, figure, axes, bounds)
        if len(written) == 1:
            print(f"wrote {written[0]}")
        else:
            print(f"wrote {len(written)} frames to {written[0].parent}")

    import matplotlib.pyplot as plt
    plt.close(figure)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
