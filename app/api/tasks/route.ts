import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import Task from "@/lib/models/Task";
import openai from "@/lib/openai";
import { generateEmbedding } from "@/lib/openai";

type SearchTask = Record<string, unknown> & {
  slug?: string;
  _id?: unknown;
  score?: number;
  textScore?: number;
  topicScore?: number;
  sourcePageNumber?: number;
};

type Operation = "addition" | "subtraction" | "multiplication" | "division" | "mixed";

type RetrievalPlan = {
  query: string;
  operation: Operation | null;
  grade: string | null;
  chapter: string | null;
  difficulty: string | null;
  confidence: number;
  source: "tool" | "deterministic";
};

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

function inferOperation(query: string | null, operation: string | null): Operation | null {
  if (operation) return operation as Operation;
  if (!query) return null;

  const text = query.toLowerCase();
  const operations: Array<[Operation, RegExp]> = [
    ["multiplication", /\b(multiplication|multiply|times|product|korrutamine|korruta|korrutis|korda)\b/i],
    ["division", /\b(division|divide|divided|quotient|jagamine|jaga|jagatis)\b/i],
    ["subtraction", /\b(subtraction|subtract|minus|difference|lahutamine|lahuta|miinus|vahe)\b/i],
    ["addition", /\b(addition|add|plus|sum|liitmine|liida|pluss|summa)\b/i],
  ];

  const matches = operations.filter(([, pattern]) => pattern.test(text)).map(([value]) => value);
  return matches.length === 1 ? matches[0] : null;
}

function operationTerms(operation: Operation | null) {
  if (!operation) return [];

  const terms: Record<Operation, string[]> = {
    addition: ["addition", "add", "plus", "sum", "liitmine", "liida", "pluss", "summa"],
    subtraction: ["subtraction", "subtract", "minus", "difference", "lahutamine", "lahuta", "miinus", "vahe"],
    multiplication: ["multiplication", "multiply", "times", "product", "korrutamine", "korruta", "korrutis", "korda"],
    division: ["division", "divide", "divided", "quotient", "jagamine", "jaga", "jagatis"],
    mixed: ["mixed", "segatehted", "erinevad tehted"],
  };

  return terms[operation];
}

function normalizeRetrievalQuery(query: string, operation: Operation | null) {
  const additions = operationTerms(operation);
  return [...new Set([query, ...additions])].join(" ");
}

function deterministicPlan(
  query: string | null,
  params: {
    operation: string | null;
    grade: string | null;
    chapter: string | null;
    difficulty: string | null;
  },
): RetrievalPlan {
  const operation = inferOperation(query, params.operation);
  const planQuery = normalizeRetrievalQuery(query ?? "", operation);

  return {
    query: planQuery,
    operation,
    grade: inferGrade(query, params.grade),
    chapter: params.chapter,
    difficulty: params.difficulty,
    confidence: operation ? 0.7 : 0.35,
    source: "deterministic",
  };
}

async function buildRetrievalPlan(
  query: string | null,
  params: {
    operation: string | null;
    grade: string | null;
    chapter: string | null;
    difficulty: string | null;
  },
): Promise<RetrievalPlan> {
  const fallback = deterministicPlan(query, params);
  if (!query) return fallback;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Convert teacher requests into a precise workbook task search. Prefer explicit math operation filters when the request names an operation. Use null for unknown fields. Do not invent a grade.",
        },
        { role: "user", content: query },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "search_workbook_tasks",
            description: "Create structured criteria for finding relevant Estonian Number Talk workbook tasks.",
            strict: true,
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "A concise bilingual search query with the topic, operation, representations, and number type.",
                },
                operation: {
                  type: ["string", "null"],
                  enum: ["addition", "subtraction", "multiplication", "division", "mixed", null],
                  description: "The requested arithmetic operation, or null if unspecified.",
                },
                grade: {
                  type: ["string", "null"],
                  description: "Grade number 1-6 when explicitly present, otherwise null.",
                },
                chapter: {
                  type: ["string", "null"],
                  enum: ["counting", "addition", "subtraction", "multiplication", "division", null],
                  description: "Workbook chapter when explicit or clearly implied.",
                },
                difficulty: {
                  type: ["string", "null"],
                  enum: ["easy", "medium", "hard", null],
                  description: "Requested difficulty, or null.",
                },
                confidence: {
                  type: "number",
                  description: "Confidence from 0 to 1 that the criteria capture the teacher request.",
                },
              },
              required: ["query", "operation", "grade", "chapter", "difficulty", "confidence"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "search_workbook_tasks" } },
      temperature: 0,
      max_tokens: 200,
    });

    const toolCall = response.choices[0]?.message.tool_calls?.[0];
    if (toolCall?.type !== "function") return fallback;
    if (toolCall?.function.name !== "search_workbook_tasks") return fallback;

    const parsed = JSON.parse(toolCall.function.arguments) as Omit<RetrievalPlan, "source">;
    const operation = (parsed.operation ?? fallback.operation) as Operation | null;

    return {
      query: normalizeRetrievalQuery(parsed.query || query, operation),
      operation,
      grade: parsed.grade ?? fallback.grade,
      chapter: parsed.chapter ?? params.chapter,
      difficulty: parsed.difficulty ?? params.difficulty,
      confidence: parsed.confidence ?? fallback.confidence,
      source: "tool",
    };
  } catch (error) {
    console.warn("Workbook retrieval planning failed, using deterministic plan:", error);
    return fallback;
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inferGrade(query: string | null, grade: string | null) {
  if (grade) return grade;
  if (!query) return null;

  const labelFirst = query.match(/\b(?:grade|klass|klassi|class)\s*([1-6])\b/i);
  const numberFirst = query.match(/\b([1-6])\.?\s*(?:grade|klass|klassi|class)\b/i);
  return labelFirst?.[1] ?? numberFirst?.[1] ?? null;
}

function expandedSearchTerms(query: string) {
  const terms = query
    .toLowerCase()
    .split(/[\s,.;:!?()[\]"']+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);

  const expansions = new Map<string, string[]>([
    ["decimal", ["decimal", "decimals", "kümnend", "kümnendmurd", "kümnendmurrud", "kümnendkohad"]],
    ["decimals", ["decimal", "decimals", "kümnend", "kümnendmurd", "kümnendmurrud", "kümnendkohad"]],
    ["fraction", ["fraction", "fractions", "murd", "murrud", "harilikud", "harilikud murrud"]],
    ["fractions", ["fraction", "fractions", "murd", "murrud", "harilikud", "harilikud murrud"]],
    ["multiplication", operationTerms("multiplication")],
    ["multiply", operationTerms("multiplication")],
    ["times", operationTerms("multiplication")],
    ["division", operationTerms("division")],
    ["divide", operationTerms("division")],
    ["subtraction", operationTerms("subtraction")],
    ["subtract", operationTerms("subtraction")],
    ["addition", operationTerms("addition")],
    ["money", ["money", "raha", "euro", "eurot", "euros", "sent", "senti"]],
    ["estimate", ["estimate", "estimation", "hinnang", "hinnanguline", "ümardamine"]],
    ["estimation", ["estimate", "estimation", "hinnang", "hinnanguline", "ümardamine"]],
    ["number", ["number", "arv", "arvu", "arvud", "arvtelg"]],
    ["talk", ["talk", "arutelu", "strateegia", "strateegiad", "lahendusstrateegia"]],
    ["workbook", ["workbook", "töövihik", "töövihiku", "II osa", "I osa"]],
    ["grade", ["grade", "klass", "klassi"]],
  ]);

  const expanded = terms.flatMap((term) => expansions.get(term) ?? [term]);
  return [...new Set(expanded)]
    .filter((term) => term.length >= 3)
    .slice(0, 20);
}

function buildTextSearchFilter(query: string, baseFilter: Record<string, unknown>) {
  const terms = expandedSearchTerms(query);

  if (terms.length === 0) return baseFilter;

  const regexes = terms.map((term) => new RegExp(escapeRegex(term), "i"));
  return {
    ...baseFilter,
    $or: regexes.flatMap((regex) => [
      { title: regex },
      { titleEt: regex },
      { problem: regex },
      { problemEt: regex },
      { chapter: regex },
      { operation: regex },
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

function textScore(task: SearchTask, query: string) {
  const terms = expandedSearchTerms(query);
  return scoreTerms(task, terms);
}

function topicScore(task: SearchTask, query: string, operation: Operation | null) {
  const operationTermSet = new Set(operationTerms(operation).map((term) => term.toLowerCase()));
  const genericTerms = new Set(["task", "tasks", "ülesanne", "ülesanded", "ülesandeid", "workbook", "töövihik", "number", "talk"]);
  const terms = expandedSearchTerms(query).filter(
    (term) => !operationTermSet.has(term.toLowerCase()) && !genericTerms.has(term.toLowerCase()),
  );

  return scoreTerms(task, terms);
}

function scoreTerms(task: SearchTask, terms: string[]) {
  const haystack = [
    task.title,
    task.titleEt,
    task.problem,
    task.problemEt,
    task.chapter,
    task.operation,
    task.workbookPart ? `part ${task.workbookPart} osa ${task.workbookPart}` : "",
    task.workbookTitle,
    task.sourcePdfName,
    ...(Array.isArray(task.tags) ? task.tags : []),
    ...(Array.isArray(task.commonMisconceptions) ? task.commonMisconceptions : []),
    ...(Array.isArray(task.commonMisconceptionsEt) ? task.commonMisconceptionsEt : []),
    ...(Array.isArray(task.strategies)
      ? task.strategies.flatMap((strategy) => {
          const value = strategy as Record<string, unknown>;
          return [value.name, value.nameEt, value.description, value.descriptionEt, value.example];
        })
      : []),
    task.facilitation,
    task.facilitationEt,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return terms.reduce((score, term) => score + (haystack.includes(term.toLowerCase()) ? 1 : 0), 0);
}

function mergeTasks(primary: SearchTask[], secondary: SearchTask[]) {
  const bySlug = new Map<string, SearchTask>();
  for (const task of [...primary, ...secondary]) {
    const slug = typeof task.slug === "string" ? task.slug : String(task._id);
    if (!bySlug.has(slug)) bySlug.set(slug, task);
  }
  return [...bySlug.values()];
}

export async function GET(request: NextRequest) {
  const db = await connectToDatabase();

  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q");
  const requestedOperation = searchParams.get("operation");
  const requestedGrade = searchParams.get("grade");
  const requestedDifficulty = searchParams.get("difficulty");
  const requestedChapter = searchParams.get("chapter");
  const plan = await buildRetrievalPlan(query, {
    operation: requestedOperation,
    grade: requestedGrade,
    chapter: requestedChapter,
    difficulty: requestedDifficulty,
  });
  const searchQuery = query ? plan.query : query;
  const operation = plan.operation;
  const grade = plan.grade;
  const difficulty = plan.difficulty;
  const chapter = plan.chapter;
  const sort = searchParams.get("sort");
  const limit = query ? 18 : 0;
  const retrievalQuery = query
    ? [
        searchQuery,
        "number talk arvutaju töövihik lahendusstrateegia suunavad küsimused",
        "student strategy misconception workbook task visual model",
      ].join("\n")
    : null;

  if (query) {
    try {
      const embedding = await generateEmbedding(retrievalQuery ?? searchQuery ?? query);
      const pipeline = [
        {
          $vectorSearch: {
            index: "vector_index",
            path: "embedding",
            queryVector: embedding,
            numCandidates: 80,
            limit,
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
      const vectorResults = await TaskModel.aggregate(pipeline) as SearchTask[];
      const textResults = await Task.find(buildTextSearchFilter(searchQuery ?? query, buildFilter(operation, grade, chapter, difficulty)), { embedding: 0 })
        .limit(limit)
        .lean() as unknown as SearchTask[];
      const results = mergeTasks(vectorResults, textResults)
        .map((task) => ({
          ...task,
          textScore: textScore(task, searchQuery ?? query),
          topicScore: topicScore(task, searchQuery ?? query, operation),
        }))
        .sort((a, b) => {
          const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
          if (Math.abs(scoreDiff) > 0.02) return scoreDiff;
          const topicDiff = (b.topicScore ?? 0) - (a.topicScore ?? 0);
          if (topicDiff !== 0) return topicDiff;
          if (operation && (a.topicScore ?? 0) === 0 && (b.topicScore ?? 0) === 0) {
            return (a.sourcePageNumber ?? 999) - (b.sourcePageNumber ?? 999);
          }
          const textDiff = (b.textScore ?? 0) - (a.textScore ?? 0);
          if (textDiff !== 0) return textDiff;
          return (a.sourcePageNumber ?? 999) - (b.sourcePageNumber ?? 999);
        })
        .slice(0, limit);
      if (results.length > 0) {
        return Response.json({
          tasks: results,
          source: textResults.length > 0 ? "hybrid" : "vector",
          query,
          retrieval: {
            mode: textResults.length > 0 ? "hybrid" : "vector",
            index: "vector_index",
            count: results.length,
            vectorCount: vectorResults.length,
            textCount: textResults.length,
            grade,
            operation,
            planSource: plan.source,
            plannedQuery: searchQuery,
            planConfidence: plan.confidence,
          },
        });
      }
      console.warn("Vector task search returned no results, using text fallback.");
    } catch (error) {
      console.warn("Vector task search failed, using text fallback:", error);
    }
  }

  const filter = buildFilter(operation, grade, chapter, difficulty);
  const fallbackFilter = query ? buildTextSearchFilter(searchQuery ?? query, filter) : filter;
  const tasks = (await Task.find(fallbackFilter, { embedding: 0 })
    .sort(
      sort === "workbook"
        ? { workbookPart: 1, sourcePageNumber: 1, chapter: 1, chapterOrder: 1 }
        : { chapter: 1, chapterOrder: 1 }
    )
    .limit(limit)
    .lean() as unknown as SearchTask[])
    .map((task) => ({
      ...task,
      textScore: query ? textScore(task, searchQuery ?? query) : 0,
      topicScore: query ? topicScore(task, searchQuery ?? query, operation) : 0,
    }))
    .sort((a, b) => {
      if (!query) return 0;
      const topicDiff = b.topicScore - a.topicScore;
      if (topicDiff !== 0) return topicDiff;
      if (operation && a.topicScore === 0 && b.topicScore === 0) {
        return ((a.sourcePageNumber as number | undefined) ?? 999) - ((b.sourcePageNumber as number | undefined) ?? 999);
      }
      const textDiff = b.textScore - a.textScore;
      if (textDiff !== 0) return textDiff;
      return ((a.sourcePageNumber as number | undefined) ?? 999) - ((b.sourcePageNumber as number | undefined) ?? 999);
    });
  return Response.json({
    tasks,
    source: query ? "text-fallback" : "filter",
    query,
    retrieval: {
      mode: query ? "text-fallback" : "filter",
      count: tasks.length,
      grade,
      operation,
      planSource: plan.source,
      plannedQuery: searchQuery,
      planConfidence: plan.confidence,
    },
  });
}
