import { NextRequest } from "next/server";
import openai from "@/lib/openai";
import { connectToDatabase } from "@/lib/mongoose";
import Task from "@/lib/models/Task";
import { ITask } from "@/lib/models/Task";

export const runtime = "nodejs";
export const maxDuration = 90;

type ChatContentPart =
  | { type: "text"; text?: string }
  | { type: "image_url"; image_url?: { url?: string; detail?: "auto" | "low" | "high" } };

type ChatMessage = {
  role: "user" | "assistant" | "system" | "developer";
  content: string | ChatContentPart[];
};

type UploadedAttachment = {
  file: File;
  kind: "image" | "pdf" | "searchable";
};

type ResponseContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "auto" | "low" | "high" }
  | { type: "input_file"; filename: string; file_data: string; detail?: "low" | "high" };

type ResponseMessage = {
  role: "user" | "assistant" | "system" | "developer";
  content: string | ResponseContentPart[];
};

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_UPLOADS_PER_REQUEST = 6;

const SEARCHABLE_MIME_TYPES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/html",
  "text/css",
  "text/javascript",
  "application/json",
  "application/typescript",
  "application/x-sh",
  "text/x-c",
  "text/x-c++",
  "text/x-csharp",
  "text/x-golang",
  "text/x-java",
  "text/x-php",
  "text/x-python",
  "text/x-script.python",
  "text/x-ruby",
  "text/x-tex",
]);

const SEARCHABLE_EXTENSIONS = new Set([
  ".c",
  ".cpp",
  ".cs",
  ".css",
  ".doc",
  ".docx",
  ".go",
  ".html",
  ".java",
  ".js",
  ".json",
  ".md",
  ".pdf",
  ".php",
  ".pptx",
  ".py",
  ".rb",
  ".sh",
  ".tex",
  ".ts",
  ".txt",
]);

function buildSystemPrompt(task: ITask | null, lang: string): string {
  const isEt = lang === "et";

  const base = isEt
    ? `Oled "Mõtlemine nähtavaks!" õpetaja abiline — AI-abimees, mis toetab õpetajaid Number Talks meetodi kasutamisel Eesti algklassides.
Sinu ülesanne on aidata õpetajatel:
- mõista, milliseid strateegiaid õpilased kasutavad
- diagnoosida levinud väärarusaamu
- reageerida täpse ja toetava tagasisidega
- analüüsida õpilastöid (kui õpetaja laadib pildi)

Vasta alati eesti keeles, kasutades õpetajale sobilikku, sõbralikku ja professionaalset tooni.
Kui õpetaja küsib inglise keeles, vasta inglise keeles.`
    : `You are the "Mõtlemine nähtavaks!" teacher assistant — an AI copilot supporting teachers using the Number Talks methodology in Estonian primary schools.
Your role is to help teachers:
- understand which strategies students are using
- diagnose common misconceptions
- respond with precise, supportive feedback
- analyse student work from photos

Respond in the same language as the teacher's question (Estonian or English).`;

  if (!task) return base;

  const isCountingTask = task.chapter === "counting";

  const strategiesText = task.strategies
    .map(
      (s) =>
        `- **${s.nameEt}** (${s.name}): ${s.descriptionEt}${s.example ? ` Näide: ${s.example}` : ""}`
    )
    .join("\n");

  const misconceptionsText = task.commonMisconceptionsEt
    .map((m) => `- ${m}`)
    .join("\n");

  const countingNote = isCountingTask
    ? `\n**Ülesanne tüüp:** Loendamine / subitiseerimine — õpetaja võib laadida üles pildi õpilase tööst või tahvlilt.`
    : "";

  return `${base}

---
**Praegune ülesanne / Current task:** ${task.problemEt} (${task.problem})
**Peatükk / Chapter:** ${task.chapter}
**Tehted / Operation:** ${task.operation}
**Klassid / Grade:** ${task.gradeMin}–${task.gradeMax}
**Raskusaste / Difficulty:** ${task.difficulty}
**Vastus / Answer:** ${task.answer ?? "varies"}${countingNote}

**Tuntud strateegiad / Known strategies:**
${strategiesText}

**Levinud väärarusaamad / Common misconceptions:**
${misconceptionsText}

**Juhendamine / Facilitation guidance:**
${task.facilitationEt}
(EN: ${task.facilitation})
---

Ground your responses in the above context. When a teacher describes or shows student work, map it to these known strategies or misconceptions. Be specific and pedagogically grounded. If an image is shared, analyse what strategies or misconceptions it reveals.`;
}

function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

function classifyUpload(file: File): UploadedAttachment["kind"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || fileExtension(file.name) === ".pdf") return "pdf";
  if (SEARCHABLE_MIME_TYPES.has(file.type) || SEARCHABLE_EXTENSIONS.has(fileExtension(file.name))) {
    return "searchable";
  }
  throw new Error(`Unsupported file type for ${file.name || "upload"}`);
}

function validateUpload(file: File) {
  if (file.size <= 0) throw new Error(`${file.name || "Upload"} is empty`);
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`${file.name || "Upload"} is larger than 50 MB`);
  }
}

function sanitizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((message): message is ChatMessage => {
      if (!message || typeof message !== "object") return false;
      const candidate = message as Partial<ChatMessage>;
      return (
        (candidate.role === "user" ||
          candidate.role === "assistant" ||
          candidate.role === "system" ||
          candidate.role === "developer") &&
        (typeof candidate.content === "string" || Array.isArray(candidate.content))
      );
    })
    .map((message) => ({
      role: message.role,
      content:
        typeof message.content === "string"
          ? message.content
          : message.content.filter((part) => {
              if (!part || typeof part !== "object") return false;
              return part.type === "text" || part.type === "image_url";
            }),
    }));
}

async function parseChatRequest(request: NextRequest): Promise<{
  messages: ChatMessage[];
  taskSlug?: string;
  lang: string;
  uploads: UploadedAttachment[];
}> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    let messages: ChatMessage[] = [];

    try {
      messages = sanitizeMessages(JSON.parse(String(formData.get("messages") ?? "[]")));
    } catch {
      throw new Error("Invalid messages JSON");
    }

    const taskSlug = String(formData.get("taskSlug") ?? "") || undefined;
    const lang = String(formData.get("lang") ?? "et");
    const files = formData
      .getAll("files")
      .concat(formData.getAll("file"))
      .filter((value): value is File => value instanceof File && value.size > 0);

    if (files.length > MAX_UPLOADS_PER_REQUEST) {
      throw new Error(`Too many uploads. Send at most ${MAX_UPLOADS_PER_REQUEST} files.`);
    }

    const uploads = files.map((file) => {
      validateUpload(file);
      return { file, kind: classifyUpload(file) };
    });

    return { messages, taskSlug, lang, uploads };
  }

  const body = await request.json();
  return {
    messages: sanitizeMessages(body.messages),
    taskSlug: typeof body.taskSlug === "string" ? body.taskSlug : undefined,
    lang: typeof body.lang === "string" ? body.lang : "et",
    uploads: [],
  };
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = Buffer.from(await file.arrayBuffer());
  return bytes.toString("base64");
}

async function fileToDataUrl(file: File): Promise<string> {
  const mimeType = file.type || "application/octet-stream";
  return `data:${mimeType};base64,${await fileToBase64(file)}`;
}

function toResponseMessage(message: ChatMessage): ResponseMessage {
  if (typeof message.content === "string") {
    return { role: message.role, content: message.content };
  }

  const content: ResponseContentPart[] = [];
  for (const part of message.content) {
    if (part.type === "text" && part.text) {
      content.push({ type: "input_text", text: part.text });
    }

    if (part.type === "image_url" && part.image_url?.url) {
      content.push({
        type: "input_image",
        image_url: part.image_url.url,
        detail: part.image_url.detail ?? "auto",
      });
    }
  }

  return {
    role: message.role,
    content: content.length > 0 ? content : "",
  };
}

async function addDirectUploadParts(
  messages: ResponseMessage[],
  uploads: UploadedAttachment[]
): Promise<string[]> {
  const directUploads = uploads.filter((upload) => upload.kind === "image" || upload.kind === "pdf");
  if (directUploads.length === 0) return [];

  const parts: ResponseContentPart[] = [
    {
      type: "input_text",
      text: "Use the attached uploaded files as additional context for this turn. Analyse images visually and read PDFs carefully before answering.",
    },
  ];
  const filenames: string[] = [];

  for (const upload of directUploads) {
    filenames.push(upload.file.name || "uploaded file");
    if (upload.kind === "image") {
      parts.push({
        type: "input_image",
        image_url: await fileToDataUrl(upload.file),
        detail: "auto",
      });
    } else {
      parts.push({
        type: "input_file",
        filename: upload.file.name || "document.pdf",
        file_data: await fileToBase64(upload.file),
        detail: "low",
      });
    }
  }

  messages.push({ role: "user", content: parts });
  return filenames;
}

async function createSearchStore(uploads: UploadedAttachment[]): Promise<{
  vectorStoreId?: string;
  fileIds: string[];
  filenames: string[];
}> {
  const searchableUploads = uploads.filter((upload) => upload.kind === "searchable");
  if (searchableUploads.length === 0) return { fileIds: [], filenames: [] };

  let vectorStoreId: string | undefined;

  try {
    const vectorStore = await openai.vectorStores.create({
      name: `teacher-assistant-upload-${Date.now()}`,
      expires_after: { anchor: "last_active_at", days: 1 },
    });
    vectorStoreId = vectorStore.id;

    const batch = await openai.vectorStores.fileBatches.uploadAndPoll(
      vectorStore.id,
      { files: searchableUploads.map((upload) => upload.file) },
      { pollIntervalMs: 1000, maxConcurrency: 2 }
    );

    if (batch.file_counts.failed > 0) {
      throw new Error("One or more uploaded documents could not be indexed.");
    }

    const listedFiles = await openai.vectorStores.fileBatches.listFiles(batch.id, {
      vector_store_id: vectorStore.id,
      limit: MAX_UPLOADS_PER_REQUEST,
    });

    return {
      vectorStoreId: vectorStore.id,
      fileIds: listedFiles.data.map((file) => file.id),
      filenames: searchableUploads.map((upload) => upload.file.name || "uploaded document"),
    };
  } catch (error) {
    if (vectorStoreId) {
      const listedFiles = await openai.vectorStores.files.list(vectorStoreId, {
        limit: MAX_UPLOADS_PER_REQUEST,
      });
      await cleanupOpenAIUploads(
        vectorStoreId,
        listedFiles.data.map((file) => file.id)
      );
    }

    throw error;
  }
}

async function cleanupOpenAIUploads(vectorStoreId: string | undefined, fileIds: string[]) {
  await Promise.allSettled([
    ...fileIds.map((fileId) => openai.files.delete(fileId)),
    ...(vectorStoreId ? [openai.vectorStores.delete(vectorStoreId)] : []),
  ]);
}

export async function POST(request: NextRequest) {
  let parsed: Awaited<ReturnType<typeof parseChatRequest>>;

  try {
    parsed = await parseChatRequest(request);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid chat request" },
      { status: 400 }
    );
  }

  const { messages, taskSlug, lang, uploads } = parsed;

  let task: ITask | null = null;
  if (taskSlug) {
    await connectToDatabase();
    task = await Task.findOne({ slug: taskSlug }).lean() as ITask | null;
  }

  const systemPrompt = buildSystemPrompt(task, lang);
  const responseMessages = messages.map(toResponseMessage);
  const directUploadNames = await addDirectUploadParts(responseMessages, uploads);
  const { vectorStoreId, fileIds, filenames: searchableNames } = await createSearchStore(uploads);

  if (searchableNames.length > 0) {
    responseMessages.push({
      role: "user",
      content: [
        {
          type: "input_text",
          text: `The following uploaded documents are indexed for file search: ${searchableNames.join(", ")}. Search them when they may contain relevant context for the teacher's question.`,
        },
      ],
    });
  }

  if (directUploadNames.length > 0 || searchableNames.length > 0) {
    responseMessages.push({
      role: "user",
      content: [
        {
          type: "input_text",
          text: `Uploaded context available for this answer: ${[...directUploadNames, ...searchableNames].join(", ")}.`,
        },
      ],
    });
  }

  let stream: AsyncIterable<{ type: string; delta?: string }>;

  try {
    stream = (await openai.responses.create({
      model: "gpt-4o",
      instructions: systemPrompt,
      input: responseMessages,
      tools: vectorStoreId
        ? [{ type: "file_search", vector_store_ids: [vectorStoreId], max_num_results: 8 }]
        : undefined,
      stream: true,
      temperature: 0.4,
      max_output_tokens: 1024,
    } as Parameters<typeof openai.responses.create>[0])) as AsyncIterable<{
      type: string;
      delta?: string;
    }>;
  } catch (error) {
    await cleanupOpenAIUploads(vectorStoreId, fileIds);
    return Response.json(
      { error: error instanceof Error ? error.message : "Chat response failed" },
      { status: 500 }
    );
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "response.output_text.delta" && event.delta) {
            controller.enqueue(encoder.encode(event.delta));
          }
        }
      } finally {
        await cleanupOpenAIUploads(vectorStoreId, fileIds);
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
