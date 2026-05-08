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
  operation: string;
  gradeMin: number;
  gradeMax: number;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  answer?: string;
}

const OPERATIONS = [
  { value: "", label: "Kõik tehted", labelEn: "All" },
  { value: "addition", label: "Liitmine", labelEn: "Addition" },
  { value: "subtraction", label: "Lahutamine", labelEn: "Subtraction" },
  { value: "multiplication", label: "Korrutamine", labelEn: "Multiplication" },
  { value: "division", label: "Jagamine", labelEn: "Division" },
];

const DIFFICULTIES = [
  { value: "", label: "Kõik tasemed" },
  { value: "easy", label: "Lihtne" },
  { value: "medium", label: "Keskmine" },
  { value: "hard", label: "Raske" },
];

const DIFFICULTY_COLORS = {
  easy: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  hard: "bg-rose-100 text-rose-800",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Lihtne",
  medium: "Keskmine",
  hard: "Raske",
};

const OPERATION_ICONS: Record<string, string> = {
  addition: "+",
  subtraction: "−",
  multiplication: "×",
  division: "÷",
  mixed: "~",
};

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [lang, setLang] = useState<"et" | "en">("et");

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (operation) params.set("operation", operation);
    if (difficulty) params.set("difficulty", difficulty);
    if (query) params.set("q", query);

    const res = await fetch(`/api/tasks?${params}`);
    const data = await res.json();
    setTasks(data.tasks ?? []);
    setLoading(false);
  }, [operation, difficulty, query]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(searchInput);
  };

  const isEt = lang === "et";

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
        {/* Search */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={isEt ? "Otsi strateegiat, tehtet... (semantiline otsing)" : "Search by strategy, topic... (semantic search)"}
              className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
            >
              {isEt ? "Otsi" : "Search"}
            </button>
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(""); setSearchInput(""); }}
                className="px-4 py-2.5 text-zinc-500 text-sm rounded-xl border border-zinc-200 hover:bg-zinc-100 transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </form>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8">
          <div className="flex gap-1 flex-wrap">
            {OPERATIONS.map((op) => (
              <button
                key={op.value}
                onClick={() => setOperation(op.value)}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                  operation === op.value
                    ? "bg-zinc-900 text-white"
                    : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {isEt ? op.label : op.labelEn}
              </button>
            ))}
          </div>
          <div className="flex gap-1 flex-wrap">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                onClick={() => setDifficulty(d.value)}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                  difficulty === d.value
                    ? "bg-zinc-900 text-white"
                    : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-44 bg-white border border-zinc-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            {isEt ? "Ülesandeid ei leitud." : "No tasks found."}
          </div>
        ) : (
          <>
            <p className="text-sm text-zinc-500 mb-4">
              {isEt ? `${tasks.length} ülesannet` : `${tasks.length} tasks`}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks.map((task) => (
                <Link
                  key={task._id}
                  href={`/tasks/${task.slug}?lang=${lang}`}
                  className="group bg-white border border-zinc-200 rounded-2xl p-5 hover:border-blue-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-700 text-xl font-bold rounded-xl">
                      {OPERATION_ICONS[task.operation] ?? "?"}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[task.difficulty]}`}>
                      {DIFFICULTY_LABELS[task.difficulty]}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-zinc-900 mb-1">
                    {isEt ? task.titleEt : task.title}
                  </h2>
                  <p className="text-sm text-zinc-500 line-clamp-2 mb-3">
                    {isEt ? task.problemEt : task.problem}
                  </p>
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>{isEt ? `${task.gradeMin}–${task.gradeMax} klass` : `Grade ${task.gradeMin}–${task.gradeMax}`}</span>
                    <span className="group-hover:text-blue-600 transition-colors">
                      {isEt ? "Vaata →" : "View →"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
