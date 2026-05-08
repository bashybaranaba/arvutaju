import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import Task from "@/lib/models/Task";
import { generateEmbedding } from "@/lib/openai";

function buildFilter(operation: string | null, grade: string | null) {
  const filter: Record<string, unknown> = {};
  if (operation) filter.operation = { $eq: operation };
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
  const query = searchParams.get("q");

  // Vector search when there's a text query
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
            limit: 12,
            filter: buildFilter(operation, grade),
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
      // Vector index not ready yet — fall through to keyword search
    }
  }

  // Keyword / filter search
  const filter: Record<string, unknown> = {};
  if (operation) filter.operation = operation;
  if (difficulty) filter.difficulty = difficulty;
  if (grade) {
    filter.gradeMin = { $lte: parseInt(grade) };
    filter.gradeMax = { $gte: parseInt(grade) };
  }

  const tasks = await Task.find(filter, { embedding: 0 }).lean();
  return Response.json({ tasks, source: "filter" });
}
