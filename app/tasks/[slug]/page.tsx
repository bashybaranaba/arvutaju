"use client";

import { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface Strategy {
  name: string;
  nameEt: string;
  description: string;
  descriptionEt: string;
  example?: string;
}

interface Task {
  _id: string;
  slug: string;
  title: string;
  titleEt: string;
  problem: string;
  problemEt: string;
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
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

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

export default function TaskPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const lang = (searchParams.get("lang") as "et" | "en") ?? "et";

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"strategies" | "facilitation" | "chat" | "generate">("strategies");
  const [openStrategy, setOpenStrategy] = useState<number | null>(0);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Generator state
  const [generatedProblems, setGeneratedProblems] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  const isEt = lang === "et";

  useEffect(() => {
    fetch(`/api/tasks/${slug}`)
      .then((r) => r.json())
      .then((d) => { setTask(d.task); setLoading(false); });
  }, [slug]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMsg: ChatMessage = { role: "user", content: chatInput };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    const assistantMsg: ChatMessage = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMsg]);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: newMessages, taskSlug: slug, lang }),
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
      setMessages([...newMessages, { role: "assistant", content: full }]);
    }

    setChatLoading(false);
  };

  const generateProblems = async () => {
    setGenerating(true);
    setGeneratedProblems([]);
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskSlug: slug, lang }),
    });
    const data = await res.json();
    setGeneratedProblems(data.problems ?? []);
    setGenerating(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-600">{isEt ? "Ülesannet ei leitud." : "Task not found."}</p>
        <Link href="/" className="text-blue-600 hover:underline text-sm">← {isEt ? "Tagasi" : "Back"}</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href={`/?lang=${lang}`} className="text-zinc-500 hover:text-zinc-800 text-sm transition-colors">
            ←
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-zinc-900 truncate">
              {isEt ? task.titleEt : task.title}
            </h1>
          </div>
          <Link
            href={`/?lang=${lang === "et" ? "en" : "et"}`}
            className="text-sm px-3 py-1 rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-100 transition-colors shrink-0"
          >
            {isEt ? "EN" : "ET"}
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Problem Card */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex gap-2 flex-wrap">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[task.difficulty]}`}>
                {DIFFICULTY_LABELS[task.difficulty]}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                {isEt ? `${task.gradeMin}–${task.gradeMax} klass` : `Grade ${task.gradeMin}–${task.gradeMax}`}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                {task.operation}
              </span>
            </div>
            {task.pageRef && (
              <span className="text-xs text-zinc-400 shrink-0">lk {task.pageRef}</span>
            )}
          </div>

          <p className="text-3xl font-bold text-zinc-900 mb-2">
            {isEt ? task.problemEt : task.problem}
          </p>
          {task.answer && (
            <details className="mt-3">
              <summary className="text-sm text-zinc-500 cursor-pointer hover:text-zinc-700">
                {isEt ? "Näita vastust" : "Show answer"}
              </summary>
              <p className="mt-2 text-lg font-semibold text-emerald-700">{task.answer}</p>
            </details>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-zinc-100 p-1 rounded-xl">
          {(["strategies", "facilitation", "chat", "generate"] as const).map((tab) => {
            const labels: Record<string, { et: string; en: string }> = {
              strategies: { et: "Strateegiad", en: "Strategies" },
              facilitation: { et: "Juhendamine", en: "Facilitation" },
              chat: { et: "AI abiline", en: "AI Coach" },
              generate: { et: "Genereeri", en: "Generate" },
            };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {isEt ? labels[tab].et : labels[tab].en}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === "strategies" && (
          <div className="space-y-3">
            {task.strategies.map((strategy, i) => (
              <div
                key={i}
                className="bg-white border border-zinc-200 rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenStrategy(openStrategy === i ? null : i)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left"
                >
                  <div>
                    <p className="font-semibold text-zinc-900">
                      {isEt ? strategy.nameEt : strategy.name}
                    </p>
                    {!isEt && <p className="text-xs text-zinc-400 mt-0.5">{strategy.nameEt}</p>}
                  </div>
                  <span className="text-zinc-400 text-sm">{openStrategy === i ? "▲" : "▼"}</span>
                </button>
                {openStrategy === i && (
                  <div className="px-5 pb-5 border-t border-zinc-100">
                    <p className="text-zinc-700 text-sm mt-3 leading-relaxed">
                      {isEt ? strategy.descriptionEt : strategy.description}
                    </p>
                    {strategy.example && (
                      <div className="mt-3 px-4 py-3 bg-zinc-50 rounded-xl font-mono text-sm text-zinc-800">
                        {strategy.example}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Misconceptions */}
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5">
              <h3 className="font-semibold text-rose-900 mb-3">
                {isEt ? "Levinud väärarusaamad" : "Common Misconceptions"}
              </h3>
              <ul className="space-y-2">
                {(isEt ? task.commonMisconceptionsEt : task.commonMisconceptions).map((m, i) => (
                  <li key={i} className="text-sm text-rose-800 flex gap-2">
                    <span>⚠</span>
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {activeTab === "facilitation" && (
          <div className="bg-white border border-zinc-200 rounded-2xl p-6">
            <h3 className="font-semibold text-zinc-900 mb-4">
              {isEt ? "Juhendamissoovitused" : "Facilitation Guide"}
            </h3>
            <p className="text-zinc-700 leading-relaxed">
              {isEt ? task.facilitationEt : task.facilitation}
            </p>
            {task.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-6">
                {task.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "chat" && (
          <div className="bg-white border border-zinc-200 rounded-2xl flex flex-col" style={{ height: "480px" }}>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12 text-zinc-400">
                  <p className="text-3xl mb-3">💬</p>
                  <p className="text-sm">
                    {isEt
                      ? "Küsi AI abiliselt abi strateegiate, väärarusaamade või juhendamise kohta."
                      : "Ask the AI coach about strategies, misconceptions, or facilitation."}
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    {(isEt
                      ? ["Mida tähendab kompensatsioon?", "Kuidas reageerida, kui õpilane arvutab valesti?", "Genereeri sarnane küsimus"]
                      : ["What is the compensation strategy?", "How do I respond to a student who counts on?", "Why use a number line here?"]
                    ).map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => { setChatInput(prompt); }}
                        className="text-sm text-blue-600 hover:bg-blue-50 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-100 text-zinc-800"
                    }`}
                  >
                    {msg.content || (chatLoading && i === messages.length - 1 ? "▋" : "")}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t border-zinc-100 p-4 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder={isEt ? "Küsi küsimus..." : "Ask a question..."}
                className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={chatLoading}
              />
              <button
                onClick={sendMessage}
                disabled={chatLoading || !chatInput.trim()}
                className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                →
              </button>
            </div>
          </div>
        )}

        {activeTab === "generate" && (
          <div className="bg-white border border-zinc-200 rounded-2xl p-6">
            <h3 className="font-semibold text-zinc-900 mb-2">
              {isEt ? "Sarnaste ülesannete genereerimine" : "Generate Similar Problems"}
            </h3>
            <p className="text-sm text-zinc-500 mb-5">
              {isEt
                ? `Genereeri 3 sarnast ülesannet samal tasemel (${task.difficulty}), mis sobivad ${task.gradeMin}–${task.gradeMax}. klassile.`
                : `Generate 3 similar problems at the same difficulty (${task.difficulty}) for grades ${task.gradeMin}–${task.gradeMax}.`}
            </p>
            <button
              onClick={generateProblems}
              disabled={generating}
              className="px-5 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-700 disabled:opacity-50 transition-colors mb-6"
            >
              {generating
                ? (isEt ? "Genereerin..." : "Generating...")
                : (isEt ? "Genereeri ülesanded" : "Generate Problems")}
            </button>
            {generatedProblems.length > 0 && (
              <div className="space-y-3">
                {generatedProblems.map((p, i) => (
                  <div key={i} className="px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl font-mono text-sm text-zinc-800">
                    {p}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
