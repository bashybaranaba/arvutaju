import mongoose from "mongoose";
import OpenAI from "openai";
import { tasks } from "./seed-data";

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
    answer: String,
    imageUrl: String,
    embedding: [Number],
  },
  { timestamps: true }
);

async function buildEmbeddingText(task: (typeof tasks)[number]): Promise<string> {
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

  for (const task of tasks) {
    try {
      process.stdout.write(`Processing: ${task.slug} ... `);

      const embeddingText = await buildEmbeddingText(task);
      const embedding = await generateEmbedding(embeddingText);

      const result = await Task.findOneAndUpdate(
        { slug: task.slug },
        { ...task, embedding },
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
