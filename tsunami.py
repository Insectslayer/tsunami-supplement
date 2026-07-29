# -*- coding: utf-8 -*-
"""
Created on Mon Mar 24 10:57:42 2025

Package of Tsunami functions

@author: pam
"""
from typing import Any, List, Sequence, Tuple, Callable
from abc import ABC, abstractmethod

import math
import numpy as np
import trimesh
import trimesh.transformations as tf
# import pyrender
import matplotlib.pyplot as plt
from scipy.optimize import fsolve
from scipy.optimize import bisect
from scipy.integrate import cumulative_trapezoid
from scipy.interpolate import interp1d
from typing import cast
from scipy.integrate import quad

"""
----------------------------------------------------------------
    Functions generating 3D model of a city
----------------------------------------------------------------
"""


def create_cuboidal_town(size: int,
                         sw: int,
                         bw: int,
                         min_h: int,
                         max_h: int) -> trimesh.Scene:
    """
    Creates a circular city of cuboidal buildings using trimesh.

    :param size: radius of the city (number of buildings)
    :param sw: street width
    :param bw: building width
    :param min_h: minimal building height
    :param max_h: maximal builbing height
    :return: trimesh.Scene representing a town
    """
    buildings = []

    field_size = sw + bw

    for i in range(-size, size+1):
        for j in range(-size, size+1):
            if i*i + j*j <= size*size:
                bh = np.random.uniform(min_h, max_h)

                # a center of a building on the grid
                x = i * field_size
                y = j * field_size
                z = bh / 2  # buildings will stay on the ground (bottom z = 0)

                # create a building if it is in the circle
                b = trimesh.creation.box(extents=[bw, bw, bh])
                b.apply_translation([x, y, z])

                buildings.append(b)

    return trimesh.Scene(buildings)


"""
----------------------------------------------------------------
    Functions generating 2D model of a city - obsolete functions
----------------------------------------------------------------
"""


def generate_world_2D(world_size: int,
                      height_delta: float) -> Tuple[List[int], List[int]]:
    """
    Function taken from Matěj's js code (translated to Python)
    It returns two lists of coordinates - x and y of city polyline
    world_size is the largest x-coordinate
    height_delta measures how much the city ground increases
    """
    world_x = [0]
    world_y = [0]

    building_chance: float = 0.
    building_increment: float = 0.001
    building_height: int = 50
    building_width: int = 10

    while world_x[-1] < world_size:
        if building_chance > np.random.rand():  # ekvivalent Math.random()
            building_chance = 0
            world_x.append(world_x[-1])
            world_y.append(world_y[-1] + building_height)
            world_x.append(world_x[-1] + building_width)
            world_y.append(world_y[-1])
            world_x.append(world_x[-1])
            world_y.append(world_y[-1] - building_height)
        else:
            building_chance += building_increment

        world_x.append(world_x[-1] + 1)
        world_y.append(world_y[-1]
                       + np.round((np.random.rand()-0.45)*2*height_delta))

    return world_x, world_y


"""
---------------------------------------------------------------------
    Functions generating 2D model of a city - up-to-date functions
---------------------------------------------------------------------
"""

def generate_building_positions(world_size: int,
                                number_of_buildings: int,
                                building_width: int) -> List[float]:
    """
    generates the positions of the given number of buildings in the space
    defined by world_size. The space (interval [0,world_size]) is split into
    number_of_buildings regions and then one building is randomly built
    in each.
    """
    min_spacing: int = 2 * building_width
    interval_size: float = world_size / number_of_buildings

    if interval_size <= min_spacing:
        raise ValueError("Not enough space to place buildings with"
                         " required spacing.")

    positions: List[float] = []
    for i in range(number_of_buildings):
        interval_start: float = i * interval_size + building_width
        interval_end: float = (i + 1) * interval_size - building_width
        pos: float = np.random.uniform(interval_start, interval_end)
        positions.append(pos)

    return positions


def compute_normals(x, y):
    """Vrací jednotkové normály ke křivce zadané body (x, y)."""
    dx = np.gradient(x)
    dy = np.gradient(y)
    length = np.sqrt(dx**2 + dy**2)
    nx = -dy / length
    ny = dx / length
    return nx, ny


def arc_length_params(x, y):
    """Vrací pole obloukových délek odpovídajících bodům (x, y)."""
    dx = np.diff(x)
    dy = np.diff(y)
    ds = np.sqrt(dx**2 + dy**2)
    return np.concatenate(([0], np.cumsum(ds)))


def get_point_with_normal(cx: List[float] | np.ndarray, cy: List[float] | np.ndarray,
                          nx: List[float] | np.ndarray, ny: List[float] | np.ndarray,
                          s: List[float] | np.ndarray, index: int, t: float
                          ) -> Tuple[int, float, float, float, float]:
    """
    returns [x,y] coordinates of a point with parameter t on a curve
    cx(t), cy(t) and a unit normal vector at this point
    cx, cy: curve points
    nx, ny: precomputed curve normals
    s: curve parametrization
    index: index where to start the search
    t: point parameter

    returns
    new_i: index of the immediate point before t-point
    px, py point coordinate
    nx, ny unit normal
    """
    # print(s)
    # print(f"{index=}")
    assert s[index] < t
    # find the interval that contains t
    i = index
    while s[i] < t:
        i += 1
        if i == len(s):
            print("No more points on the curve.")
            return (i, 0, 0, 0, 0)  # no more points on the curve

    s0, s1 = s[i-1], s[i]
    assert s0 < t and s1 >= t and s1 > s0
    # position of t in the interval
    alpha = (t - s0) / (s1 - s0)

    # compute point using linear interpolation
    px = (1-alpha)*cx[i-1] + alpha*cx[i]
    py = (1-alpha)*cy[i-1] + alpha*cy[i]

    # compute unit normal using linear interpolation
    nnx = (1-alpha)*nx[i-1] + alpha*nx[i]
    nny = (1-alpha)*ny[i-1] + alpha*ny[i]
    norm = np.sqrt(nnx**2 + nny**2)
    nnx /= norm
    nny /= norm

    return (i-1, px, py, nnx, nny)


def append_points(x_out, y_out, gx, gy, i_from, i_to):
    """
    append all points having i_from to i_to in gx a gy lists at the end of
    x_out and y_out
    """
    for i in range(i_from, i_to):
        x_out.append(gx[i])
        y_out.append(gy[i])


def erect_city(gx: List[float] | np.ndarray, gy: List[float] | np.ndarray,
               buildings: List[float] | np.ndarray,
               widths: List[float] | np.ndarray,
               heights: List[float] | np.ndarray, s: List[float] | np.ndarray
               ) -> Tuple[np.ndarray, np.ndarray]:
    """
    Returns the city polyline (x and y coordinates separately) erected
    on the ground defined by the lists of coordinates gx, gy.
    The position of the buildings is given by the left corner in
    the list 'buildings'.
    widths and heights of buildings.
    s is the curve parametrization
    """
    nx, ny = compute_normals(gx, gy)

    x_out = []
    y_out = []

    i = 0  # index of the discrete lists
    x_out.append(gx[0])
    y_out.append(gy[0])
    for b_i, b in enumerate(buildings):
        new_i, px, py, nnx, nny = \
            get_point_with_normal(gx, gy, nx, ny, s, i, b)
        append_points(x_out, y_out, gx, gy, i+1, new_i)
        if new_i == len(s):
            break  # the end of the curve, no other building can be erected

        new_i2, px2, py2, nnx2, nny2 =\
            get_point_with_normal(gx, gy, nx, ny, s, new_i, b+widths[b_i])
        if new_i2 == len(s):
            # append_points(x_out, y_out, gx, gy, new_i+1, new_i2)
            break  # the end of the curve, the building cannot be completed

        # Point before the building
        # x_out.append(gx[new_i])
        # y_out.append(gy[new_i])
        # left bottom
        x_out.append(px)
        y_out.append(py)
        h = heights[b_i]
        # Top left
        x_out.append(px + h * nnx)
        y_out.append(py + h * nny)
        # Top right
        x_out.append(px2 + h * nnx2)
        y_out.append(py2 + h * nny2)
        # Bottom right
        x_out.append(px2)
        y_out.append(py2)

        i = new_i2

    # Append the end of the curve
    append_points(x_out, y_out, gx, gy, i+1, len(s))

    return np.array(x_out), np.array(y_out)


###########################################
# Transformation Functions in the Space
###########################################

def camera_pose(h, az, el):
    """
    Computes camera transformation matrix. Camera is placed at height h in
    the city center (0,0)
    and is rotated as given by azimuth `az` and elevation `el` in degrees
    (values az=0 and el=0 look at the point (0,0,0))
    """
    translation_matrix = tf.translation_matrix([0, 0, h])
    rotation_matrix = tf.euler_matrix(np.radians(el), np.radians(az),
                                      0, 'sxzy')
    return tf.concatenate_matrices(translation_matrix, rotation_matrix)


def uplift_3D(point: Tuple[float, float, float],
              tfun: Callable[[float, float], Tuple[float, float]]
              ) -> Tuple[float, float, float]:
    """
    Transforms 3D-point using tfun Tsunami procedure radially.
    """
    x, y, h = point
    az = math.atan2(y, x)
    s = math.sqrt(x*x+y*y)
    s, h = tfun(s, h)

    return s*np.cos(az), s*np.sin(az), h


def uplift_3D_direction(point: Tuple[float, float, float],
                        tfun: Callable[[float, float], Tuple[float, float]],
                        vec: Tuple[float, float]
                        ) -> Tuple[float, float, float]:
    """
    Transforms 3D-point using tfun Tsunami procedure in the direction vec.
    """
    x, y, h = point
    vx, vy = vec
    s = x*vx+y*vy
    if s <= 0:
        return x, y, h
    # else:
    #     return x,y,h

    sT, hT = tfun(s, h)
    ux, uy = x-s*x*vx, y-s*y*vy

    return sT*vx+ux, sT*vy+uy, hT


def uplift_2D(s: float, h: float, foo: Callable[[float], Tuple[float, float]],
              foo_normal: Callable[[float], Tuple[float, float]],
              t_of_s: Callable[[float], float]) -> Tuple[float, float]:
    t = t_of_s(s)
    px, py = foo(t)
    nx, ny = foo_normal(t)
    return px+h*nx, py+h*ny


def FOV_keypoints(dx: int,
                  dy: int,
                  step: int) -> Tuple[np.ndarray, np.ndarray]:
    """
    computes coordinates of keypoints spread on the left and top edge of a FOV
    of size dx x dy with the given step.
    """
    horiz_y = np.linspace(0, dy-step, (dy-step)//step)
    horiz_x = np.full_like(horiz_y, dx)

    vert_x = np.linspace(dx, step, (dx-step)//step)
    vert_y = np.full_like(vert_x, dy)

    return np.concatenate((horiz_x, vert_x)), np.concatenate((horiz_y, vert_y))


def create_flat_ground(world_size: int,
                       num_samples: int = 50
                       ) -> Tuple[np.ndarray, np.ndarray]:
    """
    Creates a flat polyline from [0,0] to [world_size,0] with num_samples
    """
    gx = np.linspace(0, world_size, num_samples)
    gy = np.zeros_like(gx)

    return gx, gy


def calculate_angle(a: Tuple[float, float],
                    b: Tuple[float, float],
                    c: Tuple[float, float]) -> float:
    """
    Vypočítá úhel mezi třemi body v rovině: A, B, C, kde B je vrchol úhlu.
    Vrací úhel v radiánech v intervalu [0, pi].
    """
    ba = np.array([a[0] - b[0], a[1] - b[1]])
    bc = np.array([c[0] - b[0], c[1] - b[1]])

    cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
    angle = np.arccos(np.clip(cosine_angle, -1.0, 1.0))

    return angle


def find_t_for_angle(f: Callable[[float], Tuple[float, float]],
                     h: float, target_angle: float,
                     t_min: float, t_max: float, tol: float = 1e-5) -> float:
    """
    Najde hodnotu parametru t, pro kterou úhel mezi body [0,0], [0,h] a f(t)
    je roven target_angle.
    """
    def angle_difference(t):
        x, y = f(t)
        current_angle = calculate_angle((0, 0), (0, h), (x, y))
        return current_angle - target_angle

    t_solution = bisect(angle_difference, t_min, t_max, xtol=tol)
    # scipy.optimize.bisect may return a tuple (root, results) in some versions
    # ensure we return a float root
    if isinstance(t_solution, tuple):
        t_solution = t_solution[0]

    return float(t_solution)


def t_values_for_alpha(f: Callable[[float], Tuple[float, float]],
                       h: float, t_min: float, t_max: float,
                       angle_step: float = np.pi/100) -> List[float]:
    """
    Generuje seznam hodnot parametru t pro úhly od 0 do pi s krokem
    angle_step.
    """
    t_values = []
    current_t_min = t_min

    for angle in np.arange(0, np.pi + angle_step, angle_step):
        try:
            t = find_t_for_angle(f, h, float(angle), current_t_min, t_max)
            t_values.append(t)
            current_t_min = t  # Aktualizace dolní meze pro další iteraci
        except ValueError:
            # Pokud bisekce nenajde řešení, ukončíme iteraci
            break

    return t_values


def create_luts(foo: Callable[[float, float], Tuple[float, float]],
                params: Tuple[float],
                num_samples: int,
                world_size: int
                ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Create two 2D LUT tables of size (N, M) for a Tsunami function
    foo(s, params) -> (x, y)

    Parameters:
        foo: Tsunami function
        params: list of parameters of size M (number of discrete levels)
        num_samples (int): number of samples along s axis.
        world_size (float): maximum value of s.

    Returns:
        xlut (np.ndarray): 2D lookup tables for x.
        ylut (np.ndarray): 2D lookup tables for y.
        s_values (np.ndarray): array of s values (linearly spaced
                                                  between 0 and L).
    """
    s_values = np.linspace(0, world_size, num_samples)
    M = len(params)
    xlut = np.empty((num_samples, M))
    ylut = np.empty((num_samples, M))

    for level in range(M):
        for i, s in enumerate(s_values):
            x, y = foo(s, params[level])
            xlut[i, level] = x
            ylut[i, level] = y
    return xlut, ylut, s_values


def lookup_value(xlut, ylut, s_values, s, level, world_size):
    """
    Fast lookup in the LUT table with linear interpolation in the s direction.

    Parameters:
        xlut, ylut (np.ndarray): 2D lookup tables.
        s_values (np.ndarray): array of s values corresponding to the LUT rows.
        s (float): query value for s (0 <= s <= world_size).
        level (int): level index (0 <= level < M).
        world_size (float): maximum value of s.

    Returns:
        value: interpolated value from the LUT.
    """
    N = len(s_values)

    # Clamp s to the bounds [0, world_size]
    if s <= s_values[0]:
        return xlut[0, level], ylut[0, level]
    elif s >= s_values[-1]:
        return xlut[-1, level], ylut[-1, level]

    # Because s_values are linearly spaced, compute fractional index directly:
    fraction = (s / world_size) * (N - 1)
    i = int(np.floor(fraction))
    t = fraction - i  # interpolation weight

    # Perform linear interpolation between lut[i, level] and lut[i+1, level]
    return ((1 - t) * xlut[i, level] + t * xlut[i+1, level],
            (1 - t) * ylut[i, level] + t * ylut[i+1, level])


def arclength_foo(foo: Callable[[float], Tuple[float, float]],
                  t_max: float,
                  num_samples: int = 1000
                  ) -> Callable[[float], Tuple[float, float]]:
    """
    Vytvoří reparametrizovanou funkci podle délky oblouku pro zadanou funkci
    foo.

    Parametry:
    foo -- Původní parametrická funkce závislá na t.
    t_max -- Maximální hodnota parametru t pro vzorkování.
    num_samples -- Počet vzorků pro numerickou integraci.

    Návratová hodnota:
    Funkce závislá na délce oblouku s, která vrací souřadnice (x, y).
    """
    # Vytvoření funkce t(s) pomocí poskytnuté funkce make_arc_length_foo
    t_of_s = make_arc_length_foo(foo, t_max, num_samples)

    # Definice nové funkce závislé na s
    def foo_reparametrized(s: float) -> Tuple[float, float]:
        t = t_of_s(s)
        return foo(t)

    return foo_reparametrized


def make_arc_length_foo(foo: Callable[[float], Tuple[float, float]],
                        t_max: float,
                        num_samples: int = 1000,
                        invert=False
                        ) -> Callable[[float], float]:
    """
    Vytvoří funkci t(s), která pro danou délku s vrací parametr t tak,
    aby délka křivky foo od 0 do t byla právě s.

    Parametry:
        foo: funkce float -> (x, y)
        t_max: maximální hodnota parametru t
        num_samples: počet vzorků pro výpočet délky

    Výstup:
        funkce float -> float, která převádí délku s na parametr t
    """
    t_vals = np.linspace(0, t_max, num_samples)
    xy = np.array([foo(t) for t in t_vals])
    x_vals = xy[:, 0]
    y_vals = xy[:, 1]

    dx_dt = np.gradient(x_vals, t_vals)
    dy_dt = np.gradient(y_vals, t_vals)
    ds_dt = np.sqrt(dx_dt**2 + dy_dt**2)

    # arc_length = cumtrapz(ds_dt, t_vals, initial=0)
    arc_length = cumulative_trapezoid(ds_dt, t_vals, initial=0)

    if invert:
        return interp1d(t_vals, arc_length,
                        kind='linear', fill_value=cast(Any, "extrapolate"))
    else:
        return interp1d(arc_length, t_vals,
                        kind='linear', fill_value=cast(Any, "extrapolate"))


def make_angles_deg(start: float, stop: float, step: float) -> np.ndarray:
    """Return angles including stop if it lies on the arithmetic grid."""
    n = int(round((stop - start) / step))
    return start + step * np.arange(n + 1, dtype=float)



class Tsunami(ABC):
    """
    class that encapsulate different Tsunami algorithms
    """
    def __init__(self,
                 world_size: int = 1200,
                 keep_lengths: bool = False) -> None:
        """
        initializes Tsunami transformation class and set no lifting
        param = 0, use self.lift(param) function to increase/decrease how much
        the ground is lifted
        world_size is the expected size of the world (necessary for some
                                                      numerical algorithms)
        keep_lengths says if the uplifting keeps arc-length from the origin
        """
        self._param = 0.
        self._world_size = world_size
        self._keep_lengths = keep_lengths
        
    @property
    def name(self):
        return type(self).__name__

    @property
    def p(self) -> float:
        return self._param

    def lift(self, value: float) -> None:
        self._param = value

    def lift_to_angle(self, h: float, angle: float) -> None:
        self._param = self.angle_to_p(h, angle)

    def lift_to_ylevel(self, y_level: float) -> None:
        self._param = self.ylevel_to_p(y_level)


    @abstractmethod
    def t_to_xy(self, t: float) -> Tuple[float, float]:
        """
        returns the point coordinates in the vertical plane after ground
        lifting of a ground point at distance t from the origin.
        """
        pass

    @abstractmethod
    def derivative_at_t(self, t: float) -> Tuple[float, float]:
        """
        returns the derivative at parameter t.
        """
        pass

    @abstractmethod
    def second_derivative_at_t(self, t: float) -> tuple[float, float]:
        """
        Return the second derivative of the profile.
        """
        pass

    def signed_curvature_at_t(self, t: float) -> float:
        dx, dz = self.derivative_at_t(t)
        ddx, ddz = self.second_derivative_at_t(t)

        speed_sq = dx * dx + dz * dz
        if np.isclose(speed_sq, 0.0):
            return np.nan

        return (dx * ddz - dz * ddx) / speed_sq**1.5


    def curvature_at_t(self, t: float) -> float:
        return abs(self.signed_curvature_at_t(t))


    def curvature_radius_at_t(self, t: float) -> float:
        curvature = self.curvature_at_t(t)

        if np.isclose(curvature, 0.0):
            return np.inf

        return 1.0 / curvature
    

    def distance_to_t(self, d: float) -> float:
        """Convert an original ground distance to the profile parameter."""
        return self.s_to_t(d) if self._keep_lengths else d


    def curvature_at_distance(self, d: float) -> float:
        t = self.distance_to_t(d)
        return self.curvature_at_t(t)


    def ground_geometry(
            self,
            dists: Sequence[float],
            ) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray,
                       np.ndarray, np.ndarray]:
        """
        Evaluate lifted points, unit normals, curvatures, and curvature radii.

        Each original ground distance is converted to the native profile
        parameter only once. This keeps the geometric quantities mutually
        consistent and avoids repeating the arc-length inversion separately
        for coordinates, normals, and curvature.

        Returns
        -------
        x, y, nx, ny, curvature, radius
            One-dimensional NumPy arrays aligned with ``dists``. Curvature is
            non-negative; a flat profile has an infinite curvature radius.
        """
        x_out: list[float] = []
        y_out: list[float] = []
        nx_out: list[float] = []
        ny_out: list[float] = []
        curvature_out: list[float] = []
        radius_out: list[float] = []

        for d in dists:
            t = self.distance_to_t(float(d))
            x, y = self.t_to_xy(t)
            nx, ny = self.t_to_normal(t)
            curvature = self.curvature_at_t(t)
            radius = np.inf if np.isclose(curvature, 0.0) else 1.0 / curvature

            x_out.append(float(x))
            y_out.append(float(y))
            nx_out.append(float(nx))
            ny_out.append(float(ny))
            curvature_out.append(float(curvature))
            radius_out.append(float(radius))

        return (
            np.asarray(x_out, dtype=float),
            np.asarray(y_out, dtype=float),
            np.asarray(nx_out, dtype=float),
            np.asarray(ny_out, dtype=float),
            np.asarray(curvature_out, dtype=float),
            np.asarray(radius_out, dtype=float),
        )


    def t_to_normal(self, t: float) -> Tuple[float, float]:
        """
        returns the unit normal [nx,ny] of a ground point at distance d 
        after ground lifting.
        """
        dx, dy = self.derivative_at_t(t)
        
        lng = math.sqrt(dx**2+dy**2)
        assert lng > 0
        
        return -dy/lng, dx/lng
        

    @abstractmethod
    def xy_to_p(self, x: float, y: float) -> float:
        """
        returns a parameter for which the curve passes [x,y]
        """
        pass
    
    @abstractmethod    
    def t_seen_in_direction(self, v: Tuple[float, float], h: float) -> float:
        """
        returns a parameter t for which the ray from [0, h] in direction v 
        intersects the lifted curve. If there is no such t, then np.inf 
        is returned.
        """
        pass

    def t_seen_in_directions(self, vd: List[float], vz: List[float],
                             h: float) -> List[float]:
        """
        returns a list of t parameters for which the ray from [0, h] in
        the given directions intersects the lifted curve. If there is no such t,
        then np.inf is returned.
        """
        return [self.t_seen_in_direction((v1, v2), h) for v1,v2 in zip(vd, vz)]

    def d_to_xy(self, d: float) -> Tuple[float, float]:
        return self.s_to_xy(d) if self._keep_lengths else self.t_to_xy(d)
    
    def s_to_xy(self, s: float) -> Tuple[float, float]:
        """
        returns the coordinates [x,y] of a ground point s lifted with keeping
        the arclength from the origin
        It is implemented using a general numerical algorithm. If a method
        enables faster way how to solve the problem, it should be redefined.
        """
        foo = arclength_foo(self.t_to_xy, self._world_size)
        return foo(s)
    
    def s_to_t(self, s: float) -> float:
        """
        finds the parameter t of a point with the arc-length s
        """
        if np.isinf(s):
            return s
        lng = self.arc_length(s)
        if np.isclose(s, lng):
            return s
        assert lng > s  # transformations should increase the length
        
        def difference(t):
            return s - self.arc_length(t)
        
        result = bisect(difference, 0, s)
        return float(result[0] if isinstance(result, tuple) else result)

    def t_to_s(self, t: float) -> float:
        """
        transforms parameter t to the arc-length of the curve
        """
        return self.arc_length(t)
    
    def t_lst_to_s_lst(self, t_lst: List[float]) -> List[float]:
        return self.arc_lengths(t_lst)

    def arc_lengths(self, t_lst: List[float],
                   epsabs: float = 1e-8, epsrel: float = 1e-8) -> List[float]:
        """
        returns the list of arclengths from the origin to the point defined by
        the sorted list of t parameters t_lst.
        It is implemented using a general numerical algorithm. If a method
        enables faster way how to solve the problem, it should be redefined.
        """
        def integrand(t: float) -> float:
            dxdt, dydt = self.derivative_at_t(t)
            return math.hypot(dxdt, dydt)
        # if t_lst[0] > t_lst[1]:
        #     print(f"{t_lst[0]}>{t_lst[1]}")
        # else:
        #     print(f"{t_lst[0]}<={t_lst[1]}")
        res = []
        t = t_lst[0]
        t0 = t if t < 0 else 0
        total_lng = t if t < 0 else 0
        for t in t_lst:
            assert t0 <= t, f"{t0} <= {t}, {t_lst=}"
            if np.isinf(t):
                total_lng = t
            else:
                lng, err = quad(integrand, t0, t, epsabs=epsabs, epsrel=epsrel)
                total_lng += lng
            res.append(total_lng)
            t0 = t
        return res

    def arc_length(self, t_end) -> float:
        """
        returns the arclength from the origin to a point at t.
        It is implemented using a general numerical algorithm. If a method
        enables faster way how to solve the problem, it should be redefined.
        """
        return self.arc_lengths([t_end])[0]
    
    def build_lut_theta(self, h:float,
                        theta_max:float=np.pi,
                        n:int=4096)->Tuple[List[float],List[float]]:
        """
        Creates LUT for theta->s search from a point [0,h] theta=0 sees origin
        returns theta and s_lut arrays
        """
        theta = np.linspace(0.0, float(theta_max), n)
        vd = np.sin(theta)
        vz = -np.cos(theta)
        t_list = self.t_seen_in_directions(vd.tolist(), vz.tolist(), h)
        s_lut = np.array(self.t_lst_to_s_lst(t_list), dtype=float)
        return theta.tolist(), s_lut.tolist()

    def uplift_ground(self, dists: List[float] | np.ndarray) -> Tuple[List[float], 
                                                                List[float]]:
        """
        Computes uplifted coordinates of ground points at distances s in 
        flat space using the Tsunami procedure.
        """
        x, y = zip(*[self.d_to_xy(d) for d in dists])
        return list(x), list(y)

    def uplift_town(self,
                    x_coords: List[float],
                    y_coords: List[float]) -> Tuple[List[float], List[float]]:
        """
        Takes the lists of x and y coordinates (len(x) == len(y)) and returns
        the transformed lists.
        """
        assert len(x_coords) == len(y_coords)
        new_x, new_y = [], []
        for x, y in zip(x_coords, y_coords):
            t = self.s_to_t(x) if self._keep_lengths else x
            xx, yy = self.t_to_xy(t)
            nx, ny = self.t_to_normal(t)
            new_x.append(xx + y*nx)
            new_y.append(yy + y*ny)
        return new_x, new_y
    
    def angles_to_dist(self, angles: List[float], h: float) -> List[float]:
        """
        returns the distance in the curved space of the points seen from 
        the height h at given angles. If there is no intersection for the
        given angle, np.inf is stored
        """
        return [self.t_to_s(self.t_seen_in_direction((np.sin(a), -np.cos(a)), h)) for a in angles]
        #return [(np.sin(a), -np.cos(a)) for a in angles]

    def angle_to_p(self,
                h: float,
                angle: float,
                d: float = 0,
                p_start: float = 0,
                tol: float = 1e-10) -> float:
        """
        Returns a parameter p for which a ground point at distance d is seen
        from (0,h) under the given angle. If angle is smaller then the angle
        to the ground point then p will be 0 by definition.

        angle is measured from the downward vertical direction and must be
        given in radians. If d == 0, d is considered equal to world_size.
        """
        if d == 0:
            d = self._world_size

        flat_angle = calculate_angle((0, 0), (0, h), (d, 0))
        if angle <= flat_angle + tol:
            return 0.0

        def angle_for_p(param: float) -> float:
            old_p = self.p
            self.lift(param)
            x, y = self.d_to_xy(d)
            self.lift(old_p)
            return calculate_angle((0, 0), (0, h), (x, y))

        angle_start = angle_for_p(p_start)

        if np.isclose(angle_start, angle, atol=tol):
            return p_start

        if angle_start > angle:
            raise ValueError(
                f"At p_start={p_start}, angle is already larger "
                f"than target angle: {angle_start} > {angle}"
            )

        # Find upper bound where the point is seen under a larger/equal angle.
        dp = 1.0
        angle_hi = angle_for_p(p_start + dp)

        while angle_hi < angle:
            dp *= 2
            angle_hi = angle_for_p(p_start + dp)

        def difference(param: float) -> float:
            return angle_for_p(param) - angle

        res = bisect(difference, p_start, p_start + dp, xtol=tol)
        # bisect may return a raw root or a (root, results) tuple depending
        # on the implementation; ensure we return a float root.
        if isinstance(res, tuple):
            root = res[0]
        else:
            root = res
        return float(root)

    def angles_to_params(
            self,
            h: float,
            angles: Sequence[float],
            d: float = 0,
            *,
            use_previous_as_start: bool = True
            ) -> list[float]:
        """
        Return lifting parameters for the requested viewing angles.

        Angles must be given in radians and should normally be sorted in
        increasing order. If ``d == 0``, the end of the modelled world is
        used, consistently with :meth:`angle_to_p`.

        When ``use_previous_as_start`` is true, the parameter found for one
        angle is used as the lower search bound for the next angle. This makes
        the computation faster and follows the expected monotone progression
        of the lifting parameter.
        """
        params: list[float] = []
        p_start = 0.0

        for angle in angles:
            p = self.angle_to_p(
                h=h,
                angle=float(angle),
                d=d,
                p_start=p_start if use_previous_as_start else 0.0,
            )
            params.append(float(p))

            if use_previous_as_start:
                p_start = float(p)

        return params
       
        
    def ylevel_to_p(self, 
                    y_level: float,
                    d: float = 0, 
                    p_start: float = 0) -> float:
        """
        Returns a parametr that lifts the ground point at distance d to 
        the y_level. If d == 0 then d is considered equal to world_size.
        The parameter is searched numerically. p_start is a parameter for which
        the points is bellow the required y_level and where to start the search
        """
        if d == 0:
            d = self._world_size
        
        def level_for_p(param):
            old_p = self.p
            self.lift(param)
            _, y = self.d_to_xy(d)
            self.lift(old_p)
            return y
            
        y = level_for_p(p_start)
        assert y <= y_level
        if y == y_level:
            return p_start
        
        # find a point above the required level
        dp = 1
        y = level_for_p(p_start+dp)
        while y < y_level:
            dp *= 2
            y = level_for_p(p_start+dp)
            
        def goo(p):
            y = level_for_p(p)
            return y - y_level
        
        # bisect implementations may return a float or a tuple like
        # (root, RootResults). Normalize to a float root to satisfy callers
        res = bisect(goo, p_start, p_start+dp)
        if isinstance(res, tuple):
            return float(res[0])
        return float(res)
    
    def animate_levels(self, levels: list[float], d: float=0) -> list[float]:
        """
        returns the list of parameters that lifts the ground point 
        at the distance d to the required levels. If d == 0 then the point
        at the end of world (d==world_size) is lifted
        """
        return [self.ylevel_to_p(y_level, d) for y_level in levels]

    def animate_keypoints(self,
                          key_x: list[float],
                          key_y: list[float]) -> list[float]:
        """
        Function returns a list of a parameters defining the ground shape that
        goes through given keypoints.
        """
        return [self.xy_to_p(x, y) for (x, y) in zip(key_x, key_y)]


class ParabolicTsunami(Tsunami):
    """
    Simple parabolic transformation
    """
    def t_to_xy(self, t: float) -> Tuple[float, float]:
        a = self.p
        return t, a*t**2

    def derivative_at_t(self, t: float) -> Tuple[float, float]:
        a = self.p
        return 1, 2*a*t
    
    def second_derivative_at_t(self, t: float) -> tuple[float, float]:
        return 0.0, 2.0 * self.p

    def t_seen_in_direction(self, v: Tuple[float, float], h: float) -> float:
        v1, v2 = v
        a = self.p
        if np.isclose(v1, 0): # we look at the origin or in the opposite way
            return np.inf if v2 >= 0 else 0
        if np.isclose(a, 0):  # no lifting - triangle similarity applies only
            return np.inf if v2 >= 0 else -v1*h/v2
        return (v2+np.sqrt(v2**2+4*a*h*v1**2))/2/a/v1

    def xy_to_p(self, x: float, y: float) -> float:
        return y/x**2


class HyperbolicTsunami(Tsunami):
    """
    Hyberbolic transformation
    """
    def __init__(self,
                 a: float = 1200, 
                 world_size: int = 1200,
                 keep_lengths: bool = True) -> None:
        super().__init__(world_size, keep_lengths)
        """
        the hyperbolic transformation is defined by two parameters (p and a).
        These two parameters control the asymptote of the hyperbola, which is
        a line y = p*x-a. Hyperbola vertex is the origin (0,0).
        """
        self._a = a

    @property
    def a(self) -> float:
        return self._a

    @a.setter
    def a(self, value: float) -> None:
        self._a = value

    def t_to_xy(self, t: float) -> Tuple[float, float]:
        p, a = self.p, self.a
        return t, math.sqrt(a**2+p**2*t**2)-a

    def derivative_at_t(self, t: float) -> Tuple[float, float]:
        p, a = self.p, self.a

        # For a == 0, the hyperbola degenerates to the straight half-line
        # z = |p t|. The tsunami profile is used for t >= 0, hence z = p t
        # for the non-negative lifting parameters considered here.
        if np.isclose(a, 0.0):
            return 1.0, float(p)

        denominator = math.sqrt(p**2 * t**2 + a**2)
        return 1.0, p**2 * t / denominator

    def s_to_t(self, s: float) -> float:
        """Convert arc length to profile parameter.

        The degenerate case ``a == 0`` is a straight line and therefore has
        the exact arc-length relation ``s = t * sqrt(1 + p**2)``. Handling it
        explicitly avoids the undefined derivative 0/0 at the origin and
        unnecessary numerical integration.
        """
        if np.isclose(self.a, 0.0):
            return float(s) / math.sqrt(1.0 + self.p**2)
        return super().s_to_t(s)

    def s_to_xy(self, s: float) -> Tuple[float, float]:
        if np.isclose(self.a, 0.0):
            return self.t_to_xy(self.s_to_t(s))
        return super().s_to_xy(s)

    def arc_length(self, t_end: float) -> float:
        if np.isclose(self.a, 0.0):
            return float(t_end) * math.sqrt(1.0 + self.p**2)
        return super().arc_length(t_end)
    
    def second_derivative_at_t(self, t: float) -> tuple[float, float]:
        p = self.p
        a = self.a

        denominator = (a**2 + p**2 * t**2)**1.5
        if np.isclose(denominator, 0.0):
            return 0.0, 0.0
        return 0.0, p**2 * a**2 / denominator
    
    def t_seen_in_direction(self, v: Tuple[float, float], h: float) -> float:
        v1, v2 = v
        p, a = self.p, self.a
        
        # Flat profile. This case occurs for p == 0 independently of a.
        # Handle it explicitly: the general hyperbolic formula suffers from
        # cancellation near the horizon and may return invalid intersections.
        if np.isclose(p, 0.0):
            if v2 >= 0.0:
                return np.inf
            if np.isclose(v1, 0.0):
                return 0.0
            return float(-v1 * h / v2)

        # For a == 0, the profile degenerates to the straight half-line
        # z = p t. Its intersection with the viewing ray is available in a
        # simple and numerically stable closed form.
        if np.isclose(a, 0.0):
            denominator = p * v1 - v2
            if denominator <= 0.0:
                return np.inf
            if np.isclose(v1, 0.0):
                return 0.0
            return float(h * v1 / denominator)

        if v2 >= p * v1:  # ray points along or above the asymptote
            return np.inf
        if np.isclose(v1, 0.0):
            return 0.0

        tg = v2 / v1
        c1 = p**2 - tg**2
        c2 = (a + h) * tg

        if np.isclose(c1, 0.0):
            return float(-h * (h + 2 * a) / (2 * c2))

        discriminant = c2**2 + h * (2 * a + h) * c1
        # Suppress tiny negative values caused only by roundoff.
        if discriminant < 0.0 and np.isclose(discriminant, 0.0):
            discriminant = 0.0
        if discriminant < 0.0:
            return np.inf

        return float((c2 + math.sqrt(discriminant)) / c1)
    
    # if v2 >= p*v1:  # we are looking above the horizont
    #         return np.inf
    #     if np.isclose(v1, 0):  # we are looking to the origin
    #         return 0  # np.inf was returned above if v2 > 0
    #     tg = v2/v1
    #     c1 = p**2-tg**2
    #     c2 = (a+h)*tg 
    #     if np.isclose(c1, 0):
    #         return -h*(h+2*a)/2/c2
    #     else:
    #         return (c2+math.sqrt(c2**2+h*(2*a+h)*c1))/c1

    def xy_to_p(self, x: float, y: float) -> float:
        return math.sqrt(y*(y+2*self.a))/x


class AngularTsunami(Tsunami):
    """
    Angular transformation
    """
    def _foo(self, s: float, kappa: float) -> Tuple[float, float]:
        if np.isclose(kappa, 0):
            return s, 0
        h = 1/kappa
        
        d = math.sqrt(h**2+s**2)
        return 2*s*h/d, h-(h**2-s**2)/d
        
    def t_to_xy(self, t: float) -> Tuple[float, float]:
        return self._foo(t, self.p)

    def derivative_at_t(self, t: float) -> Tuple[float, float]:
        kappa = self.p
        if np.isclose(kappa, 0):
            return 1, 0
        
        h = 1/kappa
        d3 = math.sqrt((h**2+t**2))**3
        return 2*h**3/d3, t*(3*h**2+t**2)/d3

    def second_derivative_at_t(self, t: float) -> tuple[float, float]:
        kappa = self.p

        if np.isclose(kappa, 0.0):
            return 0.0, 0.0

        h_eff = 1.0 / kappa
        denominator = (h_eff**2 + t**2) ** 2.5

        ddx = -6.0 * h_eff**3 * t / denominator
        ddz = 3.0 * h_eff**2 * (h_eff**2 - t**2) / denominator

        return ddx, ddz

    def t_seen_in_direction(self, v: Tuple[float, float], h: float) -> float:
        v1, v2 = v
        if np.isclose(v1, 0):  # we look at the origin or in the opposite way
            return np.inf if v2 >= 0 else 0
        if np.isclose(self.p, 0):  # no lifting - triangle similarity applies
            return np.inf if v2 >= 0 else -v1*h/v2
        # we need to solve quartic equation w.r.t. u, where t=u/p 
        p = self.p
        q = v1**2*(1-h*p)**2
        coefficients = [v1**2, -4*v1*v2, 4*v2**2-2*v1**2-q, 4*v1*v2, v1**2-q]
        # print(np.array(coefficients)*2)
        roots = np.roots(coefficients)
        # take only real positive roots
        # rp_roots = np.array([r.real for r in roots 
        #                      if np.isclose(r.imag, 0, atol=1e-8) and r.real>0])
        # # print(rp_roots)
        # We obtain two values and experimentally I found the following
        # decision procedure. Is it general and will it work for np.roots of
        # different/future versions?
        # return rp_roots[0 if h*p > 1 else 1]/p

        roots = np.roots(coefficients)
        candidates = []

        for root in roots:
            if not np.isclose(root.imag, 0.0, atol=1e-8):
                continue

            u = float(root.real)
            if u < 0:
                continue

            residual = (
                v1 * (1 - h * p) * np.sqrt(1 + u**2)
                - v1 * (1 - u**2)
                - 2 * v2 * u
            )
            if not np.isclose(residual, 0.0, atol=1e-7):
                continue

            x = 2 * u / (p * np.sqrt(1 + u**2))
            ray_parameter = x / v1

            if ray_parameter >= 0:
                candidates.append((ray_parameter, u))

        if not candidates:
            return np.inf

        _, u = min(candidates)
        return u / p


    def xy_to_p(self, x: float, y: float) -> float:
        def displacement(params):
            """
            returns the vector between [x,y] and the point on the curve
            with parameters kappa and s given in vars.
            """
            kappa, s = params
            x0, y0 = self._foo(s, kappa)
            return [x0-x, y0-y]
        
        return fsolve(displacement, (1, 1))[0]


class SphericalTsunami(Tsunami):
    """
    Spherical transformation
    """
    def t_to_xy(self, t: float) -> Tuple[float, float]:
        kappa = float(self.p)
        if np.isclose(kappa, 0):
            return t, 0.0
        alfa = t*kappa
        return float(np.sin(alfa)/kappa), float((1-np.cos(alfa))/kappa)

    def derivative_at_t(self, t: float) -> Tuple[float, float]:
        kappa = self.p
        alfa = t*kappa
        return np.cos(alfa), np.sin(alfa)
    
    def second_derivative_at_t(self, t: float) -> tuple[float, float]:
        kappa = self.p
        alpha = kappa * t

        return -kappa * math.sin(alpha), kappa * math.cos(alpha)
        
    def signed_curvature_at_t(self, t: float) -> float:
        return float(self.p)
    
    def xy_to_p(self, x: float, y: float) -> float:
        return 2*y/(x**2+y**2)

    def s_to_xy(self, s: float) -> Tuple[float, float]:
        return self.t_to_xy(s)

    def t_seen_in_direction(self, v: Tuple[float, float], h: float) -> float:
        if h*self.p > 2:  # observer is outside the sphere
            return np.inf
        v1, v2 = v
        v_lng = np.hypot(v1,v2)
        v1 /= v_lng
        v2 /= v_lng
        #assert np.isclose(v1**2+v2**2, 1)
        if np.isclose(self.p, 0):
            return np.inf if v2>=0 else -v1*h/v2
        
        r = 1/self.p 
        t = v2*(r-h)+math.sqrt(v2**2*(r-h)**2+h*(2*r-h))
        angle = np.arctan2(t*v1, r-h-t*v2)
        s = abs(angle)*r
        return 0.0 if np.isclose(s, 0) else s
    
    def arc_length(self, t_end: float) -> float:
        return t_end
    
    def angle_to_p(self, 
                   h: float,
                   angle: float,
                   d: float = 0,
                   p_start: float = 0,
                   tol: float = 1e-10) -> float:
        """
        Returns curvature kappa for which the point at arc-length d is seen
        from (0,h) under the given angle.

        For the spherical model we search only the first meaningful interval:
            kappa in [0, pi/d]
        """
        if d == 0:
            d = self._world_size

        flat_angle = calculate_angle((0, 0), (0, h), (d, 0))
        if angle <= flat_angle:
            return 0.0

        p_max = np.pi / d

        if angle >= np.pi:
            return p_max

        def difference(p):
            old_p = self.p
            self.lift(p)
            x, y = self.d_to_xy(d)
            self.lift(old_p)
            return calculate_angle((0, 0), (0, h), (x, y)) - angle

        # bisect may have typing that allows returning extra info; ensure float
        return cast(float, bisect(difference, 0.0, p_max, xtol=tol, full_output=False))
    
    def animate_winding(self, n: int) -> list[float]:
        """
        returns a list of kappa (curvature) parameters for spherical
        method defining the bending that winds the ground of maximal size
        world_size onto a circle in n-steps.
        """
        return list(np.linspace(0, np.pi, n) / self._world_size)


if __name__ == "__main__":
    world_size = 5000
    number_of_buildings = 20
    building_width = 10
    building_height = 50
    # generate s-coordinates of left bottom corner of buildings
    buildings = generate_building_positions(world_size,
                                            number_of_buildings,
                                            building_width)
    # all buildings will have same size
    heights = np.full_like(buildings, building_height)
    widths = np.full_like(buildings, building_width)
    
    # create flat ground
    ground_x, ground_y = create_flat_ground(world_size, num_samples=100)
    # create building positions
    city_x, city_y = erect_city(ground_x, ground_y, buildings, 
                                widths, heights, ground_x)
    plt.plot(city_x, city_y, 'k-')
    plt.axis("equal")
    plt.show()
    
    key_points_x, key_points_y = FOV_keypoints(world_size, world_size,
                                               step=100)
    plt.plot(key_points_x, key_points_y, 'ro')
    plt.axis("equal")
    plt.show()
    
    
    fig, ax = plt.subplots()
    ax.set_xlim(0, world_size)
    ax.set_ylim(0, world_size)
    ax.set_aspect('equal')
    
    #tsunami = SphericalTsunami(keep_lengths=True)
    #tsunami.uplift(1/1000)
    #tsunami = ParabolicTsunami(0.0005, keep_lengths=False)
    #tsunami.uplift(0.0005)
    #tsunami = HyperbolicTsunami(keep_lengths=False)
    #tsunami.uplift(1)
    tsunami = AngularTsunami(keep_lengths=True)
    tsunami.lift(1/3000)
    x,y = tsunami.uplift_ground(ground_x)
    ax.plot(x, y, 'r-')
    h = 1000
    alpha = np.radians(45)
    v = (float(np.sin(alpha)), float(-np.cos(alpha)))
    t = tsunami.t_seen_in_direction(v, h)
    s = tsunami.arc_length(t)
    
    print(tsunami.angles_to_dist([np.radians(0), np.radians(10),
                                  np.radians(45), np.radians(60),
                                  np.radians(90), np.radians(160)], h))
    print(f"Arc-length at {t=} is {s=}: s_to_t returns {tsunami.s_to_t(s)}")
    
    nx,ny = tsunami.t_to_normal(t)
    v_lng = 500
    
    ax.plot(0, h, 'b*')
    ax.plot([0, v[0]*v_lng], [h, h+v[1]*v_lng], 'b-')
    x0, y0 = tsunami.t_to_xy(t)
    ax.plot(x0, y0, 'gx')
    ax.quiver(x0,y0,nx,ny,scale=5, color='b')
    plt.show()
    
    