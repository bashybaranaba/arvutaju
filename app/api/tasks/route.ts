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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTextSearchFilter(query: string, baseFilter: Record<string, unknown>) {
  const terms = query
    .toLowerCase()
    .split(/[\s,.;:!?()[\]"']+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3)
    .slice(0, 8);

  if (terms.length === 0) return baseFilter;

  const regexes = terms.map((term) => new RegExp(escapeRegex(term), "i"));
  return {
    ...baseFilter,
    $or: regexes.flatMap((regex) => [
      { title: regex },
      { titleEt: regex },
      { problem: regex },
      { problemEt: regex },
      { tags: regex },
      { "strategies.name": regex },
      { "strategies.nameEt": regex },
      { "strategies.description": regex },
      { "strategies.descriptionEt": regex },
      { facilitation: regex },
      { facilitationEt: regex },
      { workbookTitle: regex },
      { sourcePdfName: regex },
    ]),
  };
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
  const retrievalQuery = query
    ? [
        query,
        "number talk arvutaju töövihik lahendusstrateegia suunavad küsimused",
        "student strategy misconception workbook task visual model",
      ].join("\n")
    : null;

  if (query) {
    try {
      const embedding = await generateEmbedding(retrievalQuery ?? query);
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
      if (results.length > 0) {
        return Response.json({
          tasks: results,
          source: "vector",
          query,
          retrieval: {
            mode: "vector",
            index: "vector_index",
            count: results.length,
          },
        });
      }
      console.warn("Vector task search returned no results, using text fallback.");
    } catch (error) {
      console.warn("Vector task search failed, using text fallback:", error);
    }
  }

  const filter = buildFilter(operation, grade, chapter, difficulty);
  const fallbackFilter = query ? buildTextSearchFilter(query, filter) : filter;
  const tasks = await Task.find(fallbackFilter, { embedding: 0 })
    .sort(
      sort === "workbook"
        ? { workbookPart: 1, sourcePageNumber: 1, chapter: 1, chapterOrder: 1 }
        : { chapter: 1, chapterOrder: 1 }
    )
    .limit(query ? 18 : 0)
    .lean();
  return Response.json({
    tasks,
    source: query ? "text-fallback" : "filter",
    query,
    retrieval: {
      mode: query ? "text-fallback" : "filter",
      count: tasks.length,
    },
  });
}
