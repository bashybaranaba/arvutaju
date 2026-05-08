import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import Task from "@/lib/models/Task";
import { generateEmbedding } from "@/lib/openai";

function buildFilter(
  operation: string | null,
  grade: string | null,
  chapter: string | null,
  difficulty: string | null
) {
  const filter: Record<string, unknown> = {};
  if (chapter) filter.chapter = { $eq: chapter };
  if (operation) filter.operation = { $eq: operation };
  if (difficulty) filter.difficulty = { $eq: difficulty };
  if (grade) {
    filter.gradeMin = { $lte: parseInt(grade) };
    filter.gradeMax = { $gte: parseInt(grade) };
  }
  return filter;
}

export async function GET(request: NextRequest) {
  const db = await connectToDatabase();

  const { searchParams } = request.nextUrl;
  const operation = searchParams.get("operation");
  const grade = searchParams.get("grade");
  const difficulty = searchParams.get("difficulty");
  const chapter = searchParams.get("chapter");
  const query = searchParams.get("q");
  const sort = searchParams.get("sort");

  if (query) {
    try {
      const embedding = await generateEmbedding(query);
      const pipeline = [
        {
          $vectorSearch: {
            index: "vector_index",
            path: "embedding",
            queryVector: embedding,
            numCandidates: 50,
            limit: 18,
            filter: buildFilter(operation, grade, chapter, difficulty),
          },
        },
        {
          $project: {
            embedding: 0,
            score: { $meta: "vectorSearchScore" },
          },
        },
      ];
      const TaskModel = db.models.Task;
      const results = await TaskModel.aggregate(pipeline);
      return Response.json({ tasks: results, source: "vector" });
    } catch {
      // Vector index not ready — fall through
    }
  }

  const filter = buildFilter(operation, grade, chapter, difficulty);
  const tasks = await Task.find(filter, { embedding: 0 })
    .sort(
      sort === "workbook"
        ? { workbookPart: 1, sourcePageNumber: 1, chapter: 1, chapterOrder: 1 }
        : { chapter: 1, chapterOrder: 1 }
    )
    .lean();
  return Response.json({ tasks, source: "filter" });
}
