import { readFileSync } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI ?? "";

if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI in environment");
  process.exit(1);
}

interface GeneratedTaskAsset {
  slug: string;
  workbookPart: "I" | "II";
  sourcePdfName: string;
  sourcePageNumber: number;
  sourcePdfPageNumber: number;
  pageImageUrl: string;
  imageUrl: string;
  strategyImageUrls: string[];
  assets: Array<Record<string, unknown>>;
}

const TaskSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    workbookPart: String,
    workbookTitle: String,
    sourcePdfName: String,
    sourcePageNumber: Number,
    sourcePdfPageNumber: Number,
    pageImageUrl: String,
    strategyImageUrls: [String],
    imageUrl: String,
    workbookAssets: [mongoose.Schema.Types.Mixed],
  },
  { timestamps: true, strict: false }
);

async function main() {
  const manifestPath = path.join(
    process.cwd(),
    "public/images/workbooks/manifest.generated.json"
  );
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    tasks: GeneratedTaskAsset[];
  };

  await mongoose.connect(MONGODB_URI);
  const Task = mongoose.models.Task ?? mongoose.model("Task", TaskSchema);

  let matched = 0;
  let modified = 0;

  for (const task of manifest.tasks) {
    const workbookTitle =
      task.workbookPart === "I"
        ? "Mõtlemine nähtavaks! Õpetaja juhendmaterjal I"
        : "Mõtlemine nähtavaks! Õpetaja juhendmaterjal II";

    const result = await Task.updateOne(
      { slug: task.slug },
      {
        $set: {
          workbookPart: task.workbookPart,
          workbookTitle,
          sourcePdfName: task.sourcePdfName,
          sourcePageNumber: task.sourcePageNumber,
          sourcePdfPageNumber: task.sourcePdfPageNumber,
          pageImageUrl: task.pageImageUrl,
          strategyImageUrls: task.strategyImageUrls,
          imageUrl: task.imageUrl,
          workbookAssets: task.assets,
        },
      }
    );
    matched += result.matchedCount;
    modified += result.modifiedCount;
  }

  console.log(`Workbook asset sync complete: ${matched} matched, ${modified} modified`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
