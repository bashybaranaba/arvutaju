import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import OpenAI from "openai";
import { tasks } from "./seed-data";
import { workbookIITasks } from "./seed-data-part-ii";

const MONGODB_URI = process.env.MONGODB_URI!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

if (!MONGODB_URI || !OPENAI_API_KEY) {
  console.error("Missing MONGODB_URI or OPENAI_API_KEY in environment");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ── Mongoose schema (inline to avoid Next.js module resolution issues) ────────
const StrategySchema = new mongoose.Schema({
  name: String,
  nameEt: String,
  description: String,
  descriptionEt: String,
  example: String,
});

const TaskSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: String,
    titleEt: String,
    problem: String,
    problemEt: String,
    chapter: String,
    chapterOrder: Number,
    operation: String,
    gradeMin: Number,
    gradeMax: Number,
    difficulty: String,
    strategies: [StrategySchema],
    facilitation: String,
    facilitationEt: String,
    commonMisconceptions: [String],
    commonMisconceptionsEt: [String],
    tags: [String],
    pageRef: Number,
    workbookPart: String,
    workbookTitle: String,
    sourcePdfName: String,
    sourcePageNumber: Number,
    sourcePdfPageNumber: Number,
    pageImageUrl: String,
    strategyImageUrls: [String],
    workbookAssets: [
      {
        kind: String,
        url: String,
        page: Number,
        order: Number,
        label: String,
        sourcePdfName: String,
        pdfPage: Number,
        crop: {
          x: Number,
          y: Number,
          width: Number,
          height: Number,
        },
        width: Number,
        height: Number,
        checksum: String,
      },
    ],
    answer: String,
    imageUrl: String,
    embedding: [Number],
  },
  { timestamps: true }
);

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

function loadGeneratedAssets(): Map<string, GeneratedTaskAsset> {
  const manifestPath = path.join(
    process.cwd(),
    "public/images/workbooks/manifest.generated.json"
  );

  if (!existsSync(manifestPath)) return new Map();

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    tasks?: GeneratedTaskAsset[];
  };

  return new Map((manifest.tasks ?? []).map((task) => [task.slug, task]));
}

const generatedAssetsBySlug = loadGeneratedAssets();
const seedTasks = [...tasks, ...workbookIITasks];
type SeedTask = (typeof seedTasks)[number];

function padPage(page: number): string {
  return page.toString().padStart(3, "0");
}

function workbookTitleForPart(part: "I" | "II") {
  return part === "I"
    ? "Mõtlemine nähtavaks! Õpetaja juhendmaterjal I"
    : "Mõtlemine nähtavaks! Õpetaja juhendmaterjal II";
}

function withWorkbookMetadata(task: SeedTask) {
  const taskImageUrl = "imageUrl" in task ? task.imageUrl : undefined;
  const generatedAssets = generatedAssetsBySlug.get(task.slug);
  const workbookPart = generatedAssets?.workbookPart ?? ("workbookPart" in task ? task.workbookPart : "I");
  const workbookTitle = workbookTitleForPart(workbookPart);
  const sourcePdfName =
    workbookPart === "I"
      ? "Õpetaja juhendmaterjal_pdf.pdf"
      : "Õpetaja juhendmaterjal_II.pdf";
  const sourcePageNumber = task.pageRef;
  const sourcePdfPageNumber =
    workbookPart === "I" && sourcePageNumber ? sourcePageNumber + 3 : sourcePageNumber;
  const pageImageUrl = sourcePageNumber
    ? `/images/workbooks/part-${workbookPart === "I" ? "I" : "II"}/pages/page-${padPage(sourcePageNumber)}.png`
    : undefined;

  if (generatedAssets) {
    return {
      ...task,
      imageUrl: generatedAssets.imageUrl ?? taskImageUrl,
      workbookPart: generatedAssets.workbookPart,
      workbookTitle,
      sourcePdfName: generatedAssets.sourcePdfName,
      sourcePageNumber: generatedAssets.sourcePageNumber,
      sourcePdfPageNumber: generatedAssets.sourcePdfPageNumber,
      pageImageUrl: generatedAssets.pageImageUrl,
      strategyImageUrls: generatedAssets.strategyImageUrls,
      workbookAssets: generatedAssets.assets,
    };
  }

  const workbookAssets = [
    ...(sourcePageNumber && pageImageUrl
      ? [
          {
            kind: "page" as const,
            url: pageImageUrl,
            page: sourcePageNumber,
            order: 0,
            label: `Workbook page ${sourcePageNumber}`,
            sourcePdfName,
            pdfPage: sourcePdfPageNumber,
          },
        ]
      : []),
    ...(taskImageUrl && sourcePageNumber
      ? [
          {
            kind: "task" as const,
            url: taskImageUrl,
            page: sourcePageNumber,
            order: 1,
            label: task.titleEt,
            sourcePdfName,
            pdfPage: sourcePdfPageNumber,
          },
        ]
      : []),
  ];

  return {
    ...task,
    workbookPart,
    workbookTitle,
    sourcePdfName,
    sourcePageNumber,
    sourcePdfPageNumber,
    pageImageUrl,
    strategyImageUrls: [],
    workbookAssets,
  };
}

async function buildEmbeddingText(task: SeedTask): Promise<string> {
  const strategyNames = task.strategies.map((s) => `${s.nameEt} (${s.name})`).join(", ");
  const strategyDescs = task.strategies
    .map((s) => `${s.nameEt}: ${s.descriptionEt}`)
    .join(". ");
  const misconceptions = task.commonMisconceptionsEt.join(". ");

  return [
    `Ülesanne: ${task.problemEt}`,
    `Peatükk: ${task.chapter}`,
    `Tehed: ${task.operation}`,
    `Raskusaste: ${task.difficulty}`,
    `Klassid: ${task.gradeMin}–${task.gradeMax}`,
    `Strateegiad: ${strategyNames}`,
    strategyDescs,
    `Levinud väärarusaamad: ${misconceptions}`,
    `Märksõnad: ${task.tags.join(", ")}`,
    // Also include English for bilingual search
    `Task: ${task.problem}`,
    `Chapter: ${task.chapter}`,
    `Strategies: ${task.strategies.map((s) => s.name).join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function generateEmbedding(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}

async function seed() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);

  const Task =
    mongoose.models.Task ?? mongoose.model("Task", TaskSchema);

  // Clear old tasks before reseeding with real workbook tasks
  const deletedCount = await Task.deleteMany({});
  console.log(`Cleared ${deletedCount.deletedCount} old tasks from DB`);

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const task of seedTasks) {
    try {
      process.stdout.write(`Processing: ${task.slug} ... `);

      const taskWithWorkbook = withWorkbookMetadata(task);
      const embeddingText = await buildEmbeddingText(task);
      const embedding = await generateEmbedding(embeddingText);

      const result = await Task.findOneAndUpdate(
        { slug: task.slug },
        { ...taskWithWorkbook, embedding },
        { upsert: true, returnDocument: "after" }
      );

      const isNew = result?.createdAt?.getTime() === result?.updatedAt?.getTime();
      if (isNew) {
        inserted++;
        console.log("✓ inserted");
      } else {
        updated++;
        console.log("✓ updated");
      }

      // Rate limit: OpenAI embeddings API is generous but let's be safe
      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      errors++;
      console.log(`✗ ERROR: ${err}`);
    }
  }

  console.log(`\nDone: ${inserted} inserted, ${updated} updated, ${errors} errors`);
  console.log(`Total tasks in DB: ${await Task.countDocuments()}`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
