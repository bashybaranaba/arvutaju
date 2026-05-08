#!/usr/bin/env python3
"""
Render workbook source PDFs into queryable app assets.

This script creates:
- full-page PNG renders under public/images/workbooks/part-*/pages/
- per-task PNGs under public/images/tasks/
- per-strategy-page PNGs under public/images/workbooks/part-*/strategies/
- public/images/workbooks/manifest.generated.json with dimensions/checksums

Per-task images use the optional "crop" box from scripts/workbook-assets.json.
The manifest keeps both printed workbook page numbers and physical PDF page
numbers. Crop values are PDF points from the top-left of the physical PDF page.
If no crop is present, the task image falls back to the full source page so
every DB task still has a real workbook image and an exact page reference.
Strategy page images are the source pages headed "Ülesande lahendusstrateegiaid".
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

try:
    import fitz  # PyMuPDF
except ModuleNotFoundError:
    print(
        "PyMuPDF is required. Install it with: python3 -m pip install pymupdf",
        file=sys.stderr,
    )
    raise


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "scripts" / "workbook-assets.json"
PUBLIC_ROOT = ROOT / "public"
TASK_IMAGE_DIR = PUBLIC_ROOT / "images" / "tasks"


def page_name(page: int) -> str:
    return f"page-{page:03d}.png"


def public_url(path: Path) -> str:
    return "/" + path.relative_to(PUBLIC_ROOT).as_posix()


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def render_page(doc: fitz.Document, page_number: int, out_path: Path, dpi: int) -> dict[str, Any]:
    page = doc.load_page(page_number - 1)
    pix = page.get_pixmap(dpi=dpi, alpha=False)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    pix.save(out_path)
    return {
        "width": pix.width,
        "height": pix.height,
        "checksum": sha256(out_path),
    }


def render_task_image(
    doc: fitz.Document,
    page_number: int,
    task: dict[str, Any],
    out_path: Path,
    dpi: int,
) -> dict[str, Any]:
    page = doc.load_page(page_number - 1)
    crop = task.get("crop")
    clip = None
    if crop:
        x = crop["x"]
        y = crop["y"]
        clip = fitz.Rect(x, y, x + crop["width"], y + crop["height"])

    pix = page.get_pixmap(dpi=dpi, alpha=False, clip=clip)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    pix.save(out_path)
    return {
        "width": pix.width,
        "height": pix.height,
        "checksum": sha256(out_path),
        "crop": crop,
    }


def sort_strategy_pages(strategy_pages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        strategy_pages,
        key=lambda page: (page.get("page", 0), page.get("pdfPage", page.get("page", 0))),
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--dpi", type=int, default=180)
    args = parser.parse_args()

    config = json.loads(args.manifest.read_text())
    workbooks = config["workbooks"]
    tasks = config["tasks"]

    docs: dict[str, fitz.Document] = {}
    generated: dict[str, Any] = {"workbooks": {}, "tasks": []}

    try:
        for part, workbook in workbooks.items():
            pdf_path = Path(workbook["pdfPath"]).expanduser()
            if not pdf_path.exists():
                raise FileNotFoundError(f"Missing PDF for workbook {part}: {pdf_path}")

            doc = fitz.open(pdf_path)
            docs[part] = doc
            generated["workbooks"][part] = {
                "title": workbook["title"],
                "pdfName": workbook["pdfName"],
                "pageCount": doc.page_count,
                "pages": [],
            }

        pages_needed = sorted(
            {
                (task["workbookPart"], task["page"], task.get("pdfPage", task["page"]))
                for task in tasks
            }
        )
        strategy_pages_needed = sorted(
            {
                (
                    strategy_page["workbookPart"],
                    strategy_page["page"],
                    strategy_page.get("pdfPage", strategy_page["page"]),
                )
                for strategy_page in config.get("strategyPages", [])
            }
            | {
                (
                    task["workbookPart"],
                    strategy_page["page"],
                    strategy_page.get("pdfPage", strategy_page["page"]),
                )
                for task in tasks
                for strategy_page in task.get("strategyPages", [])
            }
        )
        page_assets: dict[tuple[str, int], dict[str, Any]] = {}
        strategy_assets: dict[tuple[str, int], dict[str, Any]] = {}

        for part, printed_page, pdf_page in pages_needed:
            workbook = workbooks[part]
            out_path = ROOT / workbook["outputDir"] / "pages" / page_name(printed_page)
            meta = render_page(docs[part], pdf_page, out_path, args.dpi)
            asset = {
                "kind": "page",
                "page": printed_page,
                "pdfPage": pdf_page,
                "url": public_url(out_path),
                "sourcePdfName": workbook["pdfName"],
                **meta,
            }
            page_assets[(part, printed_page)] = asset
            generated["workbooks"][part]["pages"].append(asset)

        for part, printed_page, pdf_page in strategy_pages_needed:
            workbook = workbooks[part]
            out_path = ROOT / workbook["outputDir"] / "strategies" / page_name(printed_page)
            meta = render_page(docs[part], pdf_page, out_path, args.dpi)
            asset = {
                "kind": "strategy",
                "page": printed_page,
                "pdfPage": pdf_page,
                "url": public_url(out_path),
                "label": f"Ülesande lahendusstrateegiaid, page {printed_page}",
                "sourcePdfName": workbook["pdfName"],
                **meta,
            }
            strategy_assets[(part, printed_page)] = asset
            generated["workbooks"][part].setdefault("strategyPages", []).append(asset)

        for task in tasks:
            part = task["workbookPart"]
            workbook = workbooks[part]
            printed_page = task["page"]
            pdf_page = task.get("pdfPage", printed_page)
            task_strategy_assets = [
                strategy_assets[(part, strategy_page["page"])]
                for strategy_page in sort_strategy_pages(task.get("strategyPages", []))
            ]
            out_path = TASK_IMAGE_DIR / f"{task['slug']}.png"
            meta = render_task_image(docs[part], pdf_page, task, out_path, args.dpi)
            ordered_assets = [
                {
                    **page_assets[(part, printed_page)],
                    "order": 0,
                },
                {
                    "kind": "task",
                    "page": printed_page,
                    "pdfPage": pdf_page,
                    "order": 1,
                    "url": public_url(out_path),
                    "sourcePdfName": workbook["pdfName"],
                    **meta,
                },
                *[
                    {
                        **asset,
                        "order": index + 2,
                    }
                    for index, asset in enumerate(task_strategy_assets)
                ],
            ]
            generated["tasks"].append(
                {
                    "slug": task["slug"],
                    "workbookPart": part,
                    "sourcePdfName": workbook["pdfName"],
                    "sourcePageNumber": printed_page,
                    "sourcePdfPageNumber": pdf_page,
                    "pageImageUrl": page_assets[(part, printed_page)]["url"],
                    "imageUrl": public_url(out_path),
                    "strategyImageUrls": [asset["url"] for asset in ordered_assets if asset["kind"] == "strategy"],
                    "assets": ordered_assets,
                }
            )
    finally:
        for doc in docs.values():
            doc.close()

    out_manifest = PUBLIC_ROOT / "images" / "workbooks" / "manifest.generated.json"
    out_manifest.parent.mkdir(parents=True, exist_ok=True)
    out_manifest.write_text(json.dumps(generated, ensure_ascii=False, indent=2) + "\n")
    print(f"Wrote {out_manifest}")
    print(
        f"Rendered {len(pages_needed)} task pages, "
        f"{len(strategy_pages_needed)} strategy pages, and {len(tasks)} task images"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
