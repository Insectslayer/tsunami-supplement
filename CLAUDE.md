# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Research prototype (matplotlib-based, no packaging, no tests, no linter config) for *Tsunami transformations*: uplifting a flat ground so distant regions become more visible to an observer. `description.qmd` holds the accompanying paper text and defines the notation used throughout the code.

## Commands

```bash
conda env create -f environment.yml   # first time; python 3.11 + numpy/scipy/matplotlib/trimesh/tk
conda activate tsunami

# or, without conda — the same four packages, tkinter coming from the system python
python3 -m venv .venv && .venv/bin/pip install numpy scipy matplotlib trimesh
source .venv/bin/activate             # .venv/ is gitignored

python render_grid.py                        # main 4-panel interactive demo
python study_sideview.py                     # 1-D side-view / visibility study
python precompute_tsunami_angle_params.py    # regenerate the angle→parameter caches
python plot_observer_distance_change.py      # figure scripts (see gotcha below)
python animate_sideview.py                   # CLI side-view stills / animations (non-interactive)
```

Every script is executed top-to-bottom at import time — there is no `if __name__ == "__main__"` guard in `render_grid.py` / `study_sideview.py`, and module-level code builds the figure and calls `plt.show()`. Importing them runs the GUI. An interactive matplotlib backend (Tk) is required.

## Architecture

### `tsunami.py` — the transformation library

`Tsunami(ABC)` defines a 1-D uplift profile in a vertical plane; concrete subclasses `ParabolicTsunami`, `HyperbolicTsunami`, `AngularTsunami`, `SphericalTsunami` supply `t_to_xy`, `derivative_at_t`, `second_derivative_at_t`, `xy_to_p`, `t_seen_in_direction`, and override the generic numerics where a closed form exists.

Four distinct scalars are used and must not be confused:

- `p` — the **lift parameter** (state of the object; `lift()`, `lift_to_angle()`, `lift_to_ylevel()`). `p == 0` is flat ground.
- `t` — the **native curve parameter** of the profile.
- `s` — **arc length** along the lifted curve from the origin.
- `d` — distance on the **original flat** ground.

`keep_lengths` (usually `True` in the demos) decides whether an original distance `d` maps through arc length (`s_to_t`, `s_to_xy`) or directly as `t`; `distance_to_t` / `d_to_xy` are the entry points that respect it. Base-class conversions (`arc_length`, `s_to_t`, `s_to_xy`) are numerical (`quad`, `bisect`, `fsolve`) and slow — subclasses override them when analytic.

Visibility is computed by ray casting from `(0, h)`: `t_seen_in_direction` → `build_lut_theta(h)` produces the `theta → s` lookup table that every renderer interpolates into. `angle_to_p` inverts "end of world seen under angle X" by bracketing + bisection; `angles_to_params` chains it monotonically using the previous solution as the lower bound.

`create_cuboidal_town`, `erect_city`, `uplift_town`, `uplift_3D*` are the 3-D/trimesh side of the library, currently unused by the interactive demos.

### `render_grid.py` — 4-panel demo (camera original / camera tsunami / side view / top view)

Coordinate systems (World → Observer → DisplayM → DisplayP → Image) and their conversions are documented in the module docstring; the geometry lives in `TsunamiWorld`, a dataclass whose derived quantities are `@depends_on(...)` cached properties. `depends_on` wraps `cached_property` and a custom `__setattr__` invalidates dependents when a source field changes — when adding a derived quantity, declare its dependencies or it will go stale after a slider move.

Rendering pipeline: a **distance field** `d[j,i]` (radial ground distance seen by each pixel, `inf` = sees infinity) is produced by one `dist_field_*` function, then `render_cv_arrays_from_d(d)` turns it into the chessboard RGB image plus the top-view FOV outline. The flat reference view uses `w.d`; the transformed view uses `method()`.

Method selection is two-dimensional: the **profile** (which `Tsunami` subclass) and the **application** (`radial` / `directional` / `mixed` / `balanced`), combined in `AVAILABLE_METHODS` and picked by the module constant `SELECTED_METHOD` (1–16). The profile is instantiated once at module level; the application is swappable at runtime through `METHOD_FUNCS` / `set_method`, driven by the radio buttons.

Keys: `P` saves the four panels to `saved_panels/` (PDF+SVG+PNG), `C` shows distance contours, `F` toggles fullscreen.

### `study_sideview.py` — 1-D study

Independent copy of the constants and a much smaller `TsunamiWorld` (side view only, no azimuth, `SELECTED_METHOD` 1–4 = profile only). Adds the visible-distance color strips, the lift-level slider driven by `compute_tsunami_levels` (which goes through the cache), the curvature band (`curvature_band_data`, `WORLD_HEIGHT` / `CURVATURE_SAFETY_FACTOR`: the lifted world is unsafe where the curvature radius drops below the object height), and `E` for the strip-evolution figure.

### `web/` + `build/` — interactive appendix page

`web/index.html` is a browser recreation of the appendix of `paper/main.md`: the prose verbatim, with every
static figure replaced by a live construction. It is generated, not hand-edited — run `node build/assemble.js`
after changing anything under `web/`.

```bash
node build/convert.js      # paper/main.md appendix -> web/content.html (KaTeX prerendered)
node build/assemble.js     # template + content + assets -> web/index.html and web/appendix.html
node build/bundle/bundle.js # the whole site -> build/bundle/supplement.html (one offline file)
node build/verify.js        # JS profile maths vs build/reference.json
node build/check.js         # headless Chrome: renders, console errors, layout (index.html only)
node build/bundle/check.js  # the bundle alone in an empty directory over file://
```

Where a figure belongs is decided in the markdown: a line reading `@@figure:<name>@@` becomes the slot that
`app.js` fills with the builder registered under `<name>` in `web/js/figures-*.js` (grep `figures.` there for
the current list). Moving a figure means moving its anchor line; `convert.js` knows nothing about the figures
beyond the anchor name, and refuses to build if `<figure>`/`<embed>`/`<img>` markup reappears in `main.md`.
An anchor with no builder is not caught at build time — `check.js` reports it.

Figures and sections are referenced in the following way:
- figures: labelled by their `@@figure:<name>@@` anchor, numbered 1..n; the number goes on the slot as
  `data-number`, and `figure-kit.js` reads it for the figure heading and the caption prefix;
- sections: labelled by the pandoc id on the heading (`## … {#sec:1d_tsunami}`, cited as
  `@@ref:sec:1d_tsunami@@`), numbered hierarchically under `FIRST_SECTION_NUMBER`; the number goes on the heading as `data-number` and into a
  `.heading-number` span, which `app.js` reuses for the contents rail;
- tables: labelled by the id on the pandoc div (`::: {#tab:parameters}`), numbered 1..n; the div must carry an id or the build fails.

There are three build outputs, in increasing order of self-containment. `web/index.html` links its assets.
`web/appendix.html` is the appendix alone with CSS, JS and KaTeX fonts inlined. `build/bundle/supplement.html`
is the whole site — appendix plus both results pages — in one file, and is the copy meant to reach reviewers
offline. It is a review artifact rather than part of the site, so it is built next to its own scripts and
gitignored (`build/.gitignore`); rebuild it on demand. `build/reference.py` regenerates `reference.json` and
needs numpy/scipy/trimesh.

`build/bundle/` holds everything specific to that file. `bundle.js` builds it, `check.js` verifies it,
`extra.css` and `router.js` are bundle-only assets it inlines, and `../inline.js` is the asset inlining it
shares with `assemble.js`. It exists because a browser on a `file://` URL cannot always read the files next to it: a
sandboxed browser (Flatpak, Snap) handed a single file through xdg-document-portal sees only that file, and so
does a reader clicking `index.html` inside an unextracted ZIP — every relative asset 404s and the page arrives
as unstyled text. The bundle folds the three pages into three `.view` sections of one document and embeds every
asset: figures become data: URIs, and every downloadable file goes into `SUPPLEMENT_FILES` and is served as a
blob URL. The dataset previews need nothing from the bundler — `supplement.py` renders those tables into the
markup, so they work over `file://` on the standalone pages too. `--lean` embeds no downloadable data at all,
roughly 4.8 MB against 11.4 MB; the difference is dominated by the 3.4 MB analysis notebook.

Anything placed in a `<script>` must go through `jsonForScript`, not bare `JSON.stringify`: the notebook's saved
pandas and Colab outputs contain the literal `</script>`, which closes the element early and leaves the rest of
the data to be parsed as markup. `build/bundle/check.js` fails on any stray element in `<body>` for this reason.

Both `app.js` and `results.js` scope themselves to a root element so the same code serves one page per document
and three views in one: they find the contents rail by `.toc` class rather than by id, and `results.js` wires
itself once per `[data-view$="-results"]` section, falling back to the whole document when there is none.
Standalone, `web/` behaves exactly as before.

`web/js/tsunami.js` is a port of the profile mathematics in `tsunami.py`, verified to ~1e-7 relative against
tight-tolerance quadrature. Two deliberate differences from the Python: arc-length inversion uses composite
Gauss–Legendre plus Newton refinement (`tsunami.py`'s `s_to_xy` goes through `np.gradient` + trapezoid +
linear interpolation and carries ~1e-4 relative error), and the angle→distance lookup table is built by walking
the profile forward rather than casting a ray per entry, which the monotonicity requirement makes equivalent.

Uplift is driven by the transformed boundary angle α′_w rather than by `p`, so the four profiles are always
compared at the same amount of spreading; `ProfileModel` precomputes the α′_w → p table per profile, as the
"Determining the uplift parameter" section of the paper describes.

### `animate_sideview.py` — CLI side-view demonstration

The only non-interactive, non-GUI entry point: it renders the vertical viewing plane to PNG frames or to an
mp4/gif through the `Agg` backend, and is driven entirely by `argparse` (`--help` is the reference). It exists
to make animations of *how the transformation is built*, so each stage of the map is a separate control, and
each control accepts either a number or an interval `a:b` that is ramped over `--steps` frames; any interval
turns the run into a video. The ramp is walked with an easing — `--easing` for all of them, or `a:b:easing` on
one control to override it — from the `EASINGS` table, which builds the out and in-out variants of each family
from its ease-in curve. Overshooting families are left out on purpose: the controls clamp to [0, 1], so an
overshoot would flatten into a hold.

A scene point is a pair `(s, q)` — ground distance, height above ground — and reaches the uplifted world as

```
t   = (1 - a) * s + a * t(s)          # --arclength, a = 1 is keep_lengths=True
dir = normalize((1 - w) * e_z + w * n(t))   # --normal, w = 1 is the rigid-height model
P'  = g'(t) + q * dir
```

`--bending` runs 0 (flat) to 1 (`--max-angle`, 175°) and is mapped linearly onto α′_w, which is then inverted
to `p` — so the four profiles are comparable at equal bending, as in `web/js/model.js`. The α′_w defining the
bending always assumes full arc-length preservation, independently of where `--arclength` sits, or the two
controls would interfere.

The script uses the profile classes of `tsunami.py` but not their arc-length inversion: the base-class
`s_to_xy` rebuilds a table on every call. `Construction` keeps two tables instead — the α′_w → p table built
once, and the `t(s)` table rebuilt whenever `p` changes — mirroring `web/js/tsunami.js`. Two things that are
easy to get wrong and are handled explicitly: scene polylines are densified before mapping (an unsubdivided
edge becomes a chord across the bent ground), and axis limits are computed once in a pre-pass rather than per
frame, so the view does not jitter. That pre-pass covers every frame by default, which shrinks the drawing
until the tallest frame fits; `--fit first` sizes it to the opening frame instead and `--scale` pins the meters
per pixel outright, both letting later frames grow out of the image, with `--center` to aim them.

The cast ray is cast in the *uplifted* world, so `--ray` coordinates are read there; its dashed counterpart is
its **pre-image**, obtained by inverting the map, not its image. `Construction.inverse_points` solves
`P' - g'(t(s)) ∥ dir(t)` by scanning the tabulated ground for sign changes: past the focal surface a point has
several pre-images and the nearest sheet is taken, and where none exists the result is NaN and the curve
breaks. Only the stretch up to the first hit is drawn — beyond it the ray has left the world and its pre-image
is far underground — and the pre-image of the hit is the ground distance the observer actually sees, which is
what the paper's angle-to-distance table returns. Both curves are revealed by ray parameter, not by length, so
they stay in lock-step. Verified: forward-then-inverse round-trips to ~1e-4 m on a 500 m world, and the hit
pulls back onto q = 0, for every profile and every knob setting.

### `precompute_tsunami_angle_params.py` — cache layer

`load_or_compute_angle_params(tsunami, h=, angles_rad=, d=)` is the public entry point (used by `study_sideview.py`). It writes `tsunami_angle_params_<Method>_<world_size>.npz` containing `params` plus a `metadata_json` blob (cache version, method name, world size, `keep_lengths`, `h`, `d`, the full angle array, method-specific config such as hyperbolic `a`). Any mismatch silently recomputes. Bump `CACHE_VERSION` when the meaning of `params` changes; extend `_method_configuration` when a new subclass gains a shape parameter that affects the result.

## Gotchas

- `SELECTED_METHOD` 13–16 (`balanced`) raise `ValueError: Unsupported method selected.` — `dist_field_balanced_tsunami` exists but its entry in `METHOD_FUNCS` is commented out.
- The `plot_*.py` figure scripts load a **different, older cache format**: `tsunami_angle_params_<world_size>.npz` with an `angles_deg` array and one array per method name. `precompute_tsunami_angle_params.py` does not produce that file; those scripts need it supplied separately.
- Experiment parameters are module-level constants duplicated across `render_grid.py`, `study_sideview.py`, `precompute_tsunami_angle_params.py`, and each `plot_*.py`. Changing e.g. `WORLD_SIZE` or `OBSERVER_H` means editing every file that participates, and invalidates the caches.
- `render_grid.py` builds `HyperbolicTsunami(a=world_size)` while `study_sideview.py` uses `a=0` (the degenerate straight-line case, explicitly handled in `derivative_at_t`) — the two scripts are not showing the same hyperbolic profile.
- Generated output (`tsunami_angle_params_*.npz`, `saved_panels/`, `distance_change_plots/`, `lifting_*_coverage_*.pdf`) is gitignored.
- Comments and TODO notes are a mix of English and Czech.
- The web page carries its own copy of the experiment parameters in `web/js/model.js` (`PARAMS`), taken from
  Table 1 of the paper — note `d_T` is 30 m there, whereas the Python scripts use `WORLD_SIZE/40 = 12.5`.
- The camera code keeps `render_grid.py`'s convention of the forward axis along +y; top views are drawn through
  `toPaperPlane` so that φ = 0 lies on the positive x-axis as the paper states.
