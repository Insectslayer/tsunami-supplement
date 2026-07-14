# -*- coding: utf-8 -*-
"""
Created on Fri Apr  4 12:48:37 2025

@author: pam

rendering of regular grid in 3D
"""
#import cv2
import math
import numpy as np
import matplotlib.pyplot as plt
#from scipy.ndimage import minimum_filter, maximum_filter
from scipy.ndimage import binary_dilation
from matplotlib.widgets import Slider, RadioButtons
from matplotlib.collections import LineCollection
from matplotlib.gridspec import GridSpec, GridSpecFromSubplotSpec
from dataclasses import dataclass
from functools import cached_property
from pathlib import Path

from tsunami import HyperbolicTsunami, AngularTsunami, ParabolicTsunami, SphericalTsunami

"""
This file demonstrates projective transformations of points on a line
that can be embedded in a curved space.

"""
# main parameters
OBSERVER_H = 100.  # observer altitude in meters
DISPLAY_F = 0.007  # focal length (observer to display plane) in meters
WORLD_SIZE = 500  # in meters
TILE_SZ = WORLD_SIZE/40  # size of a tile in meters
BORDER_SIZE = WORLD_SIZE/10  # border for ploting views (top view and side view)

AVAILABLE_METHODS = {
    1 : { "tsunami_fun" : "Parabolic" },
    2 : { "tsunami_fun" : "Hyperbolic" },
    3 : { "tsunami_fun" : "Angular" },
    4 : { "tsunami_fun" : "Spherical" },
}
#==== SELECT METHOD HERE ===================================================
SELECTED_METHOD = 4
#===========================================================================
ANGLES = np.linspace(0, 180, 600)

# control panel constants
HALF_OF_FOV_ALPHA = 50
ALPHA_FROM = 0
ALPHA_TO = 180
ALPHA_NUM_STEPS = 100
INITIAL_ALPHA =  HALF_OF_FOV_ALPHA

H_FROM = 1.
H_TO = 1501.
H_STEP = 50.

ELEVATIONS = np.radians(np.arange(5, 176, 5))
INITIAL_ELEVATION_IDX = 0

# color constants
BLACK = 0
GRAY = 127
WHITE = 255
RED = (1., 0., 0.)
BLUE = (0., 0., 1.)
DARK_BLUE = (0., 0., 0.5)
DARK_GREEN = (0., 0.5, 0.)
GREEN = (0., 1., 0.)
MAGENTA = (1., 0., 1.)

# style constants
OBSERVER_STYLE = dict(marker='*', linestyle='None', markersize=10, color='r')
VIEWPOINT_STYLE = dict(marker='o', linestyle='None', markersize=3, color='lime')
SIDE_VIEWAXIS_STYLE = dict(marker=None, linestyle='--', linewidth=1, color='g')
SIDE_VIEWANGLE_STYLE = dict(marker=None, linestyle='--', linewidth=1, color='blue')
SIDE_WORLD_STYLE = dict(marker='o', linestyle='-', linewidth=1, color='r', markersize=3)
FOV_LINE_STYLE = dict(linewidth=1, color='blue')
TFOV_LINE_STYLE = dict(linewidth=1, color='magenta')
WORLD_CIRCLE_STYLE = dict(color='red', fill=False, linewidth=1)

WORLD_INF_COLOR = DARK_BLUE
WORLD_OUTSIDE_COLOR = DARK_GREEN  # None will lead to chessboard pattern
CENTER_COLOR = GREEN
WORLD_END_COLOR = RED


@dataclass
class TsunamiWorld:
    # --- basic parameters defining the world ---
    # observer parameters
    h : float = OBSERVER_H
    f : float = DISPLAY_F
    alpha : float = INITIAL_ALPHA
    hfov_alpha : float = HALF_OF_FOV_ALPHA
    tile_sz : float = TILE_SZ
    world_size : int = WORLD_SIZE
    angles = ANGLES


    @property
    def tile_hsz(self):
        return self.tile_sz/2

    # --- useful values computed from the basic parameters ---
    @property
    def alpha_rad(self): 
        return math.radians(self.alpha)
    @property
    def cos_alpha(self):
        return math.cos(self.alpha_rad)
    @property
    def sin_alpha(self):
        return math.sin(self.alpha_rad)

    @property
    def alpha_b(self):
        return self.alpha - self.hfov_alpha

    @property
    def alpha_t(self):
        return self.alpha + self.hfov_alpha

    @property
    def alpha_b_rad(self):
        return math.radians(self.alpha_b)

    @property
    def alpha_t_rad(self):
        return math.radians(self.alpha_t)

    def point_on_display(self, ralpha):
        return np.array((self.f * math.sin(ralpha),
                         self.h - self.f * math.cos(ralpha)))

    @property
    def dsp_0(self):
        return self.point_on_display(self.alpha_rad)
    
    @property
    def dsp_t(self):
        return self.point_on_display(self.alpha_t_rad)

    @property
    def dsp_b(self):
        return self.point_on_display(self.alpha_b_rad)

    # the distance between the origin and the point the observer is looking at
    @property
    def view_dist(self):
        denom = (self.h-self.dsp_0[1])
        return self.h*self.dsp_0[0]/denom if not np.isclose(denom, 0) else np.nan

    # --- parameters related to sideview and topview ---
    # border for ploting views (top view and side view)
    border_size = BORDER_SIZE
    # ranges for plotting
    @property
    def y_range(self):
        return (-self.border_size, self.world_size + self.border_size)
    @property
    def z_range(self):
        return (-self.border_size, max(self.world_size + self.border_size, self.h + self.border_size))
    
    # --- plotting related values
    # 1D arrays of chessboard center lines in the considered range
    @property
    def y_tiles(self):
        y_start = self.y_range[0]
        y_end = self.world_size * 1.5
        return np.arange(y_start - y_start % self.tile_sz,
                         y_end + self.tile_sz, self.tile_sz)

    @property
    def ground(self):
        return (self.y_tiles - self.y_tiles[0]) - self.tile_hsz
    
    @property
    def angles_rad(self):
        return np.radians(self.angles)

    @property
    def dist_on_ground(self):
        d = self.h*np.tan(self.angles_rad)
        d[self.angles>=90] = np.nan
        return d
    
    @property
    def dist_to_visible(self):  # TODO: tsunami
        d = self.h/np.cos(self.angles_rad)
        d[self.angles>=90] = np.nan
        return d
       
    def side_view_angle(self):
        observer = (0, self.h)
        p1x, p1y = point_at_ground(observer, self.dsp_t, self.y_range, self.z_range)
        p2x, p2y = point_at_ground(observer, self.dsp_b, self.y_range, self.z_range)
        return (p1x, 0, p2x), (p1y, self.h, p2y)
    
    def side_view_axis(self):
        observer = (0, self.h)
        px, py = point_at_ground(observer, self.dsp_0, self.y_range, self.z_range)
        return (0, px), (self.h, py)
    
    def welcome_msg(self):
        msg = (
                "Welcome in Tsunami world!\n"
                "-------------------------\n"
                f"World size : {self.world_size}m\n"
                f"Observer h : {self.h}m\n"
              )
        print(msg)


def create_one_leading_zero(lst):
    i = 0
    while i < len(lst) and np.isclose(lst[i], 0):
        i += 1
    return [0] + lst[i:]

w = TsunamiWorld()
w.welcome_msg()

def method_label() -> str:
    method = AVAILABLE_METHODS.get(SELECTED_METHOD)
    if method:
        label = method.get("tsunami_fun")
        if label:
            return label
    raise RuntimeError("Method selection failed.")

# --- tsunami parameters ---
tsunami = None
match method_label():
    case "Parabolic":
        tsunami = ParabolicTsunami(world_size=w.world_size, keep_lengths=True)
    case "Hyperbolic":
        tsunami = HyperbolicTsunami(a=w.world_size, world_size=w.world_size, keep_lengths=True)
    case "Angular":
        tsunami = AngularTsunami(world_size=w.world_size, keep_lengths=True)
    case "Spherical":
        tsunami = SphericalTsunami(world_size=w.world_size, keep_lengths=True)
    case _:
        raise ValueError("Unsupported Tsunami function selected.")
assert tsunami

elevations = ELEVATIONS
num_elevations = len(elevations)

tsunami_idx = INITIAL_ELEVATION_IDX

print("Precomputing tsunami params...")
tsunami_params = [tsunami.angle_to_p(w.h, elevations[i]) for i in range(num_elevations)]
tsunami_params = create_one_leading_zero(tsunami_params)
tsunami.lift(tsunami_params[tsunami_idx])
print("done.")


def plot_chessboard_line(ax, x, y):
    """
    plots dashed line in axis ax
    the knots are given by coordinates (x,y)
    the first segment is black and the second is gray
    """
    assert len(x) == len(y)
    segments = [ [(x[i], y[i]), (x[i+1], y[i+1])] for i in range(len(x)-1) ]
    colors = ['black', '#dddddd'] * ((len(x)//2) + 1)
    lc = LineCollection(segments, colors=colors[:len(segments)], linewidths=1)
    ax.add_collection(lc)
    return lc


def sideview_segment_colors(dists):
    """
    Colors side-view ground segments.

    The modelled world interval [0, world_size] keeps the alternating
    chessboard colors. Everything outside that interval is drawn with
    WORLD_OUTSIDE_COLOR, if it is defined.
    """
    colors = []
    for i in range(len(dists) - 1):
        mid = 0.5 * (dists[i] + dists[i + 1])
        if WORLD_OUTSIDE_COLOR and (mid < 0 or mid > w.world_size):
            colors.append(WORLD_OUTSIDE_COLOR)
        else:
            colors.append('black' if i % 2 == 0 else '#dddddd')
    return colors


def plot_sideview_chessboard_line(ax, dists, x, y):
    """
    Plot side-view ground line with green outside-world continuation.
    dists are original ground distances used only to decide segment colors.
    """
    assert len(dists) == len(x) == len(y)
    segments = [[(x[i], y[i]), (x[i + 1], y[i + 1])]
                for i in range(len(x) - 1)]
    lc = LineCollection(segments, colors=sideview_segment_colors(dists), linewidths=1)
    ax.add_collection(lc)
    return lc


def point_at_ground(p0, p1, range_x, range_y):
    """
    returns a point on the ground in the sideview for the viewing direction 
    from p1 through p2. If the ground is not seen, it returns 
    a point on the edge of the plot, which is defined by range_x and range_y
    """
    x0, y0 = p0
    x1, y1 = p1
    assert range_x[0] < x0 < range_x[1]
    assert range_y[0] < y0 < range_y[1]
    vx, vy = x1 - x0, y1 - y0
    if vy < 0: # we are looking towards the ground
        return x0-vx*y0/vy, 0 # return the point at the ground
    if np.isclose(vy, 0): # we are looking to the right
        assert vx > 0
        return range_x[1], y0

    # we are looking to the sky, return the point on the "ceiling"
    t = (range_y[1]-y0)/vy
    return x0+vx*t, range_y[1]


def plot_sideview(ax):
    """
    plots side view of the scene for azimut 0
    """
    # plot flat and lifted ground.  Both continue to the edge of the side view;
    # the part outside the modelled world is drawn in WORLD_OUTSIDE_COLOR.
    plot_sideview_chessboard_line(
        ax,
        w.ground,
        w.ground,
        np.zeros_like(w.ground),
    )
    assert tsunami
    x, y = tsunami.uplift_ground(w.ground)
    sv_lg_data = plot_sideview_chessboard_line(ax, w.ground, x, y)

    # plot world_size
    sv_wp_data, = ax.plot(w.world_size, 0, **SIDE_WORLD_STYLE)
    x, y = tsunami.d_to_xy(w.world_size)
    sv_twp_data, = ax.plot(x, y, **SIDE_WORLD_STYLE)
    # plot view axis
    sv_vaxis_data, = ax.plot(*w.side_view_axis(), **SIDE_VIEWAXIS_STYLE)
    
    # plot viewing angle
    sv_vangle_data, = ax.plot(*w.side_view_angle(), **SIDE_VIEWANGLE_STYLE)
    
    # plot observer
    sv_op_data, = ax.plot(0, w.h, **OBSERVER_STYLE)
    
    # plot observered point in the ground
    sv_vp_data, = ax.plot(w.view_dist, 0, **VIEWPOINT_STYLE)
    
    sv_vtp1_data = None
    sv_vtp2_data = None

    ax.set_xlim(w.y_range)
    ax.set_ylim(w.z_range)
    #ax.grid(True, which='both', color='gray', linestyle='--', linewidth=0.5)
    ax.set_aspect('equal')
    #plt.show()
    return sv_lg_data, sv_wp_data, sv_twp_data, sv_op_data, sv_vp_data, sv_vtp1_data, sv_vtp2_data, sv_vaxis_data, sv_vangle_data


def distances_to_colors(dists):
    """
    Convert visible ground distances to RGB colors.

    Black/white: tiles inside the modelled world.
    Green:       ground beyond the modelled world.
    Blue:        no ground is visible in the given direction.
    """
    dists = np.asarray(dists, dtype=float)

    colors = np.empty((len(dists), 3), dtype=float)
    colors[:] = BLUE

    finite = np.isfinite(dists)

    # Ground beyond the modelled world.
    outside_world = finite & (dists > w.world_size)
    colors[outside_world] = WORLD_OUTSIDE_COLOR

    # Tiles inside the modelled world.
    inside_world = finite & (dists >= 0) & (dists <= w.world_size)

    tile_indices = np.floor(dists[inside_world] / w.tile_sz).astype(int)
    black_tiles = tile_indices % 2 == 0
    white_tiles = ~black_tiles

    inside_colors = np.empty((inside_world.sum(), 3), dtype=float)
    inside_colors[black_tiles] = (0.0, 0.0, 0.0)
    inside_colors[white_tiles] = (1.0, 1.0, 1.0)

    colors[inside_world] = inside_colors

    return colors


def tsunami_visible_distances():
    assert tsunami
    # TODO: nejsou tyto výpočty navíc? tsunami se počítá u sideview.
    distances = np.full_like(w.angles, np.nan, dtype=float)

    for i, alpha_rad in enumerate(w.angles_rad):
        # Direction where alpha=0 points vertically down
        # and alpha=90 degrees points towards the horizon.
        direction = (
            math.sin(alpha_rad),
            -math.cos(alpha_rad),
        )

        try:
            t = tsunami.t_seen_in_direction(direction, w.h)

            if t is None or not np.isfinite(t):
                continue

            # Original ground distance represented by parameter t.
            distances[i] = tsunami.t_to_s(t)

        except (ValueError, RuntimeError, FloatingPointError):
            # Direction does not intersect the transformed ground.
            continue

    return distances


def plot_color_strip(ax, colors, label):
    """
    Display a one-dimensional RGB color strip.

    Parameters
    ----------
    ax
        Axes used for the strip.
    colors
        Array of shape (n, 3).
    label
        Text displayed to the right of the strip.
    """
    image = ax.imshow(
        colors[None, :, :],
        extent=(0, 180, 0, 1),
        origin="lower",
        aspect="auto",
        interpolation="nearest",
    )

    ax.set_xlim(0, 180)
    ax.set_ylim(0, 1)

    # Hide axes decorations.
    ax.set_xticks([])
    ax.set_yticks([])

    # Keep a visible frame around the strip.
    for spine in ax.spines.values():
        spine.set_visible(True)

    # Label to the right of the strip.
    ax.text(1.02, 0.5, label, transform=ax.transAxes, ha="left", va="center", clip_on=False)

    return image


def plot_funs(ax):
    pf_d, = ax.plot(w.angles, w.dist_on_ground, 'b', label="Origin to ground")
    pf_d1, = ax.plot(w.angles, w.dist_to_visible, 'r', label="Observer to ground")

    tsunami_dists = tsunami_visible_distances()
    pf_d2, = ax.plot(w.angles, tsunami_dists, 'g', label="Origin to tsunami")

    # Viewing direction
    pf_view_axis = ax.axvline(w.alpha, **SIDE_VIEWAXIS_STYLE)

    # FOV boundaries
    pf_fov_bottom = ax.axvline(w.alpha_b, **SIDE_VIEWANGLE_STYLE)
    pf_fov_top = ax.axvline(w.alpha_t, **SIDE_VIEWANGLE_STYLE)
    
    y_min = 0
    y_max = 5 * WORLD_SIZE

    ax.set_xlabel(r"$\alpha$ [deg]")
    ax.set_ylabel("Distance [m]")    
    ax.set_xlim(0, 180)
    ax.set_ylim(y_min, y_max)

    # Stejný tvar kreslicí plochy jako u side view.
    # x_min, x_max = w.y_range
    # y_min, y_max = w.z_range
    # box_aspect = (y_max - y_min) / (x_max - x_min)
    # ax.set_box_aspect(box_aspect)

    # ax.legend()
    # ax.legend(loc="lower center", bbox_to_anchor=(0.5, 1.02), ncol=3, frameon=False)
    # ax.legend(loc="upper right", framealpha=0.9)
    ax.legend(loc="center left", bbox_to_anchor=(1.02, 0.5))

    return pf_d, pf_d1, pf_d2, pf_view_axis, pf_fov_bottom, pf_fov_top


fig = plt.figure()
outer_grid = GridSpec(1, 2, figure=fig,
    left=0.08, right=0.82, bottom=0.30, top=0.90,
    wspace=0.25, width_ratios=[1, 1],
)
# Left: side view
ax_side = fig.add_subplot(outer_grid[0, 0])
# Right: two color strips and the function graph
right_grid = GridSpecFromSubplotSpec(3, 1,
    subplot_spec=outer_grid[0, 1], height_ratios=[0.06, 0.06, 0.88], hspace=0.05)

ax_flat_strip = fig.add_subplot(right_grid[0, 0])
ax_tsunami_strip = fig.add_subplot(right_grid[1, 0], sharex=ax_flat_strip)
ax_funs = fig.add_subplot(right_grid[2, 0], sharex=ax_flat_strip)

# --- axis for horizontal sliders ---
ax_alpha = fig.add_axes((0.10, 0.14, 0.65, 0.03))
# ax_az   = fig.add_axes((0.10, 0.10, 0.65, 0.03))
ax_tsunami_p = fig.add_axes((0.10, 0.06, 0.65, 0.03))
ax_h   = fig.add_axes((0.1, 0.02, 0.65, 0.03))
# ax_method = fig.add_axes((0.8, 0.01, 0.18, 0.19))
# --- sliders ---
s_alpha = Slider(ax_alpha, "alpha", ALPHA_FROM, ALPHA_TO,  valinit=w.alpha,  valstep=(ALPHA_TO-ALPHA_FROM)/ALPHA_NUM_STEPS)
s_tsunami_p = Slider(ax_tsunami_p, "Tsunami p", 0, len(tsunami_params)-1, valinit=tsunami_idx, valstep=1)
s_h = Slider(ax_h, "h", H_FROM, H_TO, valinit=w.h, valstep=H_STEP)

def update(_):
    assert tsunami
    # push slider values into model
    w.alpha = s_alpha.val
    w.h = s_h.val
    idx = int(s_tsunami_p.val)


    # tsunami params and sideview ground
    tsunami.lift(tsunami_params[idx])
    x, y = tsunami.uplift_ground(w.ground)

    # --- sideview updates ---
    segments = [[(x[i], y[i]), (x[i + 1], y[i + 1])] for i in range(len(x) - 1)]
    sv_lg_data.set_segments(segments)
    sv_lg_data.set_color(sideview_segment_colors(w.ground))
    sv_wp_data.set_data((w.world_size,), (0,))
    x, y = tsunami.d_to_xy(w.world_size)
    sv_twp_data.set_data((x,), (y,))
    sv_op_data.set_data((0,), (w.h,))
    sv_vp_data.set_data((w.view_dist,), (0,))
    sv_vaxis_data.set_data(*w.side_view_axis())
    x, y = w.side_view_angle()
    sv_vangle_data.set_data(x, y)
    
    if sv_vtp1_data:
        #print("Side view")
        v1 = (x[0]-x[1], y[0]-y[1])
        t1 = tsunami.t_seen_in_direction(v1, w.h)
        x1, y1 = tsunami.t_to_xy(t1)
        #print(f"point1: {(x1, y1)}, d:{tsunami.t_to_s(t1)}")
        sv_vtp1_data.set_data((x1,), (y1,))
    if sv_vtp2_data:
        v2 = (x[2]-x[1], y[2]-y[1]) 
        t2 = tsunami.t_seen_in_direction(v2, w.h)
        x2, y2 = tsunami.t_to_xy(t2)
        #print(f"point2: {(x2, y2)}, d:{tsunami.t_to_s(t2)}")
        sv_vtp2_data.set_data((x2,), (y2,))

    pf_view_axis.set_xdata([w.alpha, w.alpha])
    pf_fov_bottom.set_xdata([w.alpha_b, w.alpha_b])
    pf_fov_top.set_xdata([w.alpha_t, w.alpha_t])

    flat_dists = w.dist_on_ground
    tsunami_dists = tsunami_visible_distances()
    pf_d.set_data(w.angles, flat_dists)
    pf_d1.set_data(w.angles, w.dist_to_visible)
    pf_d2.set_data(w.angles, tsunami_dists)

    pf_flat_strip.set_data(distances_to_colors(flat_dists)[None, :, :])
    pf_tsunami_strip.set_data(distances_to_colors(tsunami_dists)[None, :, :])

    fig.canvas.draw_idle()

# všechny slidery napojíme na stejný update
for s in (s_alpha, s_tsunami_p, s_h):
    s.on_changed(update)


mng = plt.get_current_fig_manager()
assert mng
mng.full_screen_toggle()

(
    sv_lg_data, 
    sv_wp_data, 
    sv_twp_data, 
    sv_op_data, 
    sv_vp_data, 
    sv_vtp1_data, 
    sv_vtp2_data, 
    sv_vaxis_data, 
    sv_vangle_data
) = plot_sideview(ax_side)

flat_dists = w.dist_on_ground
tsunami_dists = tsunami_visible_distances()

pf_flat_strip = plot_color_strip(ax_flat_strip, distances_to_colors(flat_dists), "Flat")
pf_tsunami_strip = plot_color_strip(ax_tsunami_strip, distances_to_colors(tsunami_dists), "Tsunami")
(
    pf_d, 
    pf_d1, 
    pf_d2, 
    pf_view_axis, 
    pf_fov_bottom, 
    pf_fov_top
) = plot_funs(ax_funs)

fig.suptitle(f"{method_label()} tsunami method", fontsize=16, y=0.98)
plt.show()