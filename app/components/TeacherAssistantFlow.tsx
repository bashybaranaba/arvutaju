"use client";

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, FormEvent, ReactNode, Ref, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  promptHelper: string;
  attach: string;
  removeImage: string;
  imageReady: string;
  send: string;
  sendDisabled: string;
  emptyInput: string;
  searching: string;
  thinking: string;
  contextError: string;
  generateError: string;
  imageError: string;
  assistantTitle: string;
  emptyTitle: string;
  referencesTitle: string;
  noReferences: string;
  workbookReference: string;
  generateSimilar: string;
  generatedTitle: string;
  generationNote: string;
  ruleAiTitle: string;
  ruleAiBody: string;
  selectedReference: string;
  examples: string[];
  error: string;
};

const copyByLang: Record<Language, Copy> = {
  et: {
    promptPlaceholder: "Kirjelda teemat või õpilase lahendust...",
    promptHelper: "Kirjuta küsimus või lisa pilt. Saata saab siis, kui sisend ei ole tühi.",
    attach: "Lisa pilt",
    removeImage: "Eemalda pilt",
    imageReady: "Pilt on lisatud.",
    send: "Saada",
    sendDisabled: "Kirjuta kõigepealt küsimus.",
    emptyInput: "Kirjuta kõigepealt küsimus.",
    searching: "Otsin töövihikust sobivat konteksti...",
    thinking: "Koostan vastust...",
    contextError:
      "Töövihiku konteksti ei õnnestunud praegu leida. Võid siiski küsimuse saata.",
    generateError: "Sarnaste ülesannete loomine ei õnnestunud. Proovi hetke pärast uuesti.",
    imageError: "Pilti ei õnnestunud lugeda. Proovi teist faili.",
    assistantTitle: "Vestlus",
    emptyTitle: "Proovi alustuseks",
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
    selectedReference: "Valitud kontekst",
    examples: [
      "4. klass, lahutamine arvteljel. Kuidas seda arutada?",
      "Õpilane lahendas 56 - 8 nii: 56 - 6 - 2. Mis strateegia see on?",
      "Loo samas stiilis ülesanne koos võimalike strateegiatega.",
    ],
    error: "Midagi läks valesti. Palun proovi uuesti.",
  },
  en: {
    promptPlaceholder: "Ask about a task or student strategy...",
    promptHelper: "Write a question or attach an image. Send is available once there is something to review.",
    attach: "Attach image",
    removeImage: "Remove image",
    imageReady: "Image attached.",
    send: "Send",
    sendDisabled: "Write a question first.",
    emptyInput: "Write a question first.",
    searching: "Finding the closest workbook context...",
    thinking: "Writing a response...",
    contextError:
      "I could not find workbook context just now. You can still send the question.",
    generateError: "I could not create similar tasks just now. Please try again in a moment.",
    imageError: "I could not read that image. Please try another file.",
    assistantTitle: "Chat",
    emptyTitle: "Try asking",
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
  const [, setRetrieval] = useState<RetrievalState>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isWorkbookExpanded, setIsWorkbookExpanded] = useState(true);
  const [inputNotice, setInputNotice] = useState<string | null>(null);
  const [contextNotice, setContextNotice] = useState<string | null>(null);
  const [generateNotice, setGenerateNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const latestUserMessageRef = useRef<HTMLDivElement>(null);
  const selectedTaskSectionRef = useRef<HTMLDivElement>(null);
  const generatedSectionRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLElement>(null);
  const previousUserMessageCount = useRef(0);
  const didSendInitialPrompt = useRef(false);
  const shouldScrollToSelectedTask = useRef(false);
  const hasMeaningfulInput = input.trim().length > 0;
  const canSubmit = (hasMeaningfulInput || Boolean(imageDataUrl)) && !isThinking && !isSearching;

  const visibleMessages = useMemo(
    () => messages.filter((message) => getMessageText(message.content).trim()),
    [messages],
  );
  const userMessageCount = useMemo(
    () => visibleMessages.filter((message) => message.role === "user").length,
    [visibleMessages],
  );

  const scrollRightPaneToTarget = useCallback((target: HTMLElement | null) => {
    const container = rightPaneRef.current;
    if (!container || !target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const top = container.scrollTop + targetRect.top - containerRect.top - 16;

    container.scrollTo({
      top: Math.max(0, top),
      behavior: "smooth",
    });
  }, []);

  const scrollRightPaneToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = rightPaneRef.current;
        if (!container) return;
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth",
        });
      });
    });
  }, []);

  useEffect(() => {
    if (userMessageCount > previousUserMessageCount.current) {
      requestAnimationFrame(() => {
        latestUserMessageRef.current?.scrollIntoView({ block: "start" });
      });
    }

    previousUserMessageCount.current = userMessageCount;
  }, [userMessageCount]);

  useEffect(() => {
    if (generated.length === 0) return;

    requestAnimationFrame(() => {
      scrollRightPaneToTarget(generatedSectionRef.current);
    });
  }, [generated.length, scrollRightPaneToTarget]);

  useEffect(() => {
    if (!shouldScrollToSelectedTask.current || !selectedTask) return;

    shouldScrollToSelectedTask.current = false;
    requestAnimationFrame(() => {
      scrollRightPaneToTarget(selectedTaskSectionRef.current);
    });
  }, [scrollRightPaneToTarget, selectedTask]);

  const findContext = useCallback(async (query: string): Promise<Task[]> => {
    try {
      const response = await fetch(`/api/tasks?q=${encodeURIComponent(query)}&sort=workbook`);
      if (!response.ok) {
        setContextNotice(copy.contextError);
        return [];
      }
      const data = await response.json();
      setContextNotice(null);
      setRetrieval(data.retrieval ?? { mode: data.source ?? "unknown", count: data.tasks?.length ?? 0 });
      return (data.tasks ?? []).slice(0, MAX_RETRIEVED_TASKS);
    } catch {
      setContextNotice(copy.contextError);
      return [];
    }
  }, [copy.contextError]);

  const sendPrompt = useCallback(async (promptText: string, promptImageDataUrl: string | null) => {
    if (!promptText.trim() && !promptImageDataUrl) {
      setInputNotice(copy.emptyInput);
      return;
    }
    if (isThinking || isSearching) return;

    const trimmed = promptText.trim();
    setInputNotice(null);
    setContextNotice(null);
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
  }, [copy.emptyInput, copy.error, findContext, isEt, isSearching, isThinking, lang, messages, selectedTask, tasks]);

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
    if (!trimmed && !imageDataUrl) {
      setInputNotice(copy.emptyInput);
      return;
    }
    if (isThinking || isSearching) return;
    await sendPrompt(trimmed, imageDataUrl);
  }

  async function generateSimilarTasks() {
    if (!selectedTask || isGenerating) return;
    setIsGenerating(true);
    setGenerated([]);
    setGenerateNotice(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskSlug: selectedTask.slug, lang }),
      });
      if (!response.ok) throw new Error("Generate failed");
      const data = await response.json();
      setGenerated(data.problems ?? []);
    } catch {
      setGenerateNotice(copy.generateError);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleSelectTask(task: Task) {
    shouldScrollToSelectedTask.current = true;
    setSelectedTask(task);
    setIsWorkbookExpanded(true);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageDataUrl(reader.result);
        setInputNotice(null);
      }
    };
    reader.onerror = () => setInputNotice(copy.imageError);
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  return (
    <section
      id="alusta"
      className="mx-auto grid max-w-7xl gap-4 lg:h-full lg:max-w-none lg:grid-cols-[minmax(20rem,0.92fr)_minmax(0,1.88fr)] lg:overflow-hidden lg:p-4"
    >
      <aside className="lg:h-full lg:overflow-hidden">
        <div className="flex h-[calc(100svh-6rem)] min-h-[42rem] flex-col rounded-[1.75rem] border border-[#eadfd4] bg-white shadow-lg shadow-[#b09cf0]/10 lg:h-full lg:min-h-0">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#eadfd4] px-4">
            <h2 className="text-sm font-medium text-[#5f5b57]">{copy.assistantTitle}</h2>
            {(isSearching || isThinking) && (
              <span
                className="rounded-full bg-[#f7f3ee] px-2.5 py-1 text-xs font-medium text-[#6c665f]"
                role="status"
                aria-live="polite"
              >
                {isSearching
                  ? isEt ? "Otsin" : "Searching"
                  : isEt ? "Kirjutan" : "Writing"}
              </span>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <div className="flex min-h-full flex-col justify-end">
              {visibleMessages.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-[#8a8179]">{copy.emptyTitle}</p>
                  {copy.examples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => {
                        setInput(example);
                        setInputNotice(null);
                      }}
                      className="w-full rounded-xl border border-[#eadfd4] bg-[#fffaf4] px-3 py-2.5 text-left text-sm leading-5 text-[#5f5b57] transition-colors hover:border-[#fc6513] hover:bg-white hover:text-[#1b1b1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd7bd] focus-visible:ring-offset-2"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleMessages.map((message, index) => {
                    const isLatestUserMessage =
                      message.role === "user" &&
                      visibleMessages
                        .slice(index + 1)
                        .every((nextMessage) => nextMessage.role !== "user");

                    return (
                      <MessageBubble
                        key={index}
                        message={message}
                        compact
                        messageRef={isLatestUserMessage ? latestUserMessageRef : undefined}
                      />
                    );
                  })}
                </div>
              )}

              {isThinking && (
                <div className="mt-3 flex justify-start" aria-hidden="true">
                  <span className="inline-flex items-center gap-1.5 rounded-2xl border border-[#eadfd4] bg-[#fffaf4] px-3 py-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#8a8179]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#8a8179]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#8a8179]" />
                  </span>
                </div>
              )}

              {contextNotice && (
                <p
                  className="mt-3 rounded-xl border border-[#eadfd4] bg-[#fffaf4] px-3 py-2 text-sm leading-5 text-[#5f5b57]"
                  role="status"
                >
                  {contextNotice}
                </p>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="border-t border-[#eadfd4] px-4 py-3">
            <label htmlFor="teacher-prompt" className="sr-only">
              {copy.promptPlaceholder}
            </label>
            <div className="rounded-2xl border border-[#eadfd4] bg-[#fffaf4] p-2.5 transition-colors focus-within:border-[#fc6513] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#ffd7bd] focus-within:ring-offset-2">
              {imageDataUrl && (
                <div className="mb-3 inline-flex items-start">
                  <div className="relative">
                    <img
                      src={imageDataUrl}
                      alt=""
                      className="h-14 w-14 rounded-lg border border-[#eadfd4] bg-white object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setImageDataUrl(null)}
                      className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-semibold text-[#5f5b57] shadow-sm ring-1 ring-[#eadfd4] transition-colors hover:text-[#b83f05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd7bd]"
                      aria-label={copy.removeImage}
                    >
                      x
                    </button>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                aria-label={copy.attach}
                className="hidden"
              />
              <textarea
                id="teacher-prompt"
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  setInputNotice(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (canSubmit) {
                      void handleSubmit();
                    } else {
                      setInputNotice(copy.emptyInput);
                    }
                  }
                }}
                placeholder={copy.promptPlaceholder}
                aria-describedby="teacher-prompt-helper teacher-prompt-status"
                disabled={isThinking || isSearching}
                className="min-h-9 max-h-28 w-full resize-none bg-transparent px-1.5 py-1 text-sm leading-5 text-[#1b1b1f] outline-none placeholder:text-[#8a8179] disabled:cursor-wait disabled:text-[#8a8179]"
              />
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isThinking || isSearching}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-lg font-medium text-[#5f5b57] transition-colors hover:bg-[#fff0e7] hover:text-[#b83f05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd7bd] focus-visible:ring-offset-2 disabled:cursor-wait disabled:text-[#9a928a]"
                  aria-label={copy.attach}
                >
                  +
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#fc6513] text-white transition-colors hover:bg-[#df560d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd7bd] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#d8d2cc] disabled:text-[#6c665f] disabled:hover:bg-[#d8d2cc]"
                  aria-label={canSubmit ? copy.send : copy.sendDisabled}
                >
                  <SendIcon />
                </button>
              </div>
            </div>
            <p id="teacher-prompt-helper" className="sr-only">
              {copy.promptHelper}
            </p>
            {inputNotice && (
              <p
                id="teacher-prompt-status"
                className="mt-3 rounded-lg border border-[#ffd7bd] bg-[#fff6ef] px-3 py-2 text-xs leading-5 text-[#8f3508]"
                role="alert"
              >
                {inputNotice}
              </p>
            )}
          </form>
        </div>
      </aside>

      <main ref={rightPaneRef} className="space-y-4 scroll-smooth lg:h-full lg:overflow-y-auto">
        {selectedTask ? (
          <>
            <div ref={selectedTaskSectionRef}>
              <WorkbookMaterial
                task={selectedTask}
                isEt={isEt}
                generated={generated}
                isGenerating={isGenerating}
                generateNotice={generateNotice}
                copy={copy}
                generatedSectionRef={generatedSectionRef}
                isWorkbookExpanded={isWorkbookExpanded}
                onToggleWorkbook={() => setIsWorkbookExpanded((value) => !value)}
                onGenerate={generateSimilarTasks}
              />
            </div>

            {tasks.length > 1 && (
              <TaskContextStrip
                tasks={tasks}
                selectedTask={selectedTask}
                isEt={isEt}
                onSelect={handleSelectTask}
                onOpen={scrollRightPaneToBottom}
              />
            )}
          </>
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
  onOpen,
}: {
  tasks: Task[];
  selectedTask: Task | null;
  isEt: boolean;
  onSelect: (task: Task) => void;
  onOpen: () => void;
}) {
  const otherTasks = selectedTask
    ? tasks.filter((task) => task._id !== selectedTask._id)
    : tasks;

  if (otherTasks.length === 0) return null;

  return (
    <details
      className="group overflow-hidden rounded-[1.75rem] border border-[#eadfd4] bg-white shadow-lg shadow-[#b09cf0]/10"
      onToggle={(event) => {
        if (!event.currentTarget.open) return;
        onOpen();
      }}
    >
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd7bd] focus-visible:ring-offset-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="block text-sm font-semibold text-[#1b1b1f]">
            {isEt ? "Teised võimalikud vasted" : "Other possible matches"}
          </span>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#fff0e7] px-1.5 text-xs font-semibold text-[#b83f05]">
            {otherTasks.length}
          </span>
        </span>
        <ChevronDownIcon />
      </summary>

      <div className="grid gap-3 border-t border-[#eadfd4] bg-[#fffaf4] p-4 sm:grid-cols-2 xl:grid-cols-3">
        {otherTasks.map((task) => (
          <button
            key={task._id}
            type="button"
            onClick={() => onSelect(task)}
            className="grid min-h-[9rem] grid-rows-[auto_1fr_auto] rounded-xl border border-[#eadfd4] bg-white px-4 py-3 text-left transition-colors hover:border-[#fc6513] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd7bd] focus-visible:ring-offset-2"
          >
            <span className="line-clamp-1 block text-xs font-semibold text-[#1b1b1f]">
              {isEt ? task.titleEt : task.title}
            </span>
            <span className="mt-1 line-clamp-3 block text-[0.7rem] leading-4 text-[#6c665f]">
              {isEt ? task.problemEt : task.problem}
            </span>
            <span className="mt-2 block text-[0.68rem] font-medium text-[#b83f05]">
              {pageLabel(task, isEt)}
            </span>
          </button>
        ))}
      </div>
    </details>
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
    <div className="rounded-[1.75rem] border border-[#eadfd4] bg-white p-5 shadow-lg shadow-[#b09cf0]/10">
      <div className="grid gap-3 sm:grid-cols-3">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onExample(example)}
            className="min-h-28 rounded-xl border border-[#eadfd4] bg-[#fffaf4] p-4 text-left text-sm leading-6 text-[#5f5b57] transition-colors hover:border-[#fc6513] hover:bg-white hover:text-[#1b1b1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd7bd] focus-visible:ring-offset-2"
          >
            {example}
          </button>
        ))}
      </div>
      {isSearching && <p className="mt-4 text-sm font-medium text-[#b83f05]">{searchingLabel}</p>}
    </div>
  );
}

function WorkbookMaterial({
  task,
  isEt,
  generated,
  isGenerating,
  generateNotice,
  copy,
  generatedSectionRef,
  isWorkbookExpanded,
  onToggleWorkbook,
  onGenerate,
}: {
  task: Task;
  isEt: boolean;
  generated: string[];
  isGenerating: boolean;
  generateNotice: string | null;
  copy: Copy;
  generatedSectionRef: Ref<HTMLDivElement>;
  isWorkbookExpanded: boolean;
  onToggleWorkbook: () => void;
  onGenerate: () => void;
}) {
  const images = getSourceImages(task);
  const primaryImage = images.find((image) => image.kind === "task") ?? images[0];
  const strategyImages = images.filter((image) => image.url !== primaryImage?.url);
  const primaryStrategyImage = strategyImages[0];
  const misconceptions = isEt ? task.commonMisconceptionsEt : task.commonMisconceptions;
  const [openDialog, setOpenDialog] = useState<"strategies" | "watch" | null>(null);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[1.75rem] border border-[#eadfd4] bg-white shadow-lg shadow-[#b09cf0]/10">
        <div className="flex flex-col gap-3 border-b border-[#eadfd4] px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#8a8179]">
              {isEt ? "Valitud töövihiku ülesanne" : "Selected workbook task"}
            </p>
            <h1 className="mt-1 text-lg font-semibold leading-6 text-[#1b1b1f]">
              {isEt ? task.titleEt : task.title}
            </h1>
            <p className="mt-1 max-w-3xl line-clamp-2 text-sm leading-5 text-[#5f5b57]">
              {isEt ? task.problemEt : task.problem}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge>{pageLabel(task, isEt) || "Arvutaju"}</Badge>
              <Badge>{isEt ? `${task.gradeMin}-${task.gradeMax} klass` : `Grades ${task.gradeMin}-${task.gradeMax}`}</Badge>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={onToggleWorkbook}
              className="inline-flex h-9 items-center rounded-full border border-[#eadfd4] px-3 text-xs font-semibold text-[#5f5b57] transition-colors hover:border-[#fc6513] hover:text-[#1b1b1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd7bd] focus-visible:ring-offset-2"
            >
              {isWorkbookExpanded ? (isEt ? "Peida" : "Hide") : (isEt ? "Näita" : "Show")}
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
              className="inline-flex h-9 items-center rounded-full bg-[#fc6513] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#df560d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd7bd] focus-visible:ring-offset-2 disabled:cursor-wait disabled:bg-[#d8d2cc] disabled:text-[#6c665f]"
              aria-label={copy.generateSimilar}
            >
              {isGenerating ? copy.thinking : copy.generateSimilar}
            </button>
          </div>
        </div>

        {isWorkbookExpanded && (
          <div className="space-y-4 bg-[#fffaf4] p-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <WorkbookImageCard
                label={isEt ? "Töövihiku ülesande pilt" : "Workbook task image"}
                image={primaryImage}
                alt={primaryImage?.label ?? (isEt ? task.titleEt : task.title)}
                emptyText={isEt ? "Töövihiku pilti ei leitud." : "No workbook image found."}
              />

              <WorkbookImageCard
                label={isEt ? "Kontrollitud strateegiavisuaal" : "Verified strategy visual"}
                image={primaryStrategyImage}
                alt={primaryStrategyImage?.label ?? (isEt ? task.titleEt : task.title)}
                emptyText={isEt ? "Kontrollitud strateegiavisuaali ei leitud." : "No verified strategy visual found."}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
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
            {task.strategies.map((strategy) => (
              <StrategyVisualCard
                key={strategy.name}
                strategy={strategy}
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
            {misconceptions.slice(0, 6).map((misconception) => (
              <WatchForVisualCard
                key={misconception}
                text={misconception}
                isEt={isEt}
              />
            ))}
          </div>
        </WorkbookDialog>
      )}

      {generateNotice && (
        <div
          className="rounded-[1.25rem] border border-[#ffd7bd] bg-[#fff6ef] px-4 py-3 text-sm leading-6 text-[#8f3508]"
          role="alert"
        >
          {generateNotice}
        </div>
      )}

      {generated.length > 0 && (
        <div ref={generatedSectionRef} className="rounded-[1.75rem] border border-[#eadfd4] bg-white p-5 shadow-lg shadow-[#b09cf0]/10">
          <h2 className="text-sm font-semibold text-[#1b1b1f]">{copy.generatedTitle}</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[#6c665f]">
            {copy.generationNote}
          </p>
          <div className="mt-4">
            <WorkbookImageCard
              label={isEt ? "Uute ülesannete visuaalne juhis" : "Visual guide for new tasks"}
              image={primaryImage}
              alt={primaryImage?.label ?? (isEt ? task.titleEt : task.title)}
              emptyText={isEt ? "Visuaalset juhist ei leitud." : "No visual guide found."}
            />
          </div>
          <ol className="mt-4 grid gap-3 lg:grid-cols-3">
            {generated.map((item) => (
              <GeneratedTaskCard
                key={item}
                text={item}
              />
            ))}
          </ol>
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

function WorkbookImageCard({
  label,
  image,
  alt,
  emptyText,
}: {
  label: string;
  image?: { url: string; label?: string };
  alt: string;
  emptyText: string;
}) {
  return (
    <div className="grid h-[25rem] grid-rows-[1.25rem_minmax(0,1fr)] gap-2 rounded-xl border border-[#eadfd4] bg-white p-3">
      <p className="truncate px-1 text-sm font-medium leading-5 text-[#6c665f]">
        {label}
      </p>
      {image ? (
        <div className="flex min-h-0 items-center justify-center overflow-hidden rounded-lg bg-[#fffaf4]">
          <img
            src={image.url}
            alt={alt}
            className="max-h-full w-full object-contain"
          />
        </div>
      ) : (
        <div className="flex min-h-0 items-center justify-center rounded-lg border border-dashed border-[#d9cec3] px-4 text-center text-sm leading-6 text-[#8a8179]">
          {emptyText}
        </div>
      )}
    </div>
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
        className="inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-[#eadfd4] text-sm font-semibold text-[#5f5b57] transition-colors hover:border-[#fc6513] hover:text-[#1b1b1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd7bd] focus-visible:ring-offset-2"
        title={`${label}: ${content}`}
        aria-label={label}
      >
        ?
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-[#eadfd4] bg-white p-4 text-sm leading-6 text-[#5f5b57] shadow-lg shadow-[#b09cf0]/10">
        <p className="mb-2 text-xs font-semibold uppercase text-[#b83f05]">
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
      className="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border border-[#eadfd4] bg-white px-4 py-3 text-left transition-colors hover:border-[#fc6513] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd7bd] focus-visible:ring-offset-2"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-5 text-[#1b1b1f]">{title}</span>
        <span className="mt-1 block text-xs leading-4 text-[#8a8179]">{hint}</span>
      </span>
      <span className="shrink-0 text-xs font-semibold text-[#b83f05]">
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
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b1b1f]/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workbook-dialog-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-[1.5rem] border border-[#eadfd4] bg-white shadow-2xl shadow-[#1b1b1f]/20"
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
            className="inline-flex h-9 items-center rounded-full border border-[#eadfd4] px-3 text-xs font-semibold text-[#5f5b57] transition-colors hover:border-[#fc6513] hover:text-[#1b1b1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd7bd] focus-visible:ring-offset-2"
          >
            {closeLabel}
          </button>
        </div>
        <div className="max-h-[calc(100svh-13rem)] overflow-y-auto bg-[#fffaf4] p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

function StrategyVisualCard({
  strategy,
  isEt,
}: {
  strategy: Strategy;
  isEt: boolean;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-[#eadfd4] bg-white p-4">
      <p className="text-sm font-semibold leading-5 text-[#1b1b1f]">
        {isEt ? strategy.nameEt : strategy.name}
      </p>
      <p className="mt-2 text-sm leading-6 text-[#5f5b57]">
        {isEt ? strategy.descriptionEt : strategy.description}
      </p>
    </div>
  );
}

function WatchForVisualCard({
  text,
  isEt,
}: {
  text: string;
  isEt: boolean;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-[#eadfd4] bg-white p-4">
      <p className="text-xs font-semibold leading-5 text-[#b83f05]">
        {isEt ? "Jälgi" : "Watch"}
      </p>
      <p className="mt-2 text-sm leading-6 text-[#5f5b57]">{text}</p>
    </div>
  );
}

function GeneratedTaskCard({
  text,
}: {
  text: string;
}) {
  return (
    <li className="flex min-h-40 flex-col rounded-xl border border-[#eadfd4] bg-[#fffaf4] p-4 text-sm leading-6 text-[#5f5b57]">
      <MarkdownText text={text} />
    </li>
  );
}

function MessageBubble({
  message,
  compact = false,
  messageRef,
}: {
  message: ChatMessage;
  compact?: boolean;
  messageRef?: Ref<HTMLDivElement>;
}) {
  const isUser = message.role === "user";
  const text = getMessageText(message.content);
  const image = getMessageImage(message.content);
  const widthClass = compact
    ? isUser ? "max-w-[21rem]" : "max-w-full"
    : "max-w-[48rem]";

  return (
    <div ref={messageRef} className={`scroll-mt-4 flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`${widthClass} text-sm leading-6 ${
          isUser
            ? "rounded-2xl rounded-tr-md border border-[#d8ccff] bg-[#f7f3ff] px-4 py-3 text-[#2e245f]"
            : "rounded-2xl rounded-tl-md border border-[#eadfd4] bg-[#fffaf4] px-4 py-3 text-[#1b1b1f] shadow-sm shadow-[#eadfd4]/40"
        }`}
      >
        {image && <img src={image} alt="" className="mb-3 max-h-56 rounded-xl object-contain" />}
        <MarkdownText text={text} />
      </div>
    </div>
  );
}

function SendIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 15V5M10 5 6.5 8.5M10 5l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4 shrink-0 text-[#b83f05] transition-transform group-open:rotate-180"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5.5 7.5 10 12l4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
