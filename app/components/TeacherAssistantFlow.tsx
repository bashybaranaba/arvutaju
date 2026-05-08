"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";

type Language = "et" | "en";

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type ChatMessage = {
  role: "user" | "assistant";
  content: string | ContentPart[];
};

type Strategy = {
  name: string;
  nameEt: string;
  description: string;
  descriptionEt: string;
  example?: string;
};

type WorkbookAsset = {
  kind: "page" | "task" | "strategy" | "illustration";
  url: string;
  page: number;
  order?: number;
  label?: string;
};

type Task = {
  _id: string;
  slug: string;
  title: string;
  titleEt: string;
  problem: string;
  problemEt: string;
  chapter: string;
  operation: string;
  gradeMin: number;
  gradeMax: number;
  difficulty: "easy" | "medium" | "hard";
  strategies: Strategy[];
  facilitation: string;
  facilitationEt: string;
  commonMisconceptions: string[];
  commonMisconceptionsEt: string[];
  tags: string[];
  answer?: string;
  pageRef?: number;
  workbookPart?: "I" | "II";
  sourcePageNumber?: number;
  pageImageUrl?: string;
  strategyImageUrls?: string[];
  workbookAssets?: WorkbookAsset[];
  imageUrl?: string;
  score?: number;
};

type Copy = {
  promptPlaceholder: string;
  attach: string;
  send: string;
  searching: string;
  thinking: string;
  assistantTitle: string;
  assistantIntro: string;
  referencesTitle: string;
  noReferences: string;
  workbookReference: string;
  generateSimilar: string;
  generatedTitle: string;
  generationNote: string;
  ruleAiTitle: string;
  ruleAiBody: string;
  sourceImages: string;
  selectedReference: string;
  examples: string[];
  error: string;
};

const copyByLang: Record<Language, Copy> = {
  et: {
    promptPlaceholder:
      "Küsi töövihiku põhjal, lisa õpilase töö pilt või palu luua sarnane ülesanne...",
    attach: "Lisa pilt",
    send: "Saada",
    searching: "Otsin töövihikust sobivat konteksti...",
    thinking: "Koostan vastust...",
    assistantTitle: "AI töövoog õpetajale",
    assistantIntro:
      "Kirjelda klassi, teemat või õpilase lahendust. Arvutaju otsib töövihikust lähima ülesande ja aitab kavandada lühikese arutelu, kus õpilaste mõttekäigud saavad nähtavaks.",
    referencesTitle: "Töövihiku kontekst",
    noReferences: "Sobiv kontekst ilmub siia pärast esimest küsimust.",
    workbookReference: "Ava töövihiku vaade",
    generateSimilar: "Loo sarnaseid ülesandeid",
    generatedTitle: "Sarnased ülesanded",
    generationNote:
      "Tekst genereeritakse AI abil, kuid strateegiate pildid tulevad töövihiku allikfailidest.",
    ruleAiTitle: "Reeglid + AI",
    ruleAiBody:
      "Valik ja kontroll on reeglipõhine: kasutame töövihiku ülesandeid, lehekülgi, strateegiaid ja olemasolevaid pilte. AI sõnastab õpetaja vastuse, aruteluküsimused ja uued tekstülesanded valitud konteksti järgi.",
    sourceImages: "Allikpildid",
    selectedReference: "Valitud kontekst",
    examples: [
      "4. klass, lahutamine arvteljel. Kuidas seda arutada?",
      "Õpilane lahendas 56 - 8 nii: 56 - 6 - 2. Mis strateegia see on?",
      "Loo samas stiilis ülesanne koos võimalike strateegiatega.",
    ],
    error: "Midagi läks valesti. Palun proovi uuesti.",
  },
  en: {
    promptPlaceholder:
      "Ask from the workbook, attach student work, or request a similar task...",
    attach: "Attach image",
    send: "Send",
    searching: "Finding the closest workbook context...",
    thinking: "Writing a response...",
    assistantTitle: "AI workflow for teachers",
    assistantIntro:
      "Describe the grade, topic, or student strategy. Arvutaju finds the closest workbook task and helps plan a short discussion where students' thinking becomes visible.",
    referencesTitle: "Workbook context",
    noReferences: "A relevant context will appear here after your first question.",
    workbookReference: "Open workbook view",
    generateSimilar: "Generate similar tasks",
    generatedTitle: "Similar tasks",
    generationNote:
      "Text is AI-generated, while strategy images come from the workbook source files.",
    ruleAiTitle: "Rules + AI",
    ruleAiBody:
      "Selection and verification are rule-based: we use workbook tasks, pages, strategies, and existing source images. AI writes the teacher response, discussion questions, and new text tasks from the selected context.",
    sourceImages: "Source images",
    selectedReference: "Selected context",
    examples: [
      "Grade 4, subtraction on a number line. How should I discuss it?",
      "A student solved 56 - 8 as 56 - 6 - 2. What strategy is this?",
      "Create a similar task with possible strategies.",
    ],
    error: "Something went wrong. Please try again.",
  },
};

export default function TeacherAssistantFlow({ lang }: { lang: Language }) {
  const copy = copyByLang[lang];
  const isEt = lang === "et";
  const [input, setInput] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [generated, setGenerated] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visibleMessages = useMemo(
    () => messages.filter((message) => getMessageText(message.content).trim()),
    [messages],
  );

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = input.trim();
    if ((!trimmed && !imageDataUrl) || isThinking) return;

    setIsSearching(true);
    const contextTasks = await findContext(trimmed || (isEt ? "õpilase töö pilt" : "student work image"));
    setIsSearching(false);

    const contextTask = contextTasks[0] ?? selectedTask;
    if (contextTasks.length > 0) {
      setTasks(contextTasks);
      setSelectedTask(contextTask);
    }

    const userContent = buildUserContent(trimmed, imageDataUrl, isEt);
    const nextMessages = [...messages, { role: "user", content: userContent } satisfies ChatMessage];

    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setImageDataUrl(null);
    setIsThinking(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          taskSlug: contextTask?.slug,
          lang,
        }),
      });

      if (!response.ok || !response.body) throw new Error(`Chat failed: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setMessages([...nextMessages, { role: "assistant", content: fullText }]);
      }
    } catch {
      setMessages([...nextMessages, { role: "assistant", content: copy.error }]);
    } finally {
      setIsThinking(false);
    }
  }

  async function findContext(query: string): Promise<Task[]> {
    try {
      const response = await fetch(`/api/tasks?q=${encodeURIComponent(query)}&sort=workbook`);
      if (!response.ok) return [];
      const data = await response.json();
      return (data.tasks ?? []).slice(0, 4);
    } catch {
      return [];
    }
  }

  async function generateSimilarTasks() {
    if (!selectedTask || isGenerating) return;
    setIsGenerating(true);
    setGenerated([]);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskSlug: selectedTask.slug, lang }),
      });
      const data = await response.json();
      setGenerated(data.problems ?? []);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setImageDataUrl(reader.result);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  return (
    <section id="alusta" className="mx-auto mt-10 grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="rounded-[1.75rem] border border-[#eadfd4] bg-white p-4 shadow-lg shadow-[#b09cf0]/10 sm:p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[#1b1b1f]">{copy.assistantTitle}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f5b57]">{copy.assistantIntro}</p>
        </div>

        <div className="min-h-[18rem] rounded-2xl border border-[#eadfd4] bg-[#fffaf4] p-3">
          {visibleMessages.length === 0 ? (
            <div className="grid gap-2 sm:grid-cols-3">
              {copy.examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setInput(example)}
                  className="min-h-24 rounded-xl border border-[#eadfd4] bg-white p-3 text-left text-sm leading-5 text-[#5f5b57] transition-colors hover:border-[#b09cf0] hover:text-[#1b1b1f]"
                >
                  {example}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleMessages.map((message, index) => (
                <MessageBubble key={index} message={message} />
              ))}
            </div>
          )}

          {(isSearching || isThinking) && (
            <p className="mt-3 text-sm font-medium text-[#7c63d8]">
              {isSearching ? copy.searching : copy.thinking}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-4">
          {imageDataUrl && (
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-[#eadfd4] bg-[#fffaf4] p-2">
              <img
                src={imageDataUrl}
                alt=""
                className="h-14 w-14 rounded-lg object-cover"
              />
              <span className="flex-1 text-sm text-[#5f5b57]">{copy.attach}</span>
              <button
                type="button"
                onClick={() => setImageDataUrl(null)}
                className="h-8 w-8 rounded-full text-[#8a8179] hover:bg-white"
                aria-label="Remove image"
              >
                x
              </button>
            </div>
          )}

          <label htmlFor="teacher-prompt" className="sr-only">
            {copy.promptPlaceholder}
          </label>
          <textarea
            id="teacher-prompt"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={copy.promptPlaceholder}
            className="min-h-28 w-full resize-none rounded-2xl border border-[#eadfd4] bg-white px-4 py-3 text-base leading-7 text-[#1b1b1f] outline-none transition-colors placeholder:text-[#8a8179] focus:border-[#b09cf0]"
          />

          <div className="mt-3 flex items-center justify-between gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-10 items-center rounded-full border border-[#eadfd4] px-4 text-sm font-semibold text-[#5f5b57] transition-colors hover:border-[#b09cf0] hover:text-[#1b1b1f]"
            >
              {copy.attach}
            </button>
            <button
              type="submit"
              disabled={isThinking || (!input.trim() && !imageDataUrl)}
              className="inline-flex h-10 items-center rounded-full bg-[#1b1b1f] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#34343a] disabled:cursor-not-allowed disabled:bg-[#b8b1aa]"
            >
              {copy.send}
            </button>
          </div>
        </form>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-[#eadfd4] bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[#1b1b1f]">{copy.referencesTitle}</h2>
              <p className="mt-1 text-xs leading-5 text-[#6c665f]">
                {selectedTask ? copy.selectedReference : copy.noReferences}
              </p>
            </div>
            <Link href="/workbook" className="text-xs font-semibold text-[#6a50d4] hover:text-[#4d34b8]">
              {copy.workbookReference}
            </Link>
          </div>

          {tasks.length > 0 && (
            <div className="mt-4 space-y-2">
              {tasks.map((task) => (
                <button
                  key={task._id}
                  type="button"
                  onClick={() => setSelectedTask(task)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    selectedTask?._id === task._id
                      ? "border-[#7c63d8] bg-[#f7f3ff]"
                      : "border-[#eadfd4] bg-white hover:border-[#b09cf0]"
                  }`}
                >
                  <span className="block text-sm font-semibold text-[#1b1b1f]">
                    {isEt ? task.titleEt : task.title}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[#6c665f]">
                    {isEt ? task.problemEt : task.problem}
                  </span>
                  <span className="mt-2 block text-xs font-medium text-[#7c63d8]">
                    {pageLabel(task, isEt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedTask && (
          <div className="rounded-2xl border border-[#eadfd4] bg-white p-4">
            <h3 className="text-sm font-semibold text-[#1b1b1f]">{copy.sourceImages}</h3>
            <SourceImages task={selectedTask} isEt={isEt} />
            <button
              type="button"
              onClick={generateSimilarTasks}
              disabled={isGenerating}
              className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-full bg-[#fc6513] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#df560d] disabled:cursor-wait disabled:bg-[#f2a57a]"
            >
              {isGenerating ? copy.thinking : copy.generateSimilar}
            </button>
            {generated.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-[#1b1b1f]">{copy.generatedTitle}</h4>
                <ol className="mt-2 space-y-2 text-sm leading-6 text-[#5f5b57]">
                  {generated.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
                <p className="mt-3 text-xs leading-5 text-[#8a8179]">{copy.generationNote}</p>
              </div>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-[#eadfd4] bg-[#fffaf4] p-4">
          <h3 className="text-sm font-semibold text-[#1b1b1f]">{copy.ruleAiTitle}</h3>
          <p className="mt-2 text-sm leading-6 text-[#5f5b57]">{copy.ruleAiBody}</p>
        </div>
      </aside>
    </section>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const text = getMessageText(message.content);
  const image = getMessageImage(message.content);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[48rem] rounded-2xl px-4 py-3 text-sm leading-6 ${
          isUser
            ? "bg-[#1b1b1f] text-white"
            : "border border-[#eadfd4] bg-white text-[#1b1b1f]"
        }`}
      >
        {image && <img src={image} alt="" className="mb-3 max-h-56 rounded-xl object-contain" />}
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}

function SourceImages({ task, isEt }: { task: Task; isEt: boolean }) {
  const images = getSourceImages(task);

  if (images.length === 0) {
    return (
      <p className="mt-2 text-sm leading-6 text-[#6c665f]">
        {isEt ? "Selle ülesande allikpilte ei ole veel lisatud." : "No source images are attached yet."}
      </p>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {images.slice(0, 4).map((image) => (
        <Link
          key={image.url}
          href={`/tasks/${task.slug}`}
          className="group overflow-hidden rounded-xl border border-[#eadfd4] bg-[#fffaf4]"
        >
          <img
            src={image.url}
            alt={image.label ?? (isEt ? task.titleEt : task.title)}
            className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.03]"
          />
        </Link>
      ))}
    </div>
  );
}

function buildUserContent(text: string, imageDataUrl: string | null, isEt: boolean): ChatMessage["content"] {
  if (!imageDataUrl) return text;

  return [
    { type: "text", text: text || (isEt ? "Palun analüüsi seda õpilase tööd." : "Please analyze this student work.") },
    { type: "image_url", image_url: { url: imageDataUrl } },
  ];
}

function getMessageText(content: ChatMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .filter((part): part is Extract<ContentPart, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function getMessageImage(content: ChatMessage["content"]): string | null {
  if (typeof content === "string") return null;
  return content.find((part) => part.type === "image_url")?.image_url.url ?? null;
}

function getSourceImages(task: Task) {
  const assets = [...(task.workbookAssets ?? [])]
    .filter((asset) => asset.kind === "task" || asset.kind === "strategy")
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  if (assets.length > 0) return assets;

  return [...(task.strategyImageUrls ?? []), task.imageUrl, task.pageImageUrl]
    .filter((url): url is string => Boolean(url))
    .map((url, order) => ({
      url,
      order,
      kind: "strategy" as const,
      page: task.sourcePageNumber ?? task.pageRef ?? 0,
      label: undefined,
    }));
}

function pageLabel(task: Task, isEt: boolean) {
  const page = task.sourcePageNumber ?? task.pageRef;
  const part = task.workbookPart ? `${isEt ? "osa" : "part"} ${task.workbookPart}` : "";
  const pageText = page ? `${isEt ? "lk" : "p."} ${page}` : "";
  return [part, pageText].filter(Boolean).join(" · ");
}
