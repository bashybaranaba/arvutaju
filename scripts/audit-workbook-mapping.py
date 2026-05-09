#!/usr/bin/env python3
"""Audit task-to-workbook-page and task-to-strategy-page mappings."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "scripts" / "workbook-assets.json"
MANIFEST_PATH = ROOT / "public" / "images" / "workbooks" / "manifest.generated.json"


def page_text(doc: fitz.Document, pdf_page: int) -> str:
    return " ".join(doc.load_page(pdf_page - 1).get_text("text").split())


def main() -> int:
    config = json.loads(CONFIG_PATH.read_text())
    manifest = json.loads(MANIFEST_PATH.read_text())
    manifest_tasks = {task["slug"]: task for task in manifest["tasks"]}
    errors: list[str] = []

    docs = {
        part: fitz.open(workbook["pdfPath"])
        for part, workbook in config["workbooks"].items()
    }

    try:
        for task in config["tasks"]:
            slug = task["slug"]
            part = task["workbookPart"]
            doc = docs[part]
            task_text = page_text(doc, task["pdfPage"])
            if (
                not task_text
                or task_text.startswith("Ülesande lahendusstrateegiaid")
                or task_text.startswith("Õppesisust lähtuvad märksõnad")
            ):
                errors.append(
                    f"{slug}: task page {task['page']} / PDF {task['pdfPage']} does not look like a task page: {task_text[:80]!r}"
                )

            strategy_pages = task.get("strategyPages", [])
            if not strategy_pages:
                errors.append(f"{slug}: has no strategyPages mapping")

            for strategy_page in strategy_pages:
                strategy_text = page_text(doc, strategy_page["pdfPage"])
                if not strategy_text.startswith("Ülesande lahendusstrateegiaid"):
                    errors.append(
                        f"{slug}: strategy page {strategy_page['page']} / PDF {strategy_page['pdfPage']} does not start with strategy heading"
                    )
                if strategy_page["pdfPage"] <= task["pdfPage"]:
                    errors.append(
                        f"{slug}: strategy PDF page {strategy_page['pdfPage']} is not after task PDF page {task['pdfPage']}"
                    )

            manifest_task = manifest_tasks.get(slug)
            if not manifest_task:
                errors.append(f"{slug}: missing from generated manifest")
                continue

            strategy_assets = [
                asset
                for asset in sorted(manifest_task["assets"], key=lambda asset: asset["order"])
                if asset["kind"] == "strategy"
            ]
            mapped_strategy_pages = [page["page"] for page in strategy_pages]
            manifest_strategy_pages = [asset["page"] for asset in strategy_assets]
            if manifest_strategy_pages != mapped_strategy_pages:
                errors.append(
                    f"{slug}: manifest strategy pages {manifest_strategy_pages} != config strategy pages {mapped_strategy_pages}"
                )

            orders = [asset["order"] for asset in manifest_task["assets"]]
            if orders != sorted(orders):
                errors.append(f"{slug}: manifest asset order is not sorted: {orders}")

            kinds = [
                asset["kind"]
                for asset in sorted(manifest_task["assets"], key=lambda asset: asset["order"])
            ]
            if kinds[:2] != ["page", "task"]:
                errors.append(f"{slug}: first assets should be page/task, got {kinds[:2]}")

        if errors:
            print("Workbook mapping audit failed:")
            for error in errors:
                print(f"- {error}")
            return 1

        print(f"Workbook mapping audit passed for {len(config['tasks'])} mapped tasks.")
        return 0
    finally:
        for doc in docs.values():
            doc.close()


if __name__ == "__main__":
    sys.exit(main())
