#!/usr/bin/env python3
"""Build the reviewer-facing quantitative and qualitative result pages."""

from __future__ import annotations

import csv
import html
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


def describe_csv(path: Path) -> str:
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.reader(stream)
        rows = sum(1 for _ in reader)
    return f"{max(0, rows - 1):,} data rows · CSV"


def describe_file(path: Path) -> str:
    size = path.stat().st_size
    if size >= 1024 * 1024:
        size_text = f"{size / (1024 * 1024):.1f} MB"
    elif size >= 1024:
        size_text = f"{size / 1024:.0f} KB"
    else:
        size_text = f"{size} bytes"
    return f"{size_text} · {path.suffix.lstrip('.').upper() or 'file'}"


def resource_grid(kind: str, source: Path, files: list[Path]) -> str:
    cards: list[str] = []
    previews: list[str] = []
    for index, path in enumerate(sorted(files)):
        relative = path.relative_to(source).as_posix()
        href = f"materials/{kind}/{relative}"
        label = html.escape(relative)
        if path.suffix.lower() == ".csv":
            preview_id = f"preview-{kind}-{index}"
            detail = describe_csv(path)
            action = (
                f'<button class="preview-button" type="button" data-csv="{href}" '
                f'aria-controls="{preview_id}" aria-expanded="false">Preview</button>'
            )
            previews.append(f'<div class="dataset-preview" id="{preview_id}" hidden></div>')
        else:
            detail = describe_file(path)
            action = ""
        cards.append(
            '<article class="resource-card">'
            f'<h4>{label}</h4><p>{html.escape(detail)}</p>'
            '<div class="resource-actions">'
            f'<a class="file-link" href="{href}" download>Download</a>{action}'
            '</div></article>'
        )
    return '<div class="resource-grid">' + "".join(cards + previews) + "</div>"


def insert_before(content: str, marker: str, addition: str) -> str:
    if marker not in content:
        raise ValueError(f"Expected generated heading not found: {marker}")
    return content.replace(marker, f"{addition}\n{marker}", 1)


def add_contextual_downloads(kind: str, source: Path, content: str) -> str:
    visible_files = [
        path
        for path in source.rglob("*")
        if path.is_file()
        and path.name != "_README.md"
        and not any(part.startswith(".") for part in path.relative_to(source).parts)
    ]
    if kind == "quantitative":
        overview_files = [path for path in visible_files if path.suffix.lower() != ".csv"]
        data_files = [path for path in visible_files if path.suffix.lower() == ".csv"]
        content = insert_before(
            content,
            '<h3 id="reproducibility">Reproducibility</h3>',
            resource_grid(kind, source, overview_files),
        )
        content = content.replace(
            '<h3 id="data-dictionary">Data dictionary</h3>',
            '<h3 id="data-dictionary">Data dictionary</h3>\n'
            + resource_grid(kind, source, data_files),
            1,
        )
        return content

    return insert_before(
        content,
        '<h3 id="confidentiality-boundary">Confidentiality Boundary</h3>',
        resource_grid(kind, source, visible_files),
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
