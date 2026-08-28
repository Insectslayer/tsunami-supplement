#!/usr/bin/env python3
"""Build the reviewer-facing quantitative and qualitative result pages."""

from __future__ import annotations

import html
import csv
import json
import re
import shutil
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
SOURCE_ROOT = Path("/Users/vitek/Documents/TSUNAMI")
EXTERNAL_SOURCES = {
    "quantitative": SOURCE_ROOT / "quantitative_supplement",
    "qualitative": SOURCE_ROOT / "qualitative_supplement",
}


def slugify(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value or "section"


def inline_markup(value: str) -> str:
    value = html.escape(value, quote=False)
    code = []

    def hold_code(match: re.Match[str]) -> str:
        code.append(f"<code>{match.group(1)}</code>")
        return f"\x00CODE{len(code) - 1}\x00"

    value = re.sub(r"`([^`]+)`", hold_code, value)
    value = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", value)
    value = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", value)
    for index, fragment in enumerate(code):
        value = value.replace(f"\x00CODE{index}\x00", fragment)
    return value


def markdown_to_html(source: str) -> str:
    lines = source.splitlines()
    output: list[str] = []
    paragraph: list[str] = []
    list_tag: str | None = None
    in_code = False
    code_lines: list[str] = []
    used_ids: dict[str, int] = {}

    def flush_paragraph() -> None:
        if paragraph:
            output.append(f"<p>{inline_markup(' '.join(part.strip() for part in paragraph))}</p>")
            paragraph.clear()

    def close_list() -> None:
        nonlocal list_tag
        if list_tag:
            output.append(f"</{list_tag}>")
            list_tag = None

    for line in lines:
        if line.startswith("```"):
            flush_paragraph()
            close_list()
            if in_code:
                output.append(f"<pre><code>{html.escape(chr(10).join(code_lines))}</code></pre>")
                code_lines.clear()
            in_code = not in_code
            continue
        if in_code:
            code_lines.append(line)
            continue
        heading = re.match(r"^(#{1,4})\s+(.+)$", line)
        if heading:
            flush_paragraph()
            close_list()
            level = min(4, len(heading.group(1)) + 1)
            title = heading.group(2).strip()
            base = slugify(re.sub(r"[`*_]", "", title))
            count = used_ids.get(base, 0)
            used_ids[base] = count + 1
            identifier = base if count == 0 else f"{base}-{count + 1}"
            output.append(f'<h{level} id="{identifier}">{inline_markup(title)}</h{level}>')
            continue
        item = re.match(r"^\s*([-*]|\d+\.)\s+(.+)$", line)
        if item:
            flush_paragraph()
            wanted = "ol" if item.group(1)[0].isdigit() else "ul"
            if list_tag != wanted:
                close_list()
                list_tag = wanted
                output.append(f"<{list_tag}>")
            output.append(f"<li>{inline_markup(item.group(2))}</li>")
            continue
        if re.match(r"^\s*---+\s*$", line):
            flush_paragraph()
            close_list()
            output.append("<hr>")
            continue
        if not line.strip():
            flush_paragraph()
            close_list()
            continue
        paragraph.append(line)

    flush_paragraph()
    close_list()
    if code_lines:
        output.append(f"<pre><code>{html.escape(chr(10).join(code_lines))}</code></pre>")
    return "\n".join(output)


def file_controls(
    kind: str,
    source: Path,
    path: Path,
    *,
    label: bool = False,
    href_override: str | None = None,
) -> str:
    relative = path.relative_to(source).as_posix()
    href = href_override or f"materials/{kind}/{relative}"
    identifier = f"preview-{kind}-{slugify(relative)}"
    name = f'<span class="file-name">{html.escape(relative)}</span>' if label else ""
    preview = ""
    panel = ""
    if path.suffix.lower() == ".csv":
        preview = (
            f'<button class="preview-button" type="button" data-csv="{href}" '
            f'aria-controls="{identifier}" aria-expanded="false">Preview</button>'
        )
        panel = f'<div class="dataset-preview" id="{identifier}" hidden></div>'
    return (
        f'<div class="context-file-actions">{name}'
        f'{preview}<a class="file-link" href="{href}" download>Download</a></div>{panel}'
    )


def append_to_list_item(content: str, needle: str, addition: str) -> str:
    start = content.find(needle)
    if start < 0:
        raise ValueError(f"Expected file description not found: {needle}")
    end = content.find("</li>", start)
    if end < 0:
        raise ValueError(f"List item does not close after: {needle}")
    return content[:end] + addition + content[end:]


def append_after_description(content: str, heading_id: str, addition: str) -> str:
    marker = f'id="{heading_id}"'
    start = content.find(marker)
    if start < 0:
        raise ValueError(f"Expected dataset heading not found: {heading_id}")
    paragraph_end = content.find("</p>", start)
    if paragraph_end < 0:
        raise ValueError(f"Dataset description does not follow: {heading_id}")
    paragraph_end += len("</p>")
    return content[:paragraph_end] + addition + content[paragraph_end:]


def insert_before_heading(content: str, heading_id: str, addition: str) -> str:
    marker = f'id="{heading_id}"'
    marker_start = content.find(marker)
    if marker_start < 0:
        raise ValueError(f"Expected result heading not found: {heading_id}")
    heading_start = content.rfind("<h", 0, marker_start)
    if heading_start < 0:
        raise ValueError(f"Cannot locate heading start for: {heading_id}")
    return content[:heading_start] + addition + content[heading_start:]


def result_figures(*figures: tuple[str, str, str]) -> str:
    blocks = []
    compact_figures = {
        "rq1_precision_200m_scatter.svg",
        "rq3_csq_change.svg",
        "rq3_workload.svg",
    }
    for filename, alt, caption in figures:
        href = f"materials/quantitative/figures/{filename}"
        compact_class = " result-figure--compact" if filename in compact_figures else ""
        blocks.append(
            f'<figure class="result-figure{compact_class}">'
            f'<a href="{href}" target="_blank" rel="noopener">'
            f'<img src="{href}" alt="{html.escape(alt)}" loading="lazy"></a>'
            f'<figcaption>{html.escape(caption)}</figcaption>'
            '</figure>'
        )
    return '<div class="result-figure-grid">' + "".join(blocks) + "</div>\n"


def interactive_precision_scatter(precision_csv: Path) -> str:
    points = []
    truthy = {"true", "1", "yes"}
    with precision_csv.open(encoding="utf-8", newline="") as stream:
        for row in csv.DictReader(stream):
            if int(float(row["Distance"])) != 200:
                continue
            if row["RecommendedExclude"].strip().lower() in truthy:
                continue
            if row["RepeatedFailureTrialExclude"].strip().lower() in truthy:
                continue
            points.append({
                "method": row["Method"].strip().lower(),
                "x": round(float(row["LandingPos_x"]) + 68.3, 6),
                "z": round(float(row["LandingPos_z"]), 6),
            })
    encoded_points = html.escape(
        json.dumps(points, ensure_ascii=True, separators=(",", ":")), quote=True
    )
    return f'''<div class="result-figure-grid">
<figure class="result-figure result-figure--compact interactive-scatter"
        data-points="{encoded_points}">
  <div class="interactive-chart" role="img"
       aria-label="Interactive target-centred landing positions for the 200 metre Precision Task target"></div>
  <div class="interactive-legend" aria-label="Toggle teleportation methods"></div>
  <figcaption>Interactive counterpart: select a legend item to show or hide a teleportation method.</figcaption>
</figure>
</div>\n'''


def add_contextual_downloads(kind: str, source: Path, content: str) -> str:
    if kind == "quantitative":
        for filename in (
            "Tsunami_quantitative_analysis.ipynb",
            "TSUNAMI_quantitative_figures.ipynb",
            "requirements.txt",
        ):
            content = append_to_list_item(
                content,
                f"<code>{filename}</code>",
                file_controls(kind, source, source / filename),
            )

        datasets = {
            "cityraceaggregated-csv": ["city_race_aggregated.csv"],
            "cityraceorientationevents-csv": ["city_race_orientation_events.csv"],
            "cityraceprecision200to500m-csv": ["city_race_precision_200_to_500m.csv"],
            "cityracecheckpointapproachepisodes-csv": ["city_race_checkpoint_approach_episodes.csv"],
            "precision-csv": ["precision.csv"],
            "precisionexclusiondecisions-csv": ["precision_exclusion_decisions.csv"],
            "questionnairebaseline-csv-questionnaireminimap-csv-questionnairetsunami-csv": [
                "questionnaire_baseline.csv",
                "questionnaire_minimap.csv",
                "questionnaire_tsunami.csv",
            ],
            "questionnairecybersickness-csv": ["questionnaire_cybersickness.csv"],
            "questionnaireraw-tlx-csv": ["questionnaire_raw-tlx.csv"],
            "questionnairesbsod-csv": ["questionnaire_sbsod.csv"],
            "questionnairedemography-csv": ["questionnaire_demography.csv"],
            "questionnairepreferences-csv": ["questionnaire_preferences.csv"],
        }
        for heading_id, filenames in datasets.items():
            controls = "".join(
                file_controls(
                    kind,
                    source,
                    source / "input" / filename,
                    label=len(filenames) > 1,
                )
                for filename in filenames
            )
            content = append_after_description(content, heading_id, controls)

        content = append_after_description(
            content,
            "detailed-questionnaire-wording",
            file_controls(kind, source, source / "study_questionnaire.md"),
        )

        figure_sections = (
            ("interaction-effort-and-path-efficiency", result_figures(
                ("rq1_city_race_completion_times.svg",
                 "Boxplots of net and total City Race completion time by route and method.",
                 "City Race net and total completion-time distributions by route and locomotion method."),
            )),
            ("controlled-landing-precision-and-interaction-time", result_figures(
                ("rq1_interaction_efficiency.svg",
                 "Boxplots of teleport counts and path efficiency by method.",
                 "Participant-level interaction effort and path-efficiency distributions."),
            )),
            ("city-race-landing-accuracy", result_figures(
                ("rq1_precision_landing_error.svg",
                 "Precision Task landing-error boxplots for 50, 100, and 200 metre targets.",
                 "Controlled Precision Task landing error after failed-manipulation exclusions."),
                ("rq1_precision_timing.svg",
                 "Precision Task aiming and completion-time boxplots by distance and method.",
                 "Controlled Precision Task aim-to-teleport and completion-time distributions."),
                ("rq1_precision_200m_scatter.svg",
                 "Target-centred scatterplot of Precision Task landings at 200 metres.",
                 "Target-centred landing positions for the 200 m Precision Task target."),
            ) + interactive_precision_scatter(source / "input" / "precision.csv")),
            ("rq2-spatial-awareness", result_figures(
                ("rq1_city_direct_landing_error.svg",
                 "City Race direct-checkpoint landing-error boxplots by distance band and method.",
                 "Direct successful checkpoint landing error in the two mutually exclusive distance bands."),
                ("rq1_city_direct_landing_scatter.svg",
                 "Target-centred City Race direct-checkpoint landing scatterplots.",
                 "Target-centred positions for successful direct long-range checkpoint landings."),
                ("rq1_checkpoint_approach.svg",
                 "Checkpoint-approach first landing error and correction-count boxplots.",
                 "First-landing error and corrective teleport counts across complete checkpoint approaches."),
                ("rq1_checkpoint_approach_log.svg",
                 "Checkpoint-approach first landing error and correction-count boxplots with logarithmic axes.",
                 "Alternative scale view: landing error uses a logarithmic axis; correction count uses a symmetric-log axis so zero-correction episodes remain visible."),
                ("rq1_checkpoint_approach_scatter.svg",
                 "Target-centred first-landing scatterplots for complete checkpoint approaches.",
                 "Target-centred first landings before any corrective teleport in complete checkpoint approaches."),
            )),
            ("h2-2-subjective-spatial-awareness", result_figures(
                ("rq2_reorientation_awareness.svg",
                 "Boxplots of behavioral re-engagement and subjective spatial-awareness outcomes.",
                 "Landing-to-confirmation behavior and subjective spatial-awareness outcomes for Tsunami and Minimap."),
            )),
            ("rq3-usability-trade-offs", result_figures(
                ("rq2_spatial_rating_distributions.svg",
                 "Diverging stacked bars for the spatial-awareness questionnaire items.",
                 "Response distributions for the spatial-awareness and environmental-continuity items."),
            )),
            ("h3-2-perceived-workload", result_figures(
                ("rq3_csq_change.svg",
                 "Boxplot of within-session CSQ-VR change by locomotion method.",
                 "Within-session cybersickness change associated with each method."),
                ("rq3_csq_timecourse.svg",
                 "Individual trajectories and boxplots of CSQ-VR total scores over the experiment.",
                 "Descriptive CSQ-VR total-score development across the four measurement occasions."),
            )),
            ("usability-distance-awareness-and-preferences", result_figures(
                ("rq3_workload.svg",
                 "Boxplot of RAW-TLX workload by method.",
                 "Participant-level perceived-workload distributions."),
            )),
            ("statistical-diagnostics-and-sensitivity-analyses", result_figures(
                ("rq3_usability_rating_distributions.svg",
                 "Diverging stacked bars for usability and distance-awareness questionnaire items.",
                 "Response distributions for distance awareness, ease of learning, and intuitive use."),
                ("rq3_preference_rankings.svg",
                 "Stacked bars of first, second, and third place rankings by question and method.",
                 "Overall preference, comfort, intuitiveness, and fun ranking distributions."),
            )),
        )
        for next_heading, figures in figure_sections:
            content = insert_before_heading(content, next_heading, figures)
        return content

    for filename in (
        "corpus_summary.csv",
        "codebook.csv",
        "coding_matrix_anonymized.csv",
        "theme_summary.csv",
        "quotation_audit.csv",
        "quant_qual_integration.csv",
    ):
        content = append_to_list_item(
            content,
            f"<code>{filename}</code>",
            file_controls(kind, source, source / filename),
        )
    questionnaire = source.parent / "quantitative" / "study_questionnaire.md"
    return append_to_list_item(
        content,
        "study_questionnaire.md",
        file_controls(
            "quantitative",
            source.parent / "quantitative",
            questionnaire,
            href_override="materials/quantitative/study_questionnaire.md",
        ),
    )


def page(kind: str, title: str, lede: str, content: str) -> str:
    current = {
        name: (' aria-current="page"' if name == kind else "")
        for name in (*EXTERNAL_SOURCES, "appendix")
    }
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)} — Tsunami Supplement</title>
<meta name="description" content="{html.escape(lede)}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>&#127754;</text></svg>">
<link rel="stylesheet" href="css/style.css">
</head>
<body class="results-page">
<nav class="site-nav" aria-label="Supplement sections">
  <a href="index.html"{current['appendix']}>Interactive appendix</a>
  <a href="quantitative-results.html"{current['quantitative']}>Quantitative results</a>
  <a href="qualitative-results.html"{current['qualitative']}>Qualitative results</a>
</nav>
<header class="masthead">
  <p class="eyebrow">Reviewer-facing supplementary material</p>
  <h1>{html.escape(title)}</h1>
  <p class="lede">{html.escape(lede)}</p>
</header>
<nav class="toc" id="toc" aria-label="Contents"></nav>
<main class="paper">
  <div class="download-banner">
    <p><strong>Complete supplementary package</strong><br>Quantitative and qualitative materials in one archive.</p>
    <a class="download-link" href="downloads/TSUNAMI_supplementary_materials.zip" download>Download ZIP</a>
  </div>
  {content}
</main>
<footer class="page-footer"><p>TSUNAMI user study supplementary materials.</p></footer>
<script src="js/results.js"></script>
</body>
</html>'''


def build() -> None:
    materials = WEB / "materials"
    downloads = WEB / "downloads"
    if all(source.is_dir() for source in EXTERNAL_SOURCES.values()):
        if materials.exists():
            shutil.rmtree(materials)
        materials.mkdir(parents=True)
        for kind, source in EXTERNAL_SOURCES.items():
            shutil.copytree(
                source,
                materials / kind,
                ignore=shutil.ignore_patterns(".*", "__MACOSX"),
            )
    elif not all((materials / kind).is_dir() for kind in EXTERNAL_SOURCES):
        raise FileNotFoundError(
            "Neither the local source supplements nor the distributed web/materials copies are complete."
        )
    downloads.mkdir(parents=True, exist_ok=True)

    sources = {kind: materials / kind for kind in EXTERNAL_SOURCES}
    for kind, source in sources.items():
        markdown = (source / "_README.md").read_text(encoding="utf-8")
        if kind == "qualitative":
            markdown = markdown.replace(
                "../quantitative_supplement/study_questionnaire.md",
                "materials/quantitative/study_questionnaire.md",
            )
        title = "Quantitative study results" if kind == "quantitative" else "Qualitative study results"
        lede = (
            "Analysis-ready data, reproducible statistical analyses, and interpretation of the complete quantitative study."
            if kind == "quantitative"
            else "Qualitative methods, analytical framework, supporting tables, and interpretation of participant accounts."
        )
        content = add_contextual_downloads(kind, source, markdown_to_html(markdown))
        output = page(kind, title, lede, content)
        (WEB / f"{kind}-results.html").write_text(output, encoding="utf-8")

    archive = downloads / "TSUNAMI_supplementary_materials.zip"
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
        for kind, source in sources.items():
            for path in sorted(source.rglob("*")):
                if path.is_file() and not any(
                    part.startswith(".") for part in path.relative_to(source).parts
                ):
                    relative = Path(f"{kind}_supplement") / path.relative_to(source)
                    bundle.write(path, relative.as_posix())
    print(f"Built result pages and {archive.relative_to(ROOT)}")


if __name__ == "__main__":
    build()
