"use client";

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type RetrievalState = {
  mode: string;
  count: number;
} | null;

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
    sourceImages: "Töövihiku visuaalid",
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
    sourceImages: "Workbook visuals",
    selectedReference: "Selected context",
    examples: [
      "Grade 4, subtraction on a number line. How should I discuss it?",
      "A student solved 56 - 8 as 56 - 6 - 2. What strategy is this?",
      "Create a similar task with possible strategies.",
    ],
    error: "Something went wrong. Please try again.",
  },
};

const MAX_RETRIEVED_TASKS = 8;

export default function TeacherAssistantFlow({
  lang,
  initialPrompt = "",
}: {
  lang: Language;
  initialPrompt?: string;
}) {
  const copy = copyByLang[lang];
  const isEt = lang === "et";
  const [input, setInput] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [generated, setGenerated] = useState<string[]>([]);
  const [retrieval, setRetrieval] = useState<RetrievalState>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isWorkbookExpanded, setIsWorkbookExpanded] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const didSendInitialPrompt = useRef(false);

  const visibleMessages = useMemo(
    () => messages.filter((message) => getMessageText(message.content).trim()),
    [messages],
  );

  const findContext = useCallback(async (query: string): Promise<Task[]> => {
    try {
      const response = await fetch(`/api/tasks?q=${encodeURIComponent(query)}&sort=workbook`);
      if (!response.ok) return [];
      const data = await response.json();
      setRetrieval(data.retrieval ?? { mode: data.source ?? "unknown", count: data.tasks?.length ?? 0 });
      return (data.tasks ?? []).slice(0, MAX_RETRIEVED_TASKS);
    } catch {
      return [];
    }
  }, []);

  const sendPrompt = useCallback(async (promptText: string, promptImageDataUrl: string | null) => {
    if ((!promptText.trim() && !promptImageDataUrl) || isThinking) return;

    const trimmed = promptText.trim();
    setIsSearching(true);
    const contextTasks = await findContext(trimmed || (isEt ? "õpilase töö pilt" : "student work image"));
    setIsSearching(false);

    const contextTask = contextTasks[0] ?? selectedTask;
    if (contextTasks.length > 0) {
      setTasks(contextTasks);
      setSelectedTask(contextTask);
    }

    const userContent = buildUserContent(trimmed, promptImageDataUrl, isEt);
    const nextMessages = [...messages, { role: "user", content: userContent } satisfies ChatMessage];

    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setImageDataUrl(null);
    setIsThinking(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          taskSlug: contextTask?.slug,
          contextTasks: contextTasks.length > 0
            ? contextTasks.slice(0, MAX_RETRIEVED_TASKS)
            : tasks.slice(0, MAX_RETRIEVED_TASKS),
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
  }, [copy.error, findContext, isEt, isThinking, lang, messages, selectedTask, tasks]);

  useEffect(() => {
    if (!initialPrompt || didSendInitialPrompt.current) return;
    didSendInitialPrompt.current = true;
    void sendPrompt(initialPrompt, null);
  }, [initialPrompt, sendPrompt]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      )
      .catch(() => {
        // Best-effort cleanup for stale local dev service workers.
      });
  }, []);

  useEffect(() => {
    if (initialPrompt || tasks.length > 0) return;

    let ignore = false;

    async function loadStarterContext() {
      try {
        const response = await fetch("/api/tasks?sort=workbook");
        if (!response.ok) return;
        const data = await response.json();
        const starterTasks = (data.tasks ?? []).slice(0, 6);
        if (!ignore) {
          setTasks(starterTasks);
          setSelectedTask(starterTasks[0] ?? null);
          setRetrieval(data.retrieval ?? { mode: data.source ?? "filter", count: starterTasks.length });
        }
      } catch {
        // Starter context is helpful, but not required for chat.
      }
    }

    void loadStarterContext();

    return () => {
      ignore = true;
    };
  }, [initialPrompt, tasks.length]);

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = input.trim();
    if ((!trimmed && !imageDataUrl) || isThinking) return;
    await sendPrompt(trimmed, imageDataUrl);
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
    <section
      id="alusta"
      className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[24rem_minmax(0,1fr)]"
    >
      <aside className="lg:sticky lg:top-20">
        <div className="flex h-[calc(100svh-6rem)] min-h-[42rem] flex-col rounded-[1.75rem] border border-[#eadfd4] bg-white p-4 shadow-lg shadow-[#b09cf0]/10">
          <div className="border-b border-[#eadfd4] pb-4">
            <h2 className="text-base font-semibold text-[#1b1b1f]">{copy.assistantTitle}</h2>
            <p className="mt-1 text-xs leading-5 text-[#6c665f]">
              {isEt
                ? "Kasuta vestlust nähtava töövihiku materjali täpsustamiseks."
                : "Use chat to explain and refine the visible workbook material."}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-3">
            {visibleMessages.length === 0 ? (
              <div className="space-y-2">
                {copy.examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setInput(example)}
                    className="w-full rounded-xl border border-[#eadfd4] bg-[#fffaf4] p-3 text-left text-sm leading-5 text-[#5f5b57] transition-colors hover:border-[#b09cf0] hover:text-[#1b1b1f]"
                  >
                    {example}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {visibleMessages.map((message, index) => (
                  <MessageBubble key={index} message={message} compact />
                ))}
              </div>
            )}

            {(isSearching || isThinking) && (
              <p className="mt-3 text-sm font-medium text-[#7c63d8]">
                {isSearching ? copy.searching : copy.thinking}
              </p>
            )}

            {tasks.length > 0 && (
              <div className="mt-3 border-t border-[#eadfd4] pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#7c63d8]">
                  {isEt ? "Leitud töövihiku ülesanded" : "Retrieved workbook tasks"}
                </p>
                <div className="space-y-1.5">
                  {tasks.map((task) => (
                    <button
                      key={task._id}
                      type="button"
                      onClick={() => setSelectedTask(task)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                        selectedTask?._id === task._id
                          ? "border-[#7c63d8] bg-[#f7f3ff]"
                          : "border-[#eadfd4] bg-white hover:border-[#b09cf0]"
                      }`}
                    >
                      <span className="line-clamp-1 block text-xs font-semibold text-[#1b1b1f]">
                        {isEt ? task.titleEt : task.title}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-[0.7rem] leading-4 text-[#6c665f]">
                        {isEt ? task.problemEt : task.problem}
                      </span>
                      <span className="mt-1 block text-[0.68rem] font-medium text-[#7c63d8]">
                        {pageLabel(task, isEt)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-[#eadfd4] pt-3">
            {imageDataUrl && (
              <div className="mb-3 flex items-center gap-3 rounded-xl border border-[#eadfd4] bg-[#fffaf4] p-2">
                <img src={imageDataUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
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
              className="min-h-24 w-full resize-none rounded-2xl border border-[#eadfd4] bg-white px-4 py-3 text-sm leading-6 text-[#1b1b1f] outline-none transition-colors placeholder:text-[#8a8179] focus:border-[#b09cf0]"
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
      </aside>

      <main className="space-y-4">
        {tasks.length > 0 && (
          <TaskContextStrip
            tasks={tasks}
            selectedTask={selectedTask}
            isEt={isEt}
            onSelect={setSelectedTask}
          />
        )}

        {selectedTask ? (
          <WorkbookMaterial
            task={selectedTask}
            isEt={isEt}
            generated={generated}
            isGenerating={isGenerating}
            copy={copy}
            retrieval={retrieval}
            isWorkbookExpanded={isWorkbookExpanded}
            onToggleWorkbook={() => setIsWorkbookExpanded((value) => !value)}
            onGenerate={generateSimilarTasks}
          />
        ) : (
          <StarterWorkbookPanel
            examples={copy.examples}
            onExample={(example) => setInput(example)}
            isSearching={isSearching}
            searchingLabel={copy.searching}
          />
        )}
      </main>
    </section>
  );
}

function TaskContextStrip({
  tasks,
  selectedTask,
  isEt,
  onSelect,
}: {
  tasks: Task[];
  selectedTask: Task | null;
  isEt: boolean;
  onSelect: (task: Task) => void;
}) {
  return (
    <div className="rounded-2xl border border-[#eadfd4] bg-white/90 p-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-xs font-semibold uppercase text-[#7c63d8]">
          {isEt ? "Leitud töövihiku ülesanded" : "Retrieved workbook tasks"}
        </p>
        <p className="text-xs text-[#8a8179]">{tasks.length}</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tasks.map((task) => (
          <button
            key={task._id}
            type="button"
            onClick={() => onSelect(task)}
            className={`min-w-[11rem] rounded-lg border px-3 py-2 text-left transition-colors ${
              selectedTask?._id === task._id
                ? "border-[#7c63d8] bg-[#f7f3ff]"
                : "border-[#eadfd4] bg-white hover:border-[#b09cf0]"
            }`}
          >
            <span className="line-clamp-1 block text-xs font-semibold text-[#1b1b1f]">
              {isEt ? task.titleEt : task.title}
            </span>
            <span className="mt-1 line-clamp-1 block text-[0.7rem] leading-4 text-[#6c665f]">
              {isEt ? task.problemEt : task.problem}
            </span>
            <span className="mt-1 block text-[0.68rem] font-medium text-[#7c63d8]">
              {pageLabel(task, isEt)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StarterWorkbookPanel({
  examples,
  onExample,
  isSearching,
  searchingLabel,
}: {
  examples: string[];
  onExample: (example: string) => void;
  isSearching: boolean;
  searchingLabel: string;
}) {
  return (
    <div className="rounded-[1.75rem] border border-[#eadfd4] bg-white p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onExample(example)}
            className="min-h-28 rounded-xl border border-[#eadfd4] bg-[#fffaf4] p-4 text-left text-sm leading-6 text-[#5f5b57] transition-colors hover:border-[#b09cf0] hover:text-[#1b1b1f]"
          >
            {example}
          </button>
        ))}
      </div>
      {isSearching && <p className="mt-4 text-sm font-medium text-[#7c63d8]">{searchingLabel}</p>}
    </div>
  );
}

function WorkbookMaterial({
  task,
  isEt,
  generated,
  isGenerating,
  copy,
  retrieval,
  isWorkbookExpanded,
  onToggleWorkbook,
  onGenerate,
}: {
  task: Task;
  isEt: boolean;
  generated: string[];
  isGenerating: boolean;
  copy: Copy;
  retrieval: RetrievalState;
  isWorkbookExpanded: boolean;
  onToggleWorkbook: () => void;
  onGenerate: () => void;
}) {
  const images = getSourceImages(task);
  const primaryImage = images.find((image) => image.kind === "task") ?? images[0];
  const strategyImages = images.filter((image) => image.url !== primaryImage?.url);
  const misconceptions = isEt ? task.commonMisconceptionsEt : task.commonMisconceptions;
  const [openDialog, setOpenDialog] = useState<"strategies" | "watch" | null>(null);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[1.75rem] border border-[#eadfd4] bg-white shadow-lg shadow-[#b09cf0]/10">
        <div className="flex flex-col gap-3 border-b border-[#eadfd4] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-[#7c63d8]">
              {isEt ? "Töövihiku ülesanne" : "Workbook task"}
            </p>
            <h1 className="mt-1 text-xl font-semibold text-[#1b1b1f]">
              {isEt ? task.titleEt : task.title}
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#5f5b57]">
              {isEt ? task.problemEt : task.problem}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge>{pageLabel(task, isEt) || "Arvutaju"}</Badge>
              <Badge>{isEt ? `${task.gradeMin}-${task.gradeMax} klass` : `Grades ${task.gradeMin}-${task.gradeMax}`}</Badge>
              <Badge>{task.operation}</Badge>
              <Badge>{task.difficulty}</Badge>
              {typeof task.score === "number" && (
                <Badge>{isEt ? "sobivus" : "match"} {Math.round(task.score * 100)}%</Badge>
              )}
              {retrieval && (
                <Badge>
                  {retrieval.mode === "vector"
                    ? isEt ? "vektorotsing" : "vector search"
                    : isEt ? "varuotsing" : "fallback search"}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onToggleWorkbook}
              className="inline-flex h-9 items-center rounded-full border border-[#eadfd4] px-3 text-xs font-semibold text-[#5f5b57] transition-colors hover:border-[#b09cf0] hover:text-[#1b1b1f]"
            >
              {isWorkbookExpanded ? (isEt ? "Minimeeri" : "Minimize") : (isEt ? "Laienda" : "Expand")}
            </button>
            <TeacherSupportPopover
              label={isEt ? "Õpetaja tugi" : "Teacher support"}
              content={isEt ? task.facilitationEt : task.facilitation}
              isEt={isEt}
            />
            <button
              type="button"
              onClick={onGenerate}
              disabled={isGenerating}
              className="inline-flex h-9 items-center rounded-full bg-[#fc6513] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#df560d] disabled:cursor-wait disabled:bg-[#f2a57a]"
            >
              {isGenerating ? copy.thinking : copy.generateSimilar}
            </button>
          </div>
        </div>

        {isWorkbookExpanded && (
          <div className="grid gap-4 bg-[#fffaf4] p-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
            <div className="rounded-xl border border-[#eadfd4] bg-white p-3">
              {primaryImage ? (
                <img
                  src={primaryImage.url}
                  alt={primaryImage.label ?? (isEt ? task.titleEt : task.title)}
                  className="max-h-[44rem] w-full rounded-lg object-contain"
                />
              ) : (
                <div className="flex min-h-80 items-center justify-center rounded-xl border border-dashed border-[#d9cec3] text-sm text-[#8a8179]">
                  {isEt ? "Töövihiku pilti ei leitud." : "No workbook image found."}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {strategyImages.length > 0 && (
                <CollapsibleCard
                  title={copy.sourceImages}
                  defaultOpen
                  summary={isEt ? "Töövihiku visuaalne strateegiatugi" : "Verified workbook strategy visuals"}
                >
                  <div className="grid gap-3">
                    {strategyImages.slice(0, 3).map((image) => (
                      <img
                        key={image.url}
                        src={image.url}
                        alt={image.label ?? (isEt ? task.titleEt : task.title)}
                        className="max-h-[24rem] w-full rounded-xl border border-[#eadfd4] bg-[#fffaf4] object-contain"
                      />
                    ))}
                  </div>
                </CollapsibleCard>
              )}

              <DialogLaunchCard
                title={isEt ? "Võimalikud strateegiad" : "Possible strategies"}
                hint={isEt ? `${task.strategies.length} strateegiat` : `${task.strategies.length} strategies`}
                actionLabel={isEt ? "Ava" : "Open"}
                onOpen={() => setOpenDialog("strategies")}
              />

              {misconceptions.length > 0 && (
                <DialogLaunchCard
                  title={isEt ? "Mida jälgida" : "What to watch for"}
                  hint={isEt ? `${misconceptions.length} tähelepanekut` : `${misconceptions.length} watch points`}
                  actionLabel={isEt ? "Ava" : "Open"}
                  onOpen={() => setOpenDialog("watch")}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {openDialog === "strategies" && (
        <WorkbookDialog
          title={isEt ? "Võimalikud strateegiad" : "Possible strategies"}
          subtitle={isEt ? task.problemEt : task.problem}
          closeLabel={isEt ? "Sulge" : "Close"}
          onClose={() => setOpenDialog(null)}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {task.strategies.map((strategy, index) => (
              <StrategyVisualCard
                key={strategy.name}
                strategy={strategy}
                index={index}
                isEt={isEt}
              />
            ))}
          </div>
        </WorkbookDialog>
      )}

      {openDialog === "watch" && (
        <WorkbookDialog
          title={isEt ? "Mida jälgida" : "What to watch for"}
          subtitle={isEt ? task.problemEt : task.problem}
          closeLabel={isEt ? "Sulge" : "Close"}
          onClose={() => setOpenDialog(null)}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {misconceptions.slice(0, 6).map((misconception, index) => (
              <WatchForVisualCard
                key={misconception}
                text={misconception}
                index={index}
                isEt={isEt}
              />
            ))}
          </div>
        </WorkbookDialog>
      )}

      {generated.length > 0 && (
        <div className="rounded-[1.75rem] border border-[#eadfd4] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#1b1b1f]">{copy.generatedTitle}</h2>
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <ol className="grid gap-2 text-sm leading-6 text-[#5f5b57]">
              {generated.map((item) => (
                <GeneratedTaskCard
                  key={item}
                  text={item}
                  task={task}
                  isEt={isEt}
                />
              ))}
            </ol>
            <div className="rounded-xl border border-[#eadfd4] bg-[#fffaf4] p-3">
              <p className="text-xs font-semibold uppercase text-[#7c63d8]">
                {isEt ? "Visuaalne põhimõte" : "Visual principle"}
              </p>
              <p className="mt-2 text-xs leading-5 text-[#6c665f]">
                {copy.generationNote}
              </p>
              {primaryImage && (
                <img
                  src={primaryImage.url}
                  alt=""
                  className="mt-3 max-h-48 w-full rounded-lg object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-[#f7efe7] px-2.5 py-1 text-xs font-medium text-[#5f5b57]">
      {children}
    </span>
  );
}

function TeacherSupportPopover({
  label,
  content,
  isEt,
}: {
  label: string;
  content: string;
  isEt: boolean;
}) {
  return (
    <details className="group relative">
      <summary
        className="inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-[#eadfd4] text-sm font-semibold text-[#5f5b57] transition-colors hover:border-[#b09cf0] hover:text-[#1b1b1f]"
        title={`${label}: ${content}`}
        aria-label={label}
      >
        ?
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-[#eadfd4] bg-white p-4 text-sm leading-6 text-[#5f5b57] shadow-lg shadow-[#b09cf0]/10">
        <p className="mb-2 text-xs font-semibold uppercase text-[#7c63d8]">
          {isEt ? "Õpetaja tugi" : "Teacher support"}
        </p>
        {content}
      </div>
    </details>
  );
}

function DialogLaunchCard({
  title,
  hint,
  actionLabel,
  onOpen,
}: {
  title: string;
  hint: string;
  actionLabel: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-[#eadfd4] bg-white px-3 text-left transition-colors hover:border-[#b09cf0]"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[#1b1b1f]">{title}</span>
        <span className="block text-xs text-[#8a8179]">{hint}</span>
      </span>
      <span className="shrink-0 text-xs font-semibold text-[#7c63d8]">
        {actionLabel}
      </span>
    </button>
  );
}

function WorkbookDialog({
  title,
  subtitle,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b1b1f]/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workbook-dialog-title"
      onClick={onClose}
    >
      <div
        className="max-h-[86svh] w-full max-w-4xl overflow-hidden rounded-[1.5rem] border border-[#eadfd4] bg-white shadow-2xl shadow-[#1b1b1f]/20"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#eadfd4] px-5 py-4">
          <div>
            <h2 id="workbook-dialog-title" className="text-lg font-semibold text-[#1b1b1f]">
              {title}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#6c665f]">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-full border border-[#eadfd4] px-3 text-xs font-semibold text-[#5f5b57] transition-colors hover:border-[#b09cf0] hover:text-[#1b1b1f]"
          >
            {closeLabel}
          </button>
        </div>
        <div className="max-h-[calc(86svh-6rem)] overflow-y-auto bg-[#fffaf4] p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

function CollapsibleCard({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      {...(defaultOpen ? { open: true } : {})}
      className="group rounded-xl border border-[#eadfd4] bg-white p-3"
    >
      <summary className="cursor-pointer list-none">
        <span className="flex items-start justify-between gap-3">
          <span>
            <span className="block text-sm font-semibold text-[#1b1b1f]">{title}</span>
            {summary && (
              <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[#8a8179]">
                {summary}
              </span>
            )}
          </span>
          <span className="text-sm font-semibold text-[#7c63d8] group-open:rotate-180">⌄</span>
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function StrategyVisualCard({
  strategy,
  index,
  isEt,
}: {
  strategy: Strategy;
  index: number;
  isEt: boolean;
}) {
  return (
    <div className="grid min-h-44 grid-rows-[5rem_1fr] overflow-hidden rounded-xl border border-[#eadfd4] bg-[#fffaf4]">
      <StrategyMiniVisual index={index} />
      <div className="p-3">
        <p className="text-sm font-semibold text-[#1b1b1f]">
          {isEt ? strategy.nameEt : strategy.name}
        </p>
        <p className="mt-1 line-clamp-3 text-xs leading-5 text-[#5f5b57]">
          {isEt ? strategy.descriptionEt : strategy.description}
        </p>
        {strategy.example && (
          <p className="mt-2 rounded-lg bg-white px-2.5 py-2 text-[0.7rem] font-medium leading-4 text-[#6c665f]">
            {strategy.example}
          </p>
        )}
      </div>
    </div>
  );
}

function StrategyMiniVisual({ index }: { index: number }) {
  const variant = index % 4;

  if (variant === 0) {
    return (
      <svg viewBox="0 0 220 80" className="h-20 w-full bg-white" role="img" aria-label="strategy visual">
        <rect x="16" y="18" width="48" height="20" rx="6" fill="#f7efe7" stroke="#1b1b1f" />
        <rect x="78" y="18" width="48" height="20" rx="6" fill="#f7efe7" stroke="#1b1b1f" />
        <rect x="140" y="18" width="48" height="20" rx="6" fill="#f7efe7" stroke="#1b1b1f" />
        <path d="M40 50 C70 68 134 68 164 50" fill="none" stroke="#fc6513" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  if (variant === 1) {
    return (
      <svg viewBox="0 0 220 80" className="h-20 w-full bg-white" role="img" aria-label="strategy visual">
        <line x1="22" y1="48" x2="198" y2="48" stroke="#1b1b1f" strokeWidth="2" />
        <path d="M48 48 Q76 18 104 48" fill="none" stroke="#7c63d8" strokeWidth="4" strokeLinecap="round" />
        <path d="M104 48 Q132 18 160 48" fill="none" stroke="#fc6513" strokeWidth="4" strokeLinecap="round" />
        <circle cx="48" cy="48" r="4" fill="#1b1b1f" />
        <circle cx="104" cy="48" r="4" fill="#1b1b1f" />
        <circle cx="160" cy="48" r="4" fill="#1b1b1f" />
      </svg>
    );
  }

  if (variant === 2) {
    const dots = Array.from({ length: 12 }, (_, dotIndex) => (
      <circle
        key={dotIndex}
        cx={66 + (dotIndex % 4) * 22}
        cy={22 + Math.floor(dotIndex / 4) * 16}
        r="4"
        fill="#1b1b1f"
      />
    ));
    return (
      <svg viewBox="0 0 220 80" className="h-20 w-full bg-white" role="img" aria-label="strategy visual">
        <rect x="54" y="12" width="98" height="56" rx="12" fill="#fffaf4" stroke="#eadfd4" />
        {dots}
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 220 80" className="h-20 w-full bg-white" role="img" aria-label="strategy visual">
      <circle cx="68" cy="40" r="20" fill="#f7efe7" stroke="#1b1b1f" />
      <circle cx="110" cy="40" r="20" fill="#f7efe7" stroke="#1b1b1f" />
      <circle cx="152" cy="40" r="20" fill="#f7efe7" stroke="#1b1b1f" />
      <path d="M68 40 H152" stroke="#fc6513" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function WatchForVisualCard({
  text,
  index,
  isEt,
}: {
  text: string;
  index: number;
  isEt: boolean;
}) {
  return (
    <div className="grid min-h-32 grid-cols-[4.25rem_minmax(0,1fr)] overflow-hidden rounded-xl border border-[#eadfd4] bg-[#fffaf4]">
      <div className="flex items-center justify-center bg-white">
        <WatchMiniVisual index={index} />
      </div>
      <div className="p-3">
        <p className="text-[0.68rem] font-semibold uppercase text-[#7c63d8]">
          {isEt ? "Jälgi" : "Watch"}
        </p>
        <p className="mt-1 line-clamp-4 text-xs leading-5 text-[#5f5b57]">{text}</p>
      </div>
    </div>
  );
}

function WatchMiniVisual({ index }: { index: number }) {
  const colors = ["#fc6513", "#7c63d8", "#1b1b1f", "#b86b28"];
  const color = colors[index % colors.length];

  return (
    <svg viewBox="0 0 56 56" className="h-12 w-12" role="img" aria-label="watch for visual">
      <circle cx="28" cy="28" r="24" fill="#fffaf4" stroke="#eadfd4" />
      <path d="M28 12 L44 42 H12 Z" fill="white" stroke={color} strokeWidth="3" strokeLinejoin="round" />
      <line x1="28" y1="23" x2="28" y2="32" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <circle cx="28" cy="38" r="2" fill={color} />
    </svg>
  );
}

type GeneratedVisual =
  | { kind: "dots"; count: number }
  | { kind: "number-line"; start: number; step: number; end: number }
  | { kind: "array"; rows: number; columns: number }
  | null;

function GeneratedTaskCard({
  text,
  task,
  isEt,
}: {
  text: string;
  task: Task;
  isEt: boolean;
}) {
  const visual = buildGeneratedVisual(text, task);

  return (
    <li className="grid gap-3 rounded-xl border border-[#eadfd4] bg-[#fffaf4] px-4 py-3 md:grid-cols-[minmax(0,1fr)_12rem]">
      <MarkdownText text={text} />
      <div className="rounded-lg border border-[#eadfd4] bg-white p-2">
        <p className="mb-2 text-[0.68rem] font-semibold uppercase text-[#7c63d8]">
          {isEt ? "Reeglipõhine pilt" : "Rule-based visual"}
        </p>
        {visual ? (
          <RuleBasedVisual visual={visual} />
        ) : (
          <p className="text-xs leading-5 text-[#6c665f]">
            {isEt
              ? "Arvud ei ole piisavalt üheselt loetavad. Kasuta kontrollitud töövihiku visuaali või deterministlikku malligeneraatorit."
              : "The numbers are not unambiguous enough. Use the verified workbook visual or a deterministic template renderer."}
          </p>
        )}
      </div>
    </li>
  );
}

function RuleBasedVisual({ visual }: { visual: Exclude<GeneratedVisual, null> }) {
  if (visual.kind === "dots") {
    const cols = Math.min(10, Math.ceil(Math.sqrt(visual.count)));
    const dots = Array.from({ length: visual.count }, (_, dotIndex) => {
      const x = 16 + (dotIndex % cols) * 16;
      const y = 18 + Math.floor(dotIndex / cols) * 16;
      return <circle key={dotIndex} cx={x} cy={y} r="4" fill="#1b1b1f" />;
    });
    const height = Math.max(56, 34 + Math.ceil(visual.count / cols) * 16);
    return (
      <svg viewBox={`0 0 180 ${height}`} className="h-28 w-full" role="img" aria-label={`${visual.count} dots`}>
        <rect width="180" height={height} rx="10" fill="#fffaf4" />
        {dots}
      </svg>
    );
  }

  if (visual.kind === "array") {
    const cell = 14;
    const width = 28 + visual.columns * cell;
    const height = 28 + visual.rows * cell;
    const dots = Array.from({ length: visual.rows * visual.columns }, (_, dotIndex) => {
      const x = 14 + (dotIndex % visual.columns) * cell;
      const y = 14 + Math.floor(dotIndex / visual.columns) * cell;
      return <circle key={dotIndex} cx={x} cy={y} r="3.5" fill="#1b1b1f" />;
    });
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full" role="img" aria-label={`${visual.rows} by ${visual.columns} array`}>
        <rect width={width} height={height} rx="10" fill="#fffaf4" />
        {dots}
      </svg>
    );
  }

  const isSubtraction = visual.step < 0;
  const min = Math.min(visual.start, visual.end);
  const max = Math.max(visual.start, visual.end);
  const span = Math.max(1, max - min);
  const startX = 18 + ((visual.start - min) / span) * 134;
  const endX = 18 + ((visual.end - min) / span) * 134;
  const arcPath = `M ${startX} 48 Q ${(startX + endX) / 2} ${isSubtraction ? 18 : 14} ${endX} 48`;

  return (
    <svg viewBox="0 0 180 88" className="h-28 w-full" role="img" aria-label={`${visual.start} ${visual.step} ${visual.end}`}>
      <rect width="180" height="88" rx="10" fill="#fffaf4" />
      <line x1="18" y1="48" x2="162" y2="48" stroke="#1b1b1f" strokeWidth="2" />
      <path d={arcPath} fill="none" stroke={isSubtraction ? "#7c63d8" : "#fc6513"} strokeWidth="3" />
      <circle cx={startX} cy="48" r="4" fill="#1b1b1f" />
      <circle cx={endX} cy="48" r="4" fill="#1b1b1f" />
      <text x={startX} y="72" textAnchor="middle" fontSize="10" fill="#1b1b1f">{visual.start}</text>
      <text x={endX} y="72" textAnchor="middle" fontSize="10" fill="#1b1b1f">{visual.end}</text>
      <text x={(startX + endX) / 2} y="24" textAnchor="middle" fontSize="10" fill="#5f5b57">
        {visual.step > 0 ? `+${visual.step}` : visual.step}
      </text>
    </svg>
  );
}

function buildGeneratedVisual(text: string, task: Task): GeneratedVisual {
  const answer = parseAnswer(text);
  const expression = text.match(/(\d+)\s*([+\-−x×*])\s*(\d+)/);

  if (expression) {
    const first = Number(expression[1]);
    const operator = expression[2];
    const second = Number(expression[3]);

    if ((operator === "x" || operator === "×" || operator === "*") && first <= 12 && second <= 12) {
      return { kind: "array", rows: first, columns: second };
    }

    if (operator === "+" || operator === "-" || operator === "−") {
      const step = operator === "+" ? second : -second;
      const computed = first + step;
      if (answer !== null && answer !== computed) return null;
      return { kind: "number-line", start: first, step, end: computed };
    }
  }

  if (task.chapter === "counting" && answer !== null && answer > 0 && answer <= 40) {
    return { kind: "dots", count: answer };
  }

  return null;
}

function parseAnswer(text: string) {
  const answerMatch = text.match(/(?:answer|vastus)\s*:\s*(-?\d+)/i);
  if (!answerMatch) return null;
  return Number(answerMatch[1]);
}

function MessageBubble({ message, compact = false }: { message: ChatMessage; compact?: boolean }) {
  const isUser = message.role === "user";
  const text = getMessageText(message.content);
  const image = getMessageImage(message.content);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`${compact ? "max-w-[20rem]" : "max-w-[48rem]"} rounded-2xl px-4 py-3 text-sm leading-6 ${
          isUser
            ? "bg-[#1b1b1f] text-white"
            : "border border-[#eadfd4] bg-white text-[#1b1b1f]"
        }`}
      >
        {image && <img src={image} alt="" className="mb-3 max-h-56 rounded-xl object-contain" />}
        <MarkdownText text={text} />
      </div>
    </div>
  );
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  function flushList() {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`list-${blocks.length}`} className="my-2 list-disc space-y-1 pl-5">
        {listItems.map((item) => (
          <li key={item}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (bullet || numbered) {
      listItems.push((bullet?.[1] ?? numbered?.[1] ?? "").trim());
      return;
    }

    flushList();
    blocks.push(
      <p key={`p-${index}`} className="my-2 first:mt-0 last:mb-0">
        {renderInlineMarkdown(trimmed)}
      </p>,
    );
  });

  flushList();
  return <div className="whitespace-normal">{blocks}</div>;
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
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
