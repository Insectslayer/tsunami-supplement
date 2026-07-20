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
from dataclasses import dataclass
from functools import cached_property
from pathlib import Path

from tsunami import HyperbolicTsunami, AngularTsunami, ParabolicTsunami, SphericalTsunami

"""
This file demonstrates projective transformations of a regular grid in the
plane. The plane can also be mapped onto a Tsunami transformed surface.

We consider the following coordinate systems
World: (x,y,z) in meters

Observer is placed at (0,0,h) in the world, looking in the direction az
(azimuth in degrees) and with tilt alpha. The world (plane/Tsunami surface)
is being projected on the plane (2D detector - display) at distance f and
perpendicular to the viewing ray (optical axis).

Observer: (xo,yo,zo) in meters, the origin of his coordinate system is 
the observer itself and the z axis corresponds the optical axis, i.e. it 
passes through the display centre.

DisplayP: (id,jd) in pixel index
    id = -N, ..., -1, 0, 1, ..., N
    jd = -M, ..., -1, 0, 1, ..., M
    
DisplayM: (xd,yd) in meters
    
Image: (i,j)
    i = 0, 1, ..., 2N
    j = 0, 1, ..., 2M

Transformations:
    Image (i,j) -> DisplejP (id, jd) = (i - N, j - M)
    DisplayP (id,jd) -> Image (i, j) = (id + N, jd + M)

    DisplayP (id,jd) -> DisplayM (xd, yd) = (id*pixel_size, jd*pixel_size) 
    DisplayM (xd,yd) -> DisplayP (id, jd) = (xd/pixel_size, yd/pixel_size)

    DisplayM (xd,yd) -> Observer (xo,yo,zo) = (xd,yd,f)
    Observer (xo,yo,zo) -> DisplayM (xd,yd) = (f*xo/zo,f*yo/zo)

    World (x,y,z) -> Observer (xo,yo,zo) = 
    Observer (xo,yo,zo) -> World (x,y,z) = (-yo, xo, -zo*cos(alpha))
"""
# main parameters
OBSERVER_H = 100.  # observer altitude in meters
INITIAL_AZ = 0  # initial azimuth of observer from y axis
DISPLAY_N = 400  # display width is 2N+1 in pixels
DISPLAY_M = 300  # display height is 2M+1 in pixels
DISPLAY_F = 0.007  # focal length (observer to display plane) in meters
DISPLAY_PIXEL_SIZE = .00005  # in meters
DISPLAY_RADIAL = False
WORLD_SIZE = 500  # in meters
TILE_SZ = WORLD_SIZE/40  # size of a tile in meters
BORDER_SIZE = WORLD_SIZE/10  # border for ploting views (top view and side view)

AVAILABLE_METHODS = {
    1 : { "tsunami_fun" : "Parabolic", "method" : "radial" },
    2 : { "tsunami_fun" : "Hyperbolic", "method" : "radial" },
    3 : { "tsunami_fun" : "Angular", "method" : "radial" },
    4 : { "tsunami_fun" : "Spherical", "method" : "radial" },
    5 : { "tsunami_fun" : "Parabolic", "method" : "directional" },
    6 : { "tsunami_fun" : "Hyperbolic", "method" : "directional" },
    7 : { "tsunami_fun" : "Angular", "method" : "directional" },
    8 : { "tsunami_fun" : "Spherical", "method" : "directional" },
    9 : { "tsunami_fun" : "Parabolic", "method" : "mixed" },
    10 : { "tsunami_fun" : "Hyperbolic", "method" : "mixed" },
    11 : { "tsunami_fun" : "Angular", "method" : "mixed" },
    12 : { "tsunami_fun" : "Spherical", "method" : "mixed" },
    13 : { "tsunami_fun" : "Parabolic", "method" : "balanced" },
    14 : { "tsunami_fun" : "Hyperbolic", "method" : "balanced" },
    15 : { "tsunami_fun" : "Angular", "method" : "balanced" },
    16 : { "tsunami_fun" : "Spherical", "method" : "balanced" },
}
#==== SELECT METHOD HERE ===================================================
SELECTED_METHOD = 9
#===========================================================================

MIX = 0.5

# control panel constants
HALF_OF_VFOV = math.degrees(math.atan(DISPLAY_M*DISPLAY_PIXEL_SIZE/DISPLAY_F))
ALPHA_FROM = 0
ALPHA_TO = 180 - HALF_OF_VFOV
ALPHA_NUM_STEPS = 10
INITIAL_ALPHA = HALF_OF_VFOV  # projection plane tilt - 0 is heading towards ground

AZ_FROM = -90
AZ_TO = 90
AZ_STEP = 5

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
# SIDE_TBOUNDS_STYLE = dict(marker='o', color='blue', markersize=3)
SIDE_TBOUNDS_STYLE = None

WORLD_INF_COLOR = DARK_BLUE
WORLD_OUTSIDE_COLOR = DARK_GREEN  # None will lead to chessboard pattern
CENTER_COLOR = GREEN
WORLD_END_COLOR = RED


"""
    cached_property decorator extended by dependances
    for automatic invalidation
"""
def depends_on(*fields):
    def deco(func):
        cp = cached_property(func)
        cp._depends_on = set(fields)
        return cp
    return deco

@dataclass
class TsunamiWorld:
    # --- basic parameters defining the world ---
    # observer parameters
    h = OBSERVER_H
    az = INITIAL_AZ

    # camera parameters
    N = DISPLAY_N  
    M = DISPLAY_M
    f = DISPLAY_F
    pixel_size = DISPLAY_PIXEL_SIZE
    alpha = INITIAL_ALPHA
    #alpha=0
    radial_display=DISPLAY_RADIAL
    
    def _invalidate_for(self, field: str):
        for name, desc in type(self).__dict__.items():
            if getattr(desc, "_depends_on", None) and field in desc._depends_on:
                self.__dict__.pop(name, None)

    def __setattr__(self, name, value):
        old = getattr(self, name, object())
        object.__setattr__(self, name, value)
        if value != old:
            self._invalidate_for(name)

    @property
    def image_width(self):
        return 2*self.N+1
    
    @property
    def image_height(self):
        return 2*self.M+1
    
    @depends_on('M', 'N')
    def ij(self):
        i, j = np.meshgrid(np.arange(self.image_width), 
                           np.arange(self.image_height))
        # central pixel has coordinates (0,0)
        i -= self.N
        j -= self.M
        # the i-axis points to the right, and the j-axis points upward
        j *= -1
        return (i, j)
       
    @property
    def i(self):
        return self.ij[0]

    @property
    def j(self):
        return self.ij[1]
    
    """
    pixel i-coordinate in meters
    """
    @depends_on('f', 'M', 'N', 'pixel_size')
    def im(self):
        if self.radial_display:
            return self.f*np.tan(self.i*self.pixel_alpha_h)
        else:
            return self.i*self.pixel_size
    
    """
    pixel j-coordinate in meters
    """
    @depends_on('f', 'M', 'N', 'pixel_size')
    def jm(self):
        if self.radial_display:
            return self.f*np.tan(self.j*self.pixel_alpha_v)
        else:
            return self.j*self.pixel_size

    """
    v=(dx,dy,dz) array of vectors from observer to pixels before azimut rotation 
    """
    @depends_on('f', 'M', 'N', 'pixel_size')
    def dx(self):
        return self.im

    @depends_on('f', 'M', 'N', 'pixel_size', 'alpha')
    def dy(self):
        return self.f*self.sin_alpha+self.jm*self.cos_alpha

    @depends_on('f', 'M', 'N', 'pixel_size', 'alpha')
    def dz(self):
        return self.f*self.cos_alpha-self.jm*self.sin_alpha

    @property
    def v(self):
        return (self.dx, self.dy, self.dz)
    
    @depends_on('f', 'M', 'N', 'pixel_size', 'alpha')
    def pixel_d(self):
        """
        Returns the Euclidean distances between the origin and all pixel
        projections on the unlifted ground.
        """
        return np.hypot(self.dx, self.dy)

    @depends_on('f', 'M', 'N', 'pixel_size', 'alpha', 'h')
    def d(self):
        """
        Returns the Euclidean distances between the origin and all viewpoints
        on the unlifted ground.
        If the ray does not intersect the ground np.inf is stored
        """
        valid = self.dz > 0
        d = np.full_like(self.dz, np.inf, dtype=float)
        # d = h * pixel_d / dz  at valid pixels
        np.divide(self.pixel_d, self.dz, out=d, where=valid)
        d *= float(self.h)
        return d    

    @depends_on('f', 'M', 'N', 'pixel_size')
    def v_length(self):
        """
        array of distances from observer to pixels
        """
        return np.hypot.reduce([self.dx, self.dy, self.dz])

    """
    nv=(ndx,ndy,ndz) array of normalized vectors from observer to pixels
    before azimut rotation 
    """
    @depends_on('f', 'M', 'N', 'pixel_size')
    def ndx(self):
        return self.dx/self.v_length

    @depends_on('f', 'M', 'N', 'pixel_size', 'alpha')
    def ndy(self):
        return self.dy/self.v_length

    @depends_on('f', 'M', 'N', 'pixel_size', 'alpha')
    def ndz(self):
        return self.dz/self.v_length

    @property
    def nv(self):
        return (self.ndx, self.ndy, self.ndz)
    
    # world parameters
    tile_sz = TILE_SZ
    world_size = WORLD_SIZE
    @property
    def tile_hsz(self):
        return self.tile_sz/2

    # --- useful values computed from the basic parameters ---
    @property
    def alpha_rad(self): 
        return math.radians(self.alpha)
    @property
    def az_rad(self):
        return math.radians(self.az)
    @property
    def cos_alpha(self):
        return math.cos(self.alpha_rad)
    @property
    def sin_alpha(self):
        return math.sin(self.alpha_rad)
    """
    half of horizontal FOV in radians
    """        
    @property
    def hfov2(self):
        return math.atan(self.N*self.pixel_size/self.f)
    """
    horizontal FOV in radians 
    """    
    @property
    def hfov(self):
        return self.hfov2*2
    """
    horizontal FOV in degrees (human eye has 120-130 degrees)
    """    
    @property
    def hfov_degrees(self):
        return math.degrees(self.hfov)
    """
    half of vertical FOV in radians
    """    
    @property
    def vfov2(self):
        return math.atan(self.M*self.pixel_size/self.f)
    """
    vertical FOV in radians
    """    
    @property
    def vfov(self):
        return self.vfov2*2
    """
    vertical FOV in degrees (human eye has 120-130 degrees)
    """    
    @property
    def vfov_degrees(self):
        return math.degrees(self.vfov)
    @property
    def pixel_alpha_v(self):
        return self.vfov2/self.M
    @property
    def pixel_alpha_h(self):
        return self.hfov2/self.N
    @property
    def cos_az(self):
        return math.cos(self.az_rad)
    @property
    def sin_az(self):
        return math.sin(self.az_rad)
    # half size of the display world axis aligned bounding box in meters
    @property
    def dsp_hdx(self):
        return self.N * self.pixel_size
    @property
    def dsp_hdy(self):
        return self.M * self.pixel_size * self.cos_alpha
    @property
    def dsp_hdz(self):
        return self.M * self.pixel_size * self.sin_alpha

    # display center and corners in world coordinates before rotation
    @property
    def dsp_0(self):
        return np.array((0.0,
                         self.f * self.sin_alpha,
                         self.h - self.f * self.cos_alpha))
    @property
    def dsp_lt(self):
        return self.dsp_0 + (-self.dsp_hdx,  self.dsp_hdy,  self.dsp_hdz)
    @property
    def dsp_rt(self):
        return self.dsp_0 + ( self.dsp_hdx,  self.dsp_hdy,  self.dsp_hdz)
    @property
    def dsp_lb(self):
        return self.dsp_0 + (-self.dsp_hdx, -self.dsp_hdy, -self.dsp_hdz)
    @property
    def dsp_rb(self):
        return self.dsp_0 + ( self.dsp_hdx, -self.dsp_hdy, -self.dsp_hdz)

    # the distance between the origin and the point the observer is looking at
    @property
    def view_dist(self):
        return self.h*self.dsp_0[1]/(self.h-self.dsp_0[2])

    # --- parameters related to sideview and topview ---
    # border for ploting views (top view and side view)
    border_size = BORDER_SIZE

    # ranges for plotting
    @property
    def x_range(self):
        return (-self.world_size-self.border_size, 
                self.world_size+self.border_size)
    @property
    def y_range(self):
        return (-self.border_size, self.world_size + self.border_size)
    @property
    def z_range(self):
        return (-self.border_size, max(self.world_size * 0.8 + self.border_size, self.h + self.border_size))
    
    # --- plotting related values
    # 1D arrays of chessboard center lines in the considered range
    @property
    def x_tiles(self):
        return np.arange(self.x_range[0] - self.x_range[0] % self.tile_sz, 
                         self.x_range[1] + self.tile_sz, self.tile_sz)
    @property
    def y_tiles(self):
        y_start = self.y_range[0]
        y_end = self.world_size * 1.5
        return np.arange(y_start - y_start % self.tile_sz,
                         y_end + self.tile_sz, self.tile_sz)

    @depends_on('tile_sz', 'world_size', 'border_size')
    def ground(self):
        return (self.y_tiles - self.y_tiles[0]) - self.tile_hsz
       
    def side_view_angle(self):
        observer = (0, self.h)
        p1x, p1y = point_at_ground(observer, self.dsp_lt[1:], self.y_range, self.z_range)
        p2x, p2y = point_at_ground(observer, self.dsp_lb[1:], self.y_range, self.z_range)
        return (p1x, 0, p2x), (p1y, self.h, p2y)
    
    def side_view_axis(self):
        observer = (0, self.h)
        px, py = point_at_ground(observer, self.dsp_0[1:], self.y_range, self.z_range)
        return (0, px), (self.h, py)
    
    def welcome_msg(self):
        msg = (
                "Welcome in Tsunami world!\n"
                "-------------------------\n"
                f"World size : {self.world_size}m\n"
                f"Observer h : {self.h}m\n"
                f"Camera VFOV: {self.vfov_degrees:.1f}\n"
                f"Camera HFOV: {self.hfov_degrees:.1f}\n"
              )
        print(msg)

def dist_field_fixed_conics_tsunami():
    """
    Spread the 1-D tsunami distances along the conics of the original
    untransformed camera view.

    The shapes of the distance contours remain fixed; only their distance
    labels change according to the 1-D tsunami profile.
    """
    theta_lut, s_lut = tsunami.build_lut_theta(w.h)
    d = np.interp(np.arctan2(w.pixel_d, w.dz), theta_lut, s_lut)
    return d*w.pixel_d/w.dy


    theta_lut, distance_lut = tsunami.build_lut_theta(w.h)

    theta_lut = np.asarray(theta_lut, dtype=float)
    distance_lut = np.asarray(distance_lut, dtype=float)

    valid = np.isfinite(theta_lut) & np.isfinite(distance_lut)
    theta_lut = theta_lut[valid]
    distance_lut = distance_lut[valid]

    order = np.argsort(theta_lut)
    theta_lut = theta_lut[order]
    distance_lut = distance_lut[order]

    theta_lut, unique_indices = np.unique(
        theta_lut,
        return_index=True,
    )
    distance_lut = distance_lut[unique_indices]

    # Angular coordinate of every pixel in the current camera.
    # Constant values form the original flat-view conics.
    theta = np.arctan2(w.pixel_d, w.dz)

    d = np.interp(
        theta,
        theta_lut,
        distance_lut,
        left=np.inf,
        right=np.inf,
    )

    return d


def dist_field_radial_tsunami(theta_lut = None, s_lut = None):
    """
    Returns the distance between the origin and the viewpoint on the lifted
    ground. 
    outputs: d
    if the ray does not intersect the ground the value will be np.inf
    """
    if theta_lut is None or s_lut is None:
        theta_lut, s_lut = tsunami.build_lut_theta(w.h)
    d = np.interp(np.arctan2(w.pixel_d, w.dz), theta_lut, s_lut)
    return d

def dist_field_directional_tsunami(theta_lut = None, s_lut = None):
    """
    Returns distance field d for directional tsunami.

    Tsunami depends only on the forward direction, so we compute one value
    per image row and broadcast it to all columns.
    """
    if theta_lut is None or s_lut is None:
        theta_lut, s_lut = tsunami.build_lut_theta(w.h)

    # angle in the vertical forward plane; one value per row is enough
    angles = np.arctan2(w.dy[:, 0], w.dz[:, 0])

    forward_d = np.interp(angles, theta_lut, s_lut)

    # convert forward distance to radial top-view distance used by
    # render_cv_arrays_from_d()
    scale = np.divide(
        forward_d[:, None],
        w.dy,
        out=np.full_like(w.dy, np.nan, dtype=float),
        where=(w.dy != 0)
    )

    d = w.pixel_d * scale
    d[~np.isfinite(d)] = np.inf

    return d


def mix_dist_fields(d_dir, d_rad, mix: float):
    """Safely mix directional and radial distance fields."""
    valid_dir = np.isfinite(d_dir) & (d_dir > 0)
    valid_rad = np.isfinite(d_rad) & (d_rad > 0)

    result = np.full_like(d_dir, np.inf, dtype=float)

    both = valid_dir & valid_rad

    result[both] = 1.0 / (
        (1.0 - mix) / d_dir[both]
        + mix / d_rad[both]
    )

    result[valid_dir & ~valid_rad] = d_dir[valid_dir & ~valid_rad]
    result[valid_rad & ~valid_dir] = d_rad[valid_rad & ~valid_dir]

    return result
    
    d = np.full_like(d_dir, np.inf, dtype=float)

    valid = np.isfinite(d_dir) & np.isfinite(d_rad)
    d[valid] = (1.0 - mix) * d_dir[valid] + mix * d_rad[valid]

    return d


def world_boundary_rows(d):
    """
    For each image column, find the row where d crosses world_size.
    Returns one row index per column, nan if no crossing exists.
    """
    inside = d <= w.world_size
    rows = np.full(d.shape[1], np.nan, dtype=float)

    for col in range(d.shape[1]):
        idx = np.where(inside[:, col])[0]
        if len(idx) > 0:
            rows[col] = idx[0]   # topmost visible inside-world pixel

    return rows


def boundary_roughness(d):
    rows = world_boundary_rows(d)
    valid = np.isfinite(rows)

    if np.count_nonzero(valid) < 5:
        return np.inf

    r = rows[valid]

    # odstraníme celkový sklon/parabolický trend, hodnotíme jen zvlnění
    x = np.arange(len(r))
    coeff = np.polyfit(x, r, deg=2)
    trend = np.polyval(coeff, x)

    residual = r - trend
    return np.sqrt(np.mean(residual**2))


def find_best_mix_fast(d_dir, d_rad, n: int = 81):
    """
    Find best mix without recomputing the tsunami LUT for every mix.
    This is still a search, but the expensive part is computed only once.
    """
    mixes = np.linspace(0.0, 1.0, n)
    best_mix = 0.0
    best_score = np.inf

    for mix in mixes:
        d = mix_dist_fields(d_dir, d_rad, mix)
        score = boundary_roughness(d)

        if score < best_score:
            best_score = score
            best_mix = mix

    return best_mix, best_score


def dist_field_mixed_tsunami(mix: float | None = None):
    theta_lut, s_lut = tsunami.build_lut_theta(w.h)

    d_dir = dist_field_directional_tsunami(theta_lut, s_lut)
    d_rad = dist_field_radial_tsunami(theta_lut, s_lut)

    if not mix:
        mix, score = find_best_mix_fast(d_dir, d_rad)
        # print(f"best mix = {mix:.3f}, score = {score:.3f}")

    return mix_dist_fields(d_dir, d_rad, mix)


def distance_conic_rows(
    distance: float,
    source_y: float,
    virtual_alpha: float,
) -> np.ndarray:
    """
    Return detector-plane y coordinates of the conic corresponding to
    `distance`.

    The selected branch is the one passing through (x=0, y=source_y).
    """
    x = w.im[0, :]  # horizontal detector coordinates

    sin_a = np.sin(virtual_alpha)
    cos_a = np.cos(virtual_alpha)

    h = float(w.h)
    f = float(w.f)
    d = float(distance)

    A = h*h*cos_a*cos_a - d*d*sin_a*sin_a
    B = 2.0*f*sin_a*cos_a*(h*h + d*d)
    C = (
        h*h*x*x
        + f*f*(h*h*sin_a*sin_a - d*d*cos_a*cos_a)
    )

    if np.isclose(A, 0.0):
        y = np.full_like(x, np.nan, dtype=float)
        valid = ~np.isclose(B, 0.0)
        y[valid] = -C[valid] / B
        return y

    discriminant = B*B - 4.0*A*C

    y1 = np.full_like(x, np.nan, dtype=float)
    y2 = np.full_like(x, np.nan, dtype=float)

    valid = discriminant >= 0.0
    sqrt_disc = np.sqrt(np.maximum(discriminant, 0.0))

    y1[valid] = (-B + sqrt_disc[valid]) / (2.0*A)
    y2[valid] = (-B - sqrt_disc[valid]) / (2.0*A)

    # At the centre column, choose the root passing through source_y.
    centre = w.N
    use_first = abs(y1[centre] - source_y) <= abs(y2[centre] - source_y)

    return y1 if use_first else y2


def centre_column_tsunami_distances():
    theta_lut, s_lut = tsunami.build_lut_theta(w.h)

    centre = w.N
    theta = np.arctan2(
        w.pixel_d[:, centre],
        w.dz[:, centre],
    )

    return np.interp(
        theta,
        theta_lut,
        s_lut,
        left=np.nan,
        right=np.nan,
    )


def dist_field_balanced_tsunami(
    profile_samples: int = 800,
    centre_scan_samples: int = 240,
    bisection_steps: int = 20,
    newton_steps: int = 10,
    profile_limit: float | None = None,
):
    """
    Balanced distance field using branch continuation from the centre column.

    The centre column is solved by a global scan. For every following column,
    the root is searched only near the root in the preceding column. This
    follows one continuous branch and avoids jumps between multiple roots.

    Only the right half of the image is computed. The left half is obtained
    by symmetry.
    """
    if np.isclose(tsunami.p, 0):
        return np.asarray(w.d, dtype=float).copy()

    if profile_limit is None:
        profile_limit = max(
            6.0 * float(w.world_size),
            float(np.max(w.ground)),
        )

    s_profile = np.linspace(0.0, profile_limit, profile_samples)
    theta_profile = np.full_like(s_profile, np.nan, dtype=float)

    for k, s in enumerate(s_profile):
        x_t, z_t = tsunami.d_to_xy(float(s))
        if np.isfinite(x_t) and np.isfinite(z_t):
            theta_profile[k] = np.arctan2(
                float(x_t),
                float(w.h) - float(z_t),
            )

    valid_profile = np.isfinite(theta_profile)
    s_profile = s_profile[valid_profile]
    theta_profile = theta_profile[valid_profile]

    if len(s_profile) < 2:
        return np.full_like(w.d, np.inf, dtype=float)

    detector_y = np.asarray(w.jm[:, 0], dtype=float)
    detector_x = np.asarray(w.dx[0, :], dtype=float)

    def equation(distance, col):
        distance = np.asarray(distance, dtype=float)

        theta_flat = np.arctan2(distance, float(w.h))
        theta_tsunami = np.interp(
            distance,
            s_profile,
            theta_profile,
            left=theta_profile[0],
            right=theta_profile[-1],
        )

        alpha_virtual = (
            w.alpha_rad
            + theta_flat
            - theta_tsunami
        )

        sin_a = np.sin(alpha_virtual)
        cos_a = np.cos(alpha_virtual)

        ray_forward = w.f * sin_a + detector_y * cos_a
        ray_down = w.f * cos_a - detector_y * sin_a

        theta_pixel = np.arctan2(
            np.hypot(detector_x[col], ray_forward),
            ray_down,
        )

        return theta_pixel - theta_flat

    rows = w.image_height
    centre = w.N
    result = np.full((rows, w.image_width), np.inf, dtype=float)

    scan_d = np.linspace(0.0, profile_limit, centre_scan_samples)

    found = np.zeros(rows, dtype=bool)
    lo = np.zeros(rows, dtype=float)
    hi = np.zeros(rows, dtype=float)
    f_lo = np.zeros(rows, dtype=float)

    d_prev = scan_d[0]
    f_prev = equation(d_prev, centre)

    for d_curr in scan_d[1:]:
        f_curr = equation(d_curr, centre)

        crossing = (
            ~found
            & np.isfinite(f_prev)
            & np.isfinite(f_curr)
            & (
                np.isclose(f_prev, 0.0, atol=1e-10)
                | np.isclose(f_curr, 0.0, atol=1e-10)
                | (np.signbit(f_prev) != np.signbit(f_curr))
            )
        )

        lo[crossing] = d_prev
        hi[crossing] = d_curr
        f_lo[crossing] = f_prev[crossing]
        found[crossing] = True

        d_prev = d_curr
        f_prev = f_curr

    for _ in range(bisection_steps):
        mid = 0.5 * (lo + hi)
        f_mid = equation(mid, centre)

        same_side = np.signbit(f_mid) == np.signbit(f_lo)
        move_lo = found & same_side
        move_hi = found & ~same_side

        lo[move_lo] = mid[move_lo]
        f_lo[move_lo] = f_mid[move_lo]
        hi[move_hi] = mid[move_hi]

    result[found, centre] = 0.5 * (lo[found] + hi[found])

    base_width = profile_limit / max(centre_scan_samples - 1, 1)

    for col in range(centre + 1, w.image_width):
        previous = result[:, col - 1]
        active = np.isfinite(previous)

        if not np.any(active):
            break

        root = previous.copy()

        for _ in range(newton_steps):
            f = equation(root, col)

            eps = np.maximum(1e-3, 1e-4 * (1.0 + root))
            d_minus = np.maximum(0.0, root - eps)
            d_plus = np.minimum(profile_limit, root + eps)

            f_minus = equation(d_minus, col)
            f_plus = equation(d_plus, col)

            derivative = np.divide(
                f_plus - f_minus,
                d_plus - d_minus,
                out=np.full_like(root, np.nan),
                where=(d_plus > d_minus),
            )

            usable = (
                active
                & np.isfinite(f)
                & np.isfinite(derivative)
                & (np.abs(derivative) > 1e-12)
            )

            step = np.zeros_like(root)
            step[usable] = f[usable] / derivative[usable]

            max_step = np.maximum(2.0 * base_width, 0.08 * (1.0 + root))
            step = np.clip(step, -max_step, max_step)

            root[usable] = np.clip(
                root[usable] - step[usable],
                0.0,
                profile_limit,
            )

        residual = np.abs(equation(root, col))
        solved = active & np.isfinite(residual) & (residual < 1e-6)

        unresolved = active & ~solved

        if np.any(unresolved):
            width = np.maximum(
                2.0 * base_width,
                0.03 * (1.0 + previous),
            )

            blo = np.maximum(0.0, previous - width)
            bhi = np.minimum(profile_limit, previous + width)
            bflo = equation(blo, col)
            bfhi = equation(bhi, col)

            bracketed = (
                unresolved
                & np.isfinite(bflo)
                & np.isfinite(bfhi)
                & (
                    np.isclose(bflo, 0.0, atol=1e-10)
                    | np.isclose(bfhi, 0.0, atol=1e-10)
                    | (np.signbit(bflo) != np.signbit(bfhi))
                )
            )

            for _ in range(7):
                need = unresolved & ~bracketed
                if not np.any(need):
                    break

                width[need] *= 1.8
                blo[need] = np.maximum(0.0, previous[need] - width[need])
                bhi[need] = np.minimum(
                    profile_limit,
                    previous[need] + width[need],
                )

                bflo = equation(blo, col)
                bfhi = equation(bhi, col)

                newly = (
                    need
                    & np.isfinite(bflo)
                    & np.isfinite(bfhi)
                    & (
                        np.isclose(bflo, 0.0, atol=1e-10)
                        | np.isclose(bfhi, 0.0, atol=1e-10)
                        | (np.signbit(bflo) != np.signbit(bfhi))
                    )
                )
                bracketed |= newly

            local_lo = blo.copy()
            local_hi = bhi.copy()
            local_flo = equation(local_lo, col)

            for _ in range(bisection_steps):
                mid = 0.5 * (local_lo + local_hi)
                fmid = equation(mid, col)

                same_side = np.signbit(fmid) == np.signbit(local_flo)
                move_lo = bracketed & same_side
                move_hi = bracketed & ~same_side

                local_lo[move_lo] = mid[move_lo]
                local_flo[move_lo] = fmid[move_lo]
                local_hi[move_hi] = mid[move_hi]

            root[bracketed] = 0.5 * (
                local_lo[bracketed] + local_hi[bracketed]
            )
            solved |= bracketed

        result[solved, col] = root[solved]

        mirror_col = 2 * centre - col
        if mirror_col >= 0:
            result[:, mirror_col] = result[:, col]

    return result

def create_one_leading_zero(lst):
    i = 0
    while i < len(lst) and np.isclose(lst[i], 0):
        i += 1
    return [0] + lst[i:]

w = TsunamiWorld()
w.welcome_msg()

# --- tsunami parameters ---
tsunami = None
match AVAILABLE_METHODS.get(SELECTED_METHOD).get("tsunami_fun"):
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

METHOD_FUNCS = {
    "radial": dist_field_radial_tsunami,
    "directional": dist_field_directional_tsunami,
    "mixed": lambda x = MIX: dist_field_mixed_tsunami(x),
    "mixed (auto)": dist_field_mixed_tsunami,
    # "balanced": dist_field_balanced_tsunami,
}

current_method_name = AVAILABLE_METHODS.get(SELECTED_METHOD).get("method")
if current_method_name not in METHOD_FUNCS:
    raise ValueError("Unsupported method selected.")
method = METHOD_FUNCS[current_method_name]


def set_method(method_name: str):
    """Switch only the distance-field method, keeping the same tsunami object."""
    global current_method_name, method
    if method_name not in METHOD_FUNCS:
        raise ValueError(f"Unsupported method selected: {method_name}")
    current_method_name = method_name
    method = METHOD_FUNCS[method_name]


def method_label():
    return current_method_name


elevations = ELEVATIONS
num_elevations = len(elevations)

tsunami_idx = INITIAL_ELEVATION_IDX

print(f"Method     : {tsunami.name} ({method_label()})\n")

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
    if SIDE_TBOUNDS_STYLE:
        v1 = (w.dsp_lt[1], w.dsp_lt[2]-w.h) 
        t1 = tsunami.t_seen_in_direction(v1, w.h)
        #print(f"Arclength for t1 = {tsunami.arc_length(t1)}")
        x1, y1 = tsunami.t_to_xy(t1)
        sv_vtp1_data, = ax.plot(x1, y1, **SIDE_TBOUNDS_STYLE)
        
        v2 = (w.dsp_lb[1], w.dsp_lb[2]-w.h)
        t2 = tsunami.t_seen_in_direction(v2, w.h)
        #print(f"Arclength for t2 = {tsunami.arc_length(t2)}")
        x2, y2 = tsunami.t_to_xy(t2)
        sv_vtp2_data, = ax.plot(x2, y2, **SIDE_TBOUNDS_STYLE)

    ax.set_xlim(w.y_range)
    ax.set_ylim(w.z_range)
    #ax.grid(True, which='both', color='gray', linestyle='--', linewidth=0.5)
    ax.set_aspect('equal')
    #plt.show()
    return sv_lg_data, sv_wp_data, sv_twp_data, sv_op_data, sv_vp_data, sv_vtp1_data, sv_vtp2_data, sv_vaxis_data, sv_vangle_data


def plot_topview(ax, fov, fov_t):
    """plots top view; returns handles (tv_fov_line, tv_fovt_line, tv_vp)"""
    ax.set_xlim(w.x_range)
    ax.set_ylim(w.y_range)
    ax.set_aspect('equal')

    # vše mimo svět modře
    world_clip = None
    if WORLD_OUTSIDE_COLOR:
        ax.add_patch(
            plt.Rectangle(
                (w.x_range[0], w.y_range[0]),
                w.x_range[1] - w.x_range[0],
                w.y_range[1] - w.y_range[0],
                color=WORLD_OUTSIDE_COLOR,
                zorder=-20
            )
        )
        world_clip = plt.Circle((0, 0), w.world_size, transform=ax.transData)
        ax.add_patch(plt.Circle((0, 0), w.world_size, color="white", zorder=-19)
    )

    # chessboard
    for i, x in enumerate(w.x_tiles):
        for j, y in enumerate(w.y_tiles):
            if (i + j) % 2 == 1:
                rect = plt.Rectangle((x-w.tile_hsz, y-w.tile_hsz),
                                    w.tile_sz, w.tile_sz,
                                    color='black', linewidth=0)
                if world_clip:
                    rect.set_clip_path(world_clip)
                    rect.set_clip_box(ax.bbox)

                ax.add_patch(rect)

    # FOV lines
    tv_fov_line, = ax.plot(fov[0], fov[1], **FOV_LINE_STYLE)

    tv_fovt_line = None
    if fov_t is not None:
        # fov_t can be tuple(x, y) or np.array((x, y))
        if isinstance(fov_t, np.ndarray):
            x_t, y_t = fov_t[0], fov_t[1]
        else:
            x_t, y_t = fov_t
        tv_fovt_line, = ax.plot(x_t, y_t, **TFOV_LINE_STYLE)

    # viewpoint
    tv_vp, = ax.plot(0, w.view_dist, **VIEWPOINT_STYLE)

    # observer
    ax.plot(0, 0, **OBSERVER_STYLE)

    # world circle
    circle = plt.Circle((0, 0), w.world_size, **WORLD_CIRCLE_STYLE)
    ax.add_patch(circle)

    return tv_fov_line, tv_fovt_line, tv_vp
    #plt.show()


def compute_fov(rx, ry, valid):
    """
    finds horizont line in valid and returns FOV polyline from rotated x,y
    """
    horizont = np.argmax(valid[:, 1])  # Najde první True v 1. sloupci
    #print(f"{horizont=}")
    return (np.concatenate([rx[horizont, :], rx[horizont:-1,-1], 
                            rx[-1,::-1], rx[-1:horizont-1 if horizont > 0 else 0:-1,0]]),
            np.concatenate([ry[horizont, :], ry[horizont:-1,-1], 
                            ry[-1,::-1], ry[-1:horizont-1 if horizont > 0 else 0:-1,0]]))


def show_contours(d):
    valid = np.isfinite(d)

    d_plot = np.array(d, dtype=float, copy=True)
    d_plot[~valid] = np.nan

    contour_fig, contour_ax = plt.subplots()

    cs = contour_ax.contour(
        d_plot,
        levels=np.arange(0, w.world_size + 1, 20),
    )
    contour_ax.invert_yaxis()
    contour_ax.clabel(cs, fontsize=8)
    contour_ax.set_aspect("equal")
    contour_ax.set_title("Distance field contours")

    contour_fig.tight_layout()
    contour_fig.show()


def render_cv_arrays_from_d(d):
    """
    Compute RGB image and FOV for a given distances from the origin. 
    Returns (img_rgb, fov).
    """
    # compute coordinates of a pixel projection onto the ground
    valid = np.isfinite(d)
    x = np.full_like(d, np.nan, dtype=float)
    y = np.full_like(d, np.nan, dtype=float)

    unit_hx = np.divide(w.dx, w.pixel_d, out=np.zeros_like(w.dx), where=(w.pixel_d!=0))
    unit_hy = np.divide(w.dy, w.pixel_d, out=np.zeros_like(w.dy), where=(w.pixel_d!=0))

    x[valid] = unit_hx[valid] * d[valid]
    y[valid] = unit_hy[valid] * d[valid]
   

    # plt.contour(x, y, d, levels=np.arange(0, w.world_size + 1, 20))
    # plt.gca().set_aspect("equal")
    # plt.show()

    # rotate the ground
    rx =  w.cos_az*x + w.sin_az*y
    ry = -w.sin_az*x + w.cos_az*y 

    # compute a tile index
    ti = np.round(rx/w.tile_sz)
    tj = np.round(ry/w.tile_sz)

    # create chessboard pattern on the tiles
    grid = ((ti % 2 + tj % 2) % 2)*WHITE

    # make all pixels that captures more tiles GRAY
    ry1 = np.vstack([ry[0], ry[:-1]])
    mask = ry1 - ry > w.tile_sz
    grid[mask]=GRAY

    dx = np.zeros_like(ti)
    dx[:,1:] = abs(ti[:,1:] - ti[:,:-1])
    grid[dx != 0]=BLACK

    # create rgb image
    img_rgb = np.stack((grid,)*3, axis=-1)/255.0

    # render outside the world
    if WORLD_OUTSIDE_COLOR:
        img_rgb[d>w.world_size] = WORLD_OUTSIDE_COLOR

    # render world line
    d1 = np.vstack([d[0], d[:-1]])
    wline = (d<=w.world_size)&(d1>w.world_size)
    structure = np.array([[0, 1, 0],[1, 1, 1],[0, 1, 0]], dtype=bool)
    wline = binary_dilation(wline, structure=structure)
    img_rgb[wline]=WORLD_END_COLOR

    # render display center
    c_radius2 = 5**2 
    center = (w.i**2<c_radius2)&(w.j**2<c_radius2)
    img_rgb[center]=CENTER_COLOR

    # show pixels seeing infinity
    img_rgb[~valid]=WORLD_INF_COLOR

    fov = compute_fov(rx, ry, valid)
    return img_rgb, fov


def render_camera_view_arrays(t):
    """Compute RGB image and FOV for a given scaling field t. Returns (img_rgb, fov)."""
    # compute coordinates of a pixel projection onto the ground
    valid = np.isfinite(t)
    x = np.full_like(t, np.nan, dtype=float)
    y = np.full_like(t, np.nan, dtype=float)
    
    x[valid] = w.dx[valid] * t[valid]
    y[valid] = w.dy[valid] * t[valid]
    #print(f"y-interval: [{y[-1,w.N]}, {y[0,w.N]}], [{y[-1,w.N]/w.tile_sz}, {y[0,w.N]/w.tile_sz}]")

    # rotate the ground
    rx =  w.cos_az*x + w.sin_az*y
    ry = -w.sin_az*x + w.cos_az*y 

    # compute a tile index
    ti = np.round(rx/w.tile_sz)
    tj = np.round(ry/w.tile_sz)

    # take only pixel projections in the direction of camera
    valid = np.isfinite(t)

    # create chessboard pattern on the tiles
    grid = ((ti % 2 + tj % 2) % 2)*WHITE

    # make all pixels that captures more tiles GRAY
    ry1 = np.vstack([ry[0], ry[:-1]])
    mask = ry1 - ry > w.tile_sz
    grid[mask]=GRAY

    dx = np.zeros_like(ti)
    dx[:,1:] = abs(ti[:,1:] - ti[:,:-1])
    grid[dx != 0]=BLACK

    # create rgb image
    img_rgb = np.stack((grid,)*3, axis=-1)/255.0

    dst = ry**2+rx**2
    dst1 = np.vstack([dst[0], dst[:-1]])
    world_size2=w.world_size**2
    wline = (dst<=world_size2)&(dst1>world_size2)
    c_radius2 = 5**2 
    center = (w.i**2<c_radius2)&(w.j**2<c_radius2)
    structure = np.array([[0, 1, 0],[1, 1, 1],[0, 1, 0]], dtype=bool)
    wline = binary_dilation(wline, structure=structure)

    img_rgb[wline]=WORLD_END_COLOR
    img_rgb[~valid]=WORLD_INF_COLOR
    img_rgb[center]=CENTER_COLOR

    fov = compute_fov(rx, ry, valid)
    return img_rgb, fov

def plot_camera_view(ax, d):
    """Renders camera view for scaling field t. Returns (im_handle, fov)."""
    img_rgb, fov = render_cv_arrays_from_d(d)

    im = ax.imshow(img_rgb, cmap='gray', aspect='equal')
    ax.set_aspect('equal')
    ax.axis('off')
    return im, fov

# 
# outputs: x,y
# scaling factor to reach the ground from a pixel on j-th row
fig, axs = plt.subplots(2, 2)
plt.subplots_adjust(left=0.1, right=0.9, bottom=0.3, top=0.9, wspace=0.2, hspace=0.2)

# --- axis for horizontal sliders ---
ax_alpha = fig.add_axes([0.10, 0.14, 0.65, 0.03])
ax_az   = fig.add_axes([0.10, 0.10, 0.65, 0.03])
ax_tsunami_p = fig.add_axes([0.10, 0.06, 0.65, 0.03])
ax_h   = fig.add_axes([0.1, 0.02, 0.65, 0.03])
ax_method = fig.add_axes([0.8, 0.01, 0.18, 0.19])
# --- sliders ---
s_alpha = Slider(ax_alpha, "alpha", ALPHA_FROM, ALPHA_TO,  valinit=w.alpha,  valstep=(ALPHA_TO-ALPHA_FROM)/ALPHA_NUM_STEPS)
s_az   = Slider(ax_az,   "azimuth",  AZ_FROM, AZ_TO, valinit=w.az, valstep=AZ_STEP)
s_tsunami_p = Slider(ax_tsunami_p, "Tsunami p", 0, len(tsunami_params)-1, valinit=tsunami_idx, valstep=1)
s_h = Slider(ax_h, "h", H_FROM, H_TO, valinit=w.h, valstep=H_STEP)

method_choices = list(METHOD_FUNCS.keys())
radio_method = RadioButtons(
    ax_method,
    method_choices,
    active=method_choices.index(current_method_name),
)
ax_method.set_title("method", fontsize=9)

def update(_):
    # push slider values into model
    w.alpha = s_alpha.val
    w.az = s_az.val
    w.h = s_h.val
    idx = int(s_tsunami_p.val)


    # tsunami params and sideview ground
    tsunami.lift(tsunami_params[idx])
    x, y = tsunami.uplift_ground(w.ground)

    # print(f"Updating {w.alpha=}, {w.az=}, {w.h=}, p={tsunami_params[idx]}")
    # theta_lut, s_lut = tsunami.build_lut_theta(w.h)
    
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

    # --- camera views ---
    #print("Camera view")
    
    img_plain, fov_plain = render_cv_arrays_from_d(w.d)
    cv_im.set_data(img_plain)

    #print("Camera view - tsunami")
    img_tsu, fov_tsu = render_cv_arrays_from_d(method())

    cv_t_im.set_data(img_tsu)
    fig._suptitle.set_text(f"{tsunami.name} ({method_label()})")

    # --- top view ---
    tv_fov_line.set_data(fov_plain[0], fov_plain[1])
    if tv_fovt_line is not None:
        tv_fovt_line.set_data(fov_tsu[0], fov_tsu[1])
    tv_vp.set_data((0,), (w.view_dist,))

    fig.canvas.draw_idle()

# všechny slidery napojíme na stejný update
for s in (s_alpha, s_az, s_tsunami_p, s_h):
    s.on_changed(update)


def update_method(label):
    set_method(label)
    update(None)


radio_method.on_clicked(update_method)

mng = plt.get_current_fig_manager()
mng.full_screen_toggle()


sv_lg_data, sv_wp_data, sv_twp_data, sv_op_data, sv_vp_data, sv_vtp1_data, sv_vtp2_data, sv_vaxis_data, sv_vangle_data = plot_sideview(axs[1,0])
cv_im, fov = plot_camera_view(axs[0,0], w.d)
cv_t_im, fov_t = plot_camera_view(axs[0,1], method())

tv_fov_line, tv_fovt_line, tv_vp = plot_topview(axs[1,1], fov, fov_t)


def save_axis_region(ax, filename):
    """
    Save only the rectangular region occupied by one Axes.

    This keeps the current interactive state of the displayed figure, including
    slider changes. The function saves exactly what is visible in the selected
    panel.
    """
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    bbox = ax.get_tightbbox(renderer)
    bbox = bbox.transformed(fig.dpi_scale_trans.inverted())
    fig.savefig(filename, bbox_inches=bbox)


def save_all_panels(event):
    """
    Press 'p' to save all four displayed panels as PDF, SVG and PNG.
    """
    if event.key is None or event.key.lower() != "p":
        return

    output_dir = Path("saved_panels")
    output_dir.mkdir(exist_ok=True)

    method_label_value = method_label()
    base = (
        f"{tsunami.name}_{method_label_value}"
        f"_alpha{w.alpha:.1f}"
        f"_az{w.az:.0f}"
        f"_h{w.h:.0f}"
        f"_level{int(s_tsunami_p.val):02d}"
    )
    base = base.replace(".", "p")

    panels = [
        (axs[0, 0], "camera_original"),
        (axs[0, 1], "camera_tsunami"),
        (axs[1, 0], "side_view"),
        (axs[1, 1], "top_view"),
    ]

    for ax, panel_name in panels:
        stem = output_dir / f"{base}_{panel_name}"
        save_axis_region(ax, stem.with_suffix(".pdf"))
        save_axis_region(ax, stem.with_suffix(".svg"))
        save_axis_region(ax, stem.with_suffix(".png"))

    print(f"Saved panels to {output_dir.resolve()}")

def show_contours_on_key(event):
    if event.key is None or event.key.lower() != "c":
        return
    d = method()
    show_contours(d)


fig.suptitle(f"{tsunami.name} ({method_label()})", fontsize=16, y=0.98)
fig.canvas.mpl_connect("key_press_event", save_all_panels)
fig.canvas.mpl_connect("key_press_event", show_contours_on_key)
plt.show()