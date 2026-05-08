"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Task {
  _id: string;
  slug: string;
  titleEt: string;
  title: string;
  problemEt: string;
  problem: string;
  chapter: "counting" | "addition" | "subtraction";
  chapterOrder: number;
  operation: string;
  gradeMin: number;
  gradeMax: number;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  answer?: string;
  imageUrl?: string;
  pageRef?: number;
}

const CHAPTERS = [
  { value: "counting", labelEt: "Loendamine", labelEn: "Counting", icon: "👁", pages: "lk 4–19" },
  { value: "addition", labelEt: "Liitmine", labelEn: "Addition", icon: "+", pages: "lk 21–29" },
  { value: "subtraction", labelEt: "Lahutamine", labelEn: "Subtraction", icon: "−", pages: "lk 32–40" },
] as const;

const DIFFICULTY_COLORS = {
  easy: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  hard: "bg-rose-100 text-rose-800",
};

const DIFFICULTY_LABELS_ET: Record<string, string> = {
  easy: "Lihtne",
  medium: "Keskmine",
  hard: "Raske",
};

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [chapter, setChapter] = useState<"counting" | "addition" | "subtraction">("counting");
  const [lang, setLang] = useState<"et" | "en">("et");

  const isEt = lang === "et";

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/tasks?chapter=${chapter}`);
    const data = await res.json();
    setTasks(data.tasks ?? []);
    setLoading(false);
  }, [chapter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const activeChapter = CHAPTERS.find((c) => c.value === chapter)!;

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">
              {isEt ? "Arvutaju" : "Number Sense"}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {isEt ? "Mõtlemine nähtavaks! — Õpetaja abiline" : "Making Thinking Visible — Teacher Copilot"}
            </p>
          </div>
          <button
            onClick={() => setLang(isEt ? "en" : "et")}
            className="text-sm px-3 py-1.5 rounded-full border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            {isEt ? "EN" : "ET"}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Workbook intro */}
        <div className="mb-8">
          <p className="text-sm text-zinc-500">
            {isEt
              ? "Vali peatükk, et avada konkreetne tund. Iga tund sisaldab strateegiad, juhendamise nõuanded ja AI abilise."
              : "Select a chapter to open a specific lesson. Each lesson includes strategies, facilitation tips, and an AI coach."}
          </p>
        </div>

        {/* Chapter tabs */}
        <div className="flex gap-2 mb-8">
          {CHAPTERS.map((ch) => (
            <button
              key={ch.value}
              onClick={() => setChapter(ch.value)}
              className={`flex-1 py-3 px-4 rounded-2xl text-sm font-medium transition-all border ${
                chapter === ch.value
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50"
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg">{ch.icon}</span>
                <span>{isEt ? ch.labelEt : ch.labelEn}</span>
                <span className={`text-xs opacity-60 ${chapter === ch.value ? "text-zinc-300" : "text-zinc-400"}`}>
                  {ch.pages}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Chapter heading */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-zinc-900">
            {isEt ? activeChapter.labelEt : activeChapter.labelEn}
          </h2>
          {!loading && (
            <span className="text-sm text-zinc-400">
              {isEt ? `${tasks.length} tundi` : `${tasks.length} lessons`}
            </span>
          )}
        </div>

        {/* Task list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-white border border-zinc-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            {isEt ? "Ülesandeid ei leitud." : "No tasks found."}
          </div>
        ) : chapter === "counting" ? (
          /* Counting tasks: image grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {tasks.map((task) => (
              <Link
                key={task._id}
                href={`/tasks/${task.slug}?lang=${lang}`}
                className="group bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className="aspect-square bg-zinc-100 flex items-center justify-center relative overflow-hidden">
                  {task.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={task.imageUrl}
                      alt={isEt ? task.titleEt : task.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl select-none">👁</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-zinc-900 truncate">
                    {isEt ? task.titleEt : task.title}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {isEt ? `lk ${task.pageRef ?? "–"}` : `p. ${task.pageRef ?? "–"}`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          /* Addition/Subtraction tasks: list */
          <div className="space-y-3">
            {tasks.map((task, idx) => (
              <Link
                key={task._id}
                href={`/tasks/${task.slug}?lang=${lang}`}
                className="group flex items-center gap-5 bg-white border border-zinc-200 rounded-2xl p-5 hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 text-sm font-bold">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-2xl font-bold text-zinc-900">
                    {isEt ? task.problemEt : task.problem}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    {isEt ? `${task.gradeMin}–${task.gradeMax} klass` : `Grade ${task.gradeMin}–${task.gradeMax}`}
                    {task.pageRef ? ` · lk ${task.pageRef}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[task.difficulty]}`}>
                    {isEt ? DIFFICULTY_LABELS_ET[task.difficulty] : task.difficulty}
                  </span>
                  <span className="text-zinc-300 group-hover:text-blue-500 transition-colors text-lg">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
