import { readFileSync } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI ?? "";

if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI in environment");
  process.exit(1);
}

interface ManifestAsset {
  kind: string;
  url: string;
  page: number;
  pdfPage?: number;
  order?: number;
  sourcePdfName?: string;
}

interface ManifestTask {
  slug: string;
  workbookPart: "I" | "II";
  sourcePdfName: string;
  sourcePageNumber: number;
  sourcePdfPageNumber: number;
  pageImageUrl: string;
  imageUrl: string;
  strategyImageUrls: string[];
  assets: ManifestAsset[];
}

interface DbTask {
  slug: string;
  workbookPart?: "I" | "II";
  sourcePdfName?: string;
  sourcePageNumber?: number;
  sourcePdfPageNumber?: number;
  pageImageUrl?: string;
  imageUrl?: string;
  strategyImageUrls?: string[];
  workbookAssets?: ManifestAsset[];
}

function comparableAssets(assets: ManifestAsset[] = []) {
  return assets
    .map((asset) => ({
      kind: asset.kind,
      url: asset.url,
      page: asset.page,
      pdfPage: asset.pdfPage,
      order: asset.order,
      sourcePdfName: asset.sourcePdfName,
    }))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

async function main() {
  const manifestPath = path.join(
    process.cwd(),
    "public/images/workbooks/manifest.generated.json"
  );
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    tasks: ManifestTask[];
  };
  const expectedBySlug = new Map(manifest.tasks.map((task) => [task.slug, task]));

  await mongoose.connect(MONGODB_URI);
  const TaskSchema = new mongoose.Schema({}, { strict: false });
  const Task = mongoose.models.Task ?? mongoose.model("Task", TaskSchema);
  const dbTasks = (await Task.find({}, { embedding: 0 }).lean()) as DbTask[];
  const dbBySlug = new Map(dbTasks.map((task) => [task.slug, task]));
  const issues: string[] = [];

  for (const expected of manifest.tasks) {
    const actual = dbBySlug.get(expected.slug);
    if (!actual) {
      issues.push(`${expected.slug}: missing from DB`);
      continue;
    }

    const scalarKeys = [
      "workbookPart",
      "sourcePdfName",
      "sourcePageNumber",
      "sourcePdfPageNumber",
      "pageImageUrl",
      "imageUrl",
    ] as const;

    for (const key of scalarKeys) {
      if (actual[key] !== expected[key]) {
        issues.push(
          `${expected.slug}: ${key} DB=${JSON.stringify(actual[key])} expected=${JSON.stringify(expected[key])}`
        );
      }
    }

    if (JSON.stringify(actual.strategyImageUrls ?? []) !== JSON.stringify(expected.strategyImageUrls ?? [])) {
      issues.push(`${expected.slug}: strategyImageUrls mismatch`);
    }

    if (
      JSON.stringify(comparableAssets(actual.workbookAssets ?? [])) !==
      JSON.stringify(comparableAssets(expected.assets ?? []))
    ) {
      issues.push(`${expected.slug}: workbookAssets mismatch`);
    }
  }

  for (const actual of dbTasks) {
    if (!expectedBySlug.has(actual.slug)) {
      issues.push(`${actual.slug}: exists in DB but not in generated workbook manifest`);
    }
  }

  if (issues.length > 0) {
    console.log(`DB workbook asset audit failed: ${issues.length} issue(s)`);
    for (const issue of issues) console.log(`- ${issue}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(
    `DB workbook asset audit passed: ${dbTasks.length} DB task(s), ${manifest.tasks.length} manifest task(s).`
  );
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
