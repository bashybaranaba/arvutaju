"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface Strategy {
  name: string;
  nameEt: string;
  description: string;
  descriptionEt: string;
  example?: string;
}

interface WorkbookAsset {
  kind: "page" | "task" | "strategy" | "illustration";
  url: string;
  page: number;
  order?: number;
  label?: string;
  sourcePdfName?: string;
  pdfPage?: number;
}

interface Task {
  _id: string;
  slug: string;
  title: string;
  titleEt: string;
  problem: string;
  problemEt: string;
  chapter: "counting" | "addition" | "subtraction" | "multiplication" | "division";
  chapterOrder: number;
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
  workbookTitle?: string;
  sourcePageNumber?: number;
  sourcePdfPageNumber?: number;
  pageImageUrl?: string;
  strategyImageUrls?: string[];
  workbookAssets?: WorkbookAsset[];
  imageUrl?: string;
}

const CHAPTER_LABELS: Record<string, { et: string; en: string }> = {
  counting: { et: "Loendamine", en: "Counting" },
  addition: { et: "Liitmine", en: "Addition" },
  subtraction: { et: "Lahutamine", en: "Subtraction" },
  multiplication: { et: "Korrutamine", en: "Multiplication" },
  division: { et: "Jagamine", en: "Division" },
};

const DIFFICULTY_LABELS: Record<string, { et: string; en: string; className: string }> = {
  easy: { et: "Lihtne", en: "Easy", className: "bg-emerald-100 text-emerald-800" },
  medium: { et: "Keskmine", en: "Medium", className: "bg-amber-100 text-amber-800" },
  hard: { et: "Raske", en: "Hard", className: "bg-rose-100 text-rose-800" },
};

function taskPage(task: Task): number | undefined {
  return task.sourcePageNumber ?? task.pageRef;
}

function sortPageUrls(urls: string[] | undefined): string[] {
  return [...(urls ?? [])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function orderedWorkbookAssets(task: Task | null): WorkbookAsset[] {
  return [...(task?.workbookAssets ?? [])].sort((a, b) => {
    const orderDiff = (a.order ?? 999) - (b.order ?? 999);
    if (orderDiff !== 0) return orderDiff;
    return a.url.localeCompare(b.url, undefined, { numeric: true });
  });
}

function taskImageUrl(task: Task): string | undefined {
  return orderedWorkbookAssets(task).find((asset) => asset.kind === "task")?.url
    ?? task.imageUrl
    ?? task.pageImageUrl;
}

function strategyImageUrls(task: Task | null): string[] {
  const assetUrls = orderedWorkbookAssets(task)
    .filter((asset) => asset.kind === "strategy")
    .map((asset) => asset.url);

  return assetUrls.length > 0 ? assetUrls : sortPageUrls(task?.strategyImageUrls);
}

export default function WorkbookPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lang, setLang] = useState<"et" | "en">("et");
  const [showAnswer, setShowAnswer] = useState(false);

  const isEt = lang === "et";
  const selectedTask = tasks[selectedIndex] ?? null;
  const previousTask = selectedIndex > 0 ? tasks[selectedIndex - 1] : null;
  const nextTask = selectedIndex < tasks.length - 1 ? tasks[selectedIndex + 1] : null;

  useEffect(() => {
    let ignore = false;

    async function loadWorkbook() {
      const res = await fetch("/api/tasks?sort=workbook");
      const data = await res.json();
      if (!ignore) {
        setTasks(data.tasks ?? []);
        setSelectedIndex(0);
        setLoading(false);
      }
    }

    loadWorkbook();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        setSelectedIndex((index) => Math.max(0, index - 1));
        setShowAnswer(false);
      }
      if (event.key === "ArrowRight") {
        setSelectedIndex((index) => Math.min(tasks.length - 1, index + 1));
        setShowAnswer(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tasks.length]);

  const chapters = useMemo(() => {
    const seen = new Map<string, { label: string; firstIndex: number; count: number }>();
    tasks.forEach((task, index) => {
      const existing = seen.get(task.chapter);
      if (existing) {
        existing.count += 1;
      } else {
        seen.set(task.chapter, {
          label: isEt ? CHAPTER_LABELS[task.chapter]?.et ?? task.chapter : CHAPTER_LABELS[task.chapter]?.en ?? task.chapter,
          firstIndex: index,
          count: 1,
        });
      }
    });
    return Array.from(seen.entries());
  }, [isEt, tasks]);

  function selectTask(index: number) {
    setSelectedIndex(index);
    setShowAnswer(false);
  }

  function move(delta: number) {
    setSelectedIndex((index) => Math.min(tasks.length - 1, Math.max(0, index + delta)));
    setShowAnswer(false);
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-zinc-400 hover:text-zinc-700 transition-colors text-lg">
            ←
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold truncate">
              {isEt ? "Töövihiku vaade" : "Workbook View"}
            </h1>
            <p className="text-xs text-zinc-500 truncate">
              {isEt
                ? "Liigu ülesanne ülesande haaval, koos pildi ja õpetaja tugimaterjaliga."
                : "Move task by task with workbook images and teacher support."}
            </p>
          </div>
          <button
            onClick={() => setLang(isEt ? "en" : "et")}
            className="text-sm px-3 py-1 rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-100 transition-colors shrink-0"
          >
            {isEt ? "EN" : "ET"}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="h-[70vh] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !selectedTask ? (
          <div className="text-center py-24 text-zinc-500">
            {isEt ? "Töövihiku ülesandeid ei leitud." : "No workbook tasks found."}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)_22rem] gap-6 items-start">
            <aside className="lg:sticky lg:top-20 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {isEt ? "Sisukord" : "Contents"}
                </p>
                <p className="text-xs text-zinc-400">
                  {selectedIndex + 1}/{tasks.length}
                </p>
              </div>

              <div className="space-y-3">
                {chapters.map(([chapter, meta]) => (
                  <button
                    key={chapter}
                    onClick={() => selectTask(meta.firstIndex)}
                    className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                      selectedTask.chapter === chapter
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{meta.label}</span>
                    <span className={selectedTask.chapter === chapter ? "text-xs text-zinc-300" : "text-xs text-zinc-400"}>
                      {meta.count} {isEt ? "ülesannet" : "tasks"}
                    </span>
                  </button>
                ))}
              </div>

              <div className="max-h-[48vh] overflow-y-auto pr-1 space-y-1">
                {tasks.map((task, index) => (
                  <button
                    key={task._id}
                    onClick={() => selectTask(index)}
                    className={`w-full grid grid-cols-[2rem_minmax(0,1fr)_3rem] items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
                      index === selectedIndex
                        ? "bg-blue-50 text-blue-900"
                        : "text-zinc-600 hover:bg-white"
                    }`}
                  >
                    <span className="h-7 w-7 rounded-md bg-white border border-zinc-200 flex items-center justify-center text-xs font-semibold">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate">
                        {isEt ? task.titleEt : task.title}
                      </span>
                      <span className="block text-xs text-zinc-400 truncate">
                        {isEt ? task.problemEt : task.problem}
                      </span>
                    </span>
                    <span className="text-xs text-zinc-400 text-right">
                      lk {taskPage(task) ?? "-"}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <section className="min-w-0 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => move(-1)}
                  disabled={!previousTask}
                  className="h-10 px-4 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-white"
                >
                  ← {isEt ? "Eelmine" : "Previous"}
                </button>
                <div className="text-center min-w-0">
                  <p className="text-xs text-zinc-400">
                    {selectedTask.workbookPart ? `${isEt ? "osa" : "part"} ${selectedTask.workbookPart} · ` : ""}
                    lk {taskPage(selectedTask) ?? "-"}
                  </p>
                  <h2 className="font-bold truncate">
                    {isEt ? selectedTask.titleEt : selectedTask.title}
                  </h2>
                </div>
                <button
                  onClick={() => move(1)}
                  disabled={!nextTask}
                  className="h-10 px-4 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-white"
                >
                  {isEt ? "Järgmine" : "Next"} →
                </button>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
                <div className="bg-zinc-100 flex items-center justify-center min-h-[22rem]">
                  {taskImageUrl(selectedTask) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={taskImageUrl(selectedTask)}
                      alt={isEt ? selectedTask.problemEt : selectedTask.problem}
                      className="w-full max-h-[72vh] object-contain"
                    />
                  ) : (
                    <p className="text-sm text-zinc-400">
                      {isEt ? "Töövihiku pilt puudub" : "Workbook image missing"}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <aside className="lg:sticky lg:top-20 space-y-4">
              <div className="bg-white border border-zinc-200 rounded-lg p-4">
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                    {isEt
                      ? CHAPTER_LABELS[selectedTask.chapter]?.et ?? selectedTask.chapter
                      : CHAPTER_LABELS[selectedTask.chapter]?.en ?? selectedTask.chapter}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${DIFFICULTY_LABELS[selectedTask.difficulty].className}`}>
                    {isEt
                      ? DIFFICULTY_LABELS[selectedTask.difficulty].et
                      : DIFFICULTY_LABELS[selectedTask.difficulty].en}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                    {isEt
                      ? `${selectedTask.gradeMin}-${selectedTask.gradeMax} klass`
                      : `Grade ${selectedTask.gradeMin}-${selectedTask.gradeMax}`}
                  </span>
                </div>

                <p className="text-xl font-bold leading-tight">
                  {isEt ? selectedTask.problemEt : selectedTask.problem}
                </p>

                {selectedTask.answer && (
                  <button
                    onClick={() => setShowAnswer((value) => !value)}
                    className="mt-4 text-sm px-3 py-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  >
                    {showAnswer
                      ? isEt ? "Peida vastus" : "Hide answer"
                      : isEt ? "Näita vastust" : "Show answer"}
                  </button>
                )}
                {showAnswer && selectedTask.answer && (
                  <p className="mt-3 text-lg font-semibold text-emerald-700">
                    {selectedTask.answer}
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                  {isEt ? "Õpetaja juhendamine" : "Facilitation"}
                </h3>
                <p className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm leading-relaxed text-blue-950">
                  {isEt ? selectedTask.facilitationEt : selectedTask.facilitation}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                  {isEt ? "Töövihiku strateegialeht" : "Workbook Strategy Page"}
                </h3>
                {strategyImageUrls(selectedTask).length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {strategyImageUrls(selectedTask).map((url, index) => (
                      <div
                        key={`${url}-${index}`}
                        className="bg-white border border-zinc-200 rounded-lg overflow-hidden"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={isEt ? "Ülesande lahendusstrateegiad" : "Task solution strategies"}
                          className="w-full object-contain bg-zinc-50"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="bg-white border border-zinc-200 rounded-lg p-3 mb-4 text-sm text-zinc-500">
                    {isEt ? "Strateegialeht puudub." : "Strategy page missing."}
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                  {isEt ? "Andmebaasi strateegiad" : "Database Strategies"}
                </h3>
                <div className="space-y-2">
                  {selectedTask.strategies.map((strategy) => (
                    <div key={`${selectedTask.slug}-${strategy.name}`} className="bg-white border border-zinc-200 rounded-lg p-3">
                      <p className="text-sm font-semibold">
                        {isEt ? strategy.nameEt : strategy.name}
                      </p>
                      <p className="text-sm text-zinc-600 leading-relaxed mt-1">
                        {isEt ? strategy.descriptionEt : strategy.description}
                      </p>
                      {strategy.example && (
                        <p className="mt-2 rounded-md bg-zinc-50 px-2 py-1.5 text-xs font-mono text-zinc-700">
                          {strategy.example}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Link
                href={`/tasks/${selectedTask.slug}?lang=${lang}`}
                className="block text-center rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors"
              >
                {isEt ? "Ava AI abilisega" : "Open with AI Coach"}
              </Link>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
