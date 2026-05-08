# Workbook Ingestion

The app treats the two "Mõtlemine nähtavaks!" PDFs as source repositories. MongoDB stores the task metadata plus stable image URLs and provenance; the image files themselves live under `public/images/...` so Next can serve them efficiently.

## Current Source PDFs

| Part | PDF | Pages |
| --- | --- | --- |
| I | `/Users/bashybaranaba/Desktop/Õpetaja juhendmaterjal_pdf.pdf` | 48 |
| II | `/Users/bashybaranaba/Desktop/Õpetaja juhendmaterjal_II.pdf` | 70 |

The source mapping is in `scripts/workbook-assets.json`.

## Extraction Flow

1. Install the renderer dependency once:

```bash
python3 -m pip install pymupdf
```

2. Render workbook assets:

```bash
npm run extract:workbooks
```

This runs `scripts/extract-workbook-images.py`, which uses PyMuPDF to:

- render each referenced PDF page to `public/images/workbooks/part-*/pages/page-###.png`
- create a per-task image in `public/images/tasks/{slug}.png`
- write `public/images/workbooks/manifest.generated.json` with image URLs, dimensions, checksums, source PDF names, and page references

If a task entry has a `crop` box, the per-task image is cropped from the page. If it does not, the task image is the full page render. That fallback keeps every task connected to the actual workbook page while we tune exact crop boxes.

3. Re-seed MongoDB:

```bash
npx tsx scripts/seed.ts
```

`scripts/seed.ts` reads `manifest.generated.json` when it exists and stores:

- `workbookPart`
- `workbookTitle`
- `sourcePdfName`
- `sourcePageNumber`
- `pageImageUrl`
- `imageUrl`
- `workbookAssets[]`

## Crop Coordinates

Crop boxes in `scripts/workbook-assets.json` use PDF points from the top-left of the page:

```json
{
  "slug": "loendamine-tapid",
  "workbookPart": "I",
  "page": 4,
  "crop": { "x": 64, "y": 120, "width": 470, "height": 360 }
}
```

The generated manifest records the crop and resulting pixel dimensions, which makes the database queryable by task, source page, and asset type.
