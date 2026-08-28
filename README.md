# Tsunami transformation demo

This repository contains a research prototype for visualizing **Tsunami transformations**: transformations that uplift a flat world while changing how distant parts of the world are seen by an observer.

The project implements several one-dimensional uplift profiles and applies them in radial, directional, mixed, and balanced variants. The main interactive demo renders a circular chessboard world before and after the transformation and shows corresponding side and top views.

## Main components

- `tsunami.py` — core implementation of the Tsunami transformations.
  - `ParabolicTsunami`
  - `HyperbolicTsunami`
  - `AngularTsunami`
  - `SphericalTsunami`
- `render_grid.py` — main interactive 2D/3D visualization of the transformed chessboard world.
- `study_sideview.py` — interactive side-view study of visibility, field of view, and lift evolution.
- `precompute_tsunami_angle_params.py` — computes and caches transformation parameters for prescribed lift angles.
- `plot_*.py` — scripts used for analysis and generation of figures.
- `description.qmd` — working text/notes accompanying the project.

## Interactive appendix (web)

`web/index.html` recreates the appendix of `paper/main.md` as an interactive page: the text is unchanged, and
each static figure is replaced by a live construction that responds to a profile selector and an uplift slider
shared by every figure. Two further pages, `web/quantitative-results.html` and `web/qualitative-results.html`,
carry the study results with dataset previews and download links.

Rebuild everything after editing the paper or anything under `web/`:

```bash
cd build
source build.sh
```

### Which file to open

The build produces three HTML outputs, in increasing order of self-containment:

| File | Contains | Needs the files around it |
|------|----------|---------------------------|
| `web/index.html` | interactive appendix | yes — `css/`, `js/`, `vendor/` |
| `web/appendix.html` | interactive appendix | no |
| `build/bundle/supplement.html` | appendix **and** both results pages | no |

All three open by double-click, with no web server. Use `web/index.html` while working on the page: it loads
the real `css/` and `js/` files, so a change shows up on reload without a rebuild.

### Sharing it offline

**`build/bundle/supplement.html` is the copy to send to anyone who will read the material offline** — a
reviewer, a collaborator, an artifact submission. It is a review artifact rather than part of the site, so it
is not committed; build it when you need it.

The reason is that a browser opening a `file://` page cannot always read the files sitting next to it, and
`web/index.html` needs ten of them, plus the KaTeX fonts those pull in. Two common situations break it:

- a sandboxed browser (Flatpak, Snap) is handed one file through the desktop's document portal and can see
  *only* that file;
- a reader clicks `index.html` inside a ZIP without extracting it first.

In both cases every relative stylesheet, script, and image fails to load and the page arrives as unstyled
text. The same restriction blocks `fetch()`, which is what the dataset preview buttons on the results pages
use, which is why the preview tables are rendered into the page ahead of time rather than loaded on click. A
reader who meets a broken page will assume the supplement is broken rather than debug it.

The bundle avoids all of it by embedding everything: the three pages become three views of one
document, with the CSS, JavaScript, KaTeX fonts, result figures, and downloadable datasets inlined. The dataset
preview tables are part of the markup already, so they open without loading anything.

```bash
node build/bundle/bundle.js          # everything embedded    (~11.4 MB)
node build/bundle/bundle.js --lean   # pages and figures only  (~4.8 MB)
```

Everything specific to the bundle lives in `build/bundle/`: the builder, its checker, and the two assets
(`extra.css`, `router.js`) it inlines. The output is written there too and is gitignored.

Both builds are fully readable; they differ only in whether the raw data travels with the file. The lean build
omits it — most of the weight is the 3.4 MB analysis notebook — so its download links resolve only when the
`web/` folder is present beside it. Verify either build with:

```bash
node build/bundle/check.js
```

which copies the bundle to an empty directory and opens it over `file://` with no browser permissions, so
anything that still depends on a neighbouring file shows up as a failure.

## Installation

The recommended way to run the project is with Conda or Miniconda.

Clone the repository and create the environment:

```bash
git clone <repository-url>
cd tsunami
conda env create -f environment.yml
conda activate tsunami
```

The environment uses Python 3.11 and installs the runtime dependencies needed by the current code.

## Quick start

Run the main interactive demo:

```bash
python render_grid.py
```

The window contains four panels:

1. original camera view,
2. camera view after the Tsunami transformation,
3. side view,
4. top view.

Use the sliders to change the viewing angle, azimuth, uplift level, and observer height. The radio buttons switch between radial, directional, mixed, and balanced application of the selected uplift profile.

### Keyboard shortcuts in `render_grid.py`

- `P` — save all four panels to `saved_panels/` as PDF, SVG, and PNG,
- `C` — open the contour visualization,
- `F` — toggle fullscreen mode.

## Selecting the transformation

The uplift profile used by the demo is currently selected in the source file near the beginning of `render_grid.py`:

```python
SELECTED_METHOD = 9
```

The available values are:

| Value | Uplift profile | Application |
|------:|----------------|-------------|
| 1 | Parabolic | radial |
| 2 | Hyperbolic | radial |
| 3 | Angular | radial |
| 4 | Spherical | radial |
| 5 | Parabolic | directional |
| 6 | Hyperbolic | directional |
| 7 | Angular | directional |
| 8 | Spherical | directional |
| 9 | Parabolic | mixed |
| 10 | Hyperbolic | mixed |
| 11 | Angular | mixed |
| 12 | Spherical | mixed |
| 13 | Parabolic | balanced |
| 14 | Hyperbolic | balanced |
| 15 | Angular | balanced |
| 16 | Spherical | balanced |

The default is currently `9`, i.e. the **mixed parabolic** variant.

For `study_sideview.py`, the profile is selected separately using `SELECTED_METHOD` with values 1–4 (Parabolic, Hyperbolic, Angular, Spherical).

## Side-view study

Run:

```bash
python study_sideview.py
```

This visualization compares visible distances in the original and transformed worlds and displays color strips representing the visible chessboard tiles.

Use the sliders to change the viewing angle, lift angle, and observer height.

Keyboard shortcut:

- `E` — open the evolution of the Tsunami visibility strip over the lift levels.

## Precomputing uplift parameters

Some interactive analyses need parameters that map prescribed end-of-world lift angles to individual Tsunami profiles. They can be precomputed with:

```bash
python precompute_tsunami_angle_params.py
```

The script stores generated cache files named approximately

```text
tsunami_angle_params_<Method>_<world-size>.npz
```

The cache is regenerated automatically when its metadata is incompatible with the current settings.

These generated `.npz` files are intentionally ignored by Git.

## Figure-generation scripts

The repository also contains scripts used for experiments and figures:

- `plot_observer_distance_change.py`
- `plot_tsunami_angle_params.py`
- `plot_tsunami_angle_params_colorbar.py`
- `plot_tsunami_fov_coverage_with_endpoints.py`

These are research/analysis scripts rather than the main entry point. Some of them expect precomputed parameter files corresponding to the constants configured at the beginning of the script.

## Project parameters

The current demos keep their experiment settings as constants near the beginning of the corresponding Python file. Important parameters include:

- observer height,
- world size,
- camera focal length and pixel size,
- field of view / viewing angle,
- tile size,
- selected Tsunami profile and application method.

This makes experiments easy to reproduce, but changing these values currently requires editing the script.

## Generated files

The project may generate:

- `tsunami_angle_params_*.npz` — cached uplift parameters,
- `saved_panels/` — images exported from `render_grid.py`,
- `distance_change_plots/` — generated analysis figures,
- `lifting_*_coverage_*.pdf` and other plot outputs.

These files are excluded from version control by `.gitignore` unless explicitly added.

## Troubleshooting

### Interactive Matplotlib window does not open

The Conda environment includes Tk so that Matplotlib can use a GUI backend without requiring a full IDE installation. On Linux, verify that you are running the script from a graphical desktop session.

### Recreate the environment

If dependencies become inconsistent, remove and recreate the environment:

```bash
conda deactivate
conda env remove -n tsunami
conda env create -f environment.yml
conda activate tsunami
```

## Development status

This is a research prototype under active development. The public API and experiment scripts may change as the transformation methods are refined.
