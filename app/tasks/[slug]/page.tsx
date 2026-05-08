"use client";

import { useState, useEffect, useRef, use, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const CLOUDINARY_CLOUD = "arttribute";
const CLOUDINARY_PRESET = "studio-upload";

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
  chapter: "counting" | "addition" | "subtraction";
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
  sourcePdfName?: string;
  sourcePageNumber?: number;
  sourcePdfPageNumber?: number;
  pageImageUrl?: string;
  strategyImageUrls?: string[];
  workbookAssets?: WorkbookAsset[];
  imageUrl?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string | ContentPart[];
}

interface ContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

const DIFFICULTY_COLORS = {
  easy: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  hard: "bg-rose-100 text-rose-800",
};

const DIFFICULTY_LABELS: Record<string, { et: string; en: string }> = {
  easy: { et: "Lihtne", en: "Easy" },
  medium: { et: "Keskmine", en: "Medium" },
  hard: { et: "Raske", en: "Hard" },
};

async function uploadToCloudinary(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_PRESET);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) throw new Error("Cloudinary upload failed");
  const data = await res.json();
  return data.secure_url as string;
}

function getMessageText(content: ChatMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("");
}

function getMessageImage(content: ChatMessage["content"]): string | null {
  if (typeof content === "string") return null;
  const img = content.find((p) => p.type === "image_url");
  return img?.image_url?.url ?? null;
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

function taskImageUrl(task: Task | null): string | undefined {
  if (!task) return undefined;
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

function TaskPageInner({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const langParam = (searchParams.get("lang") as "et" | "en") ?? "et";
  const [lang, setLang] = useState<"et" | "en">(langParam);

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [openStrategy, setOpenStrategy] = useState<number | null>(0);

  // Task image upload state
  const [imageUploading, setImageUploading] = useState(false);
  const taskImageInputRef = useRef<HTMLInputElement>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatImageUrl, setChatImageUrl] = useState<string | null>(null);
  const [chatImageUploading, setChatImageUploading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  const isEt = lang === "et";

  useEffect(() => {
    fetch(`/api/tasks/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        setTask(d.task);
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Upload workbook image for this counting task
  const handleTaskImageUpload = async (file: File) => {
    setImageUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      // Save to MongoDB
      await fetch(`/api/tasks/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url }),
      });
      setTask((t) => t ? { ...t, imageUrl: url } : t);
    } catch (e) {
      console.error("Image upload failed:", e);
    } finally {
      setImageUploading(false);
    }
  };

  // Upload chat image to Cloudinary, then store URL (not base64)
  const handleChatImageFile = async (file: File) => {
    setChatImageUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setChatImageUrl(url);
    } catch (e) {
      console.error("Chat image upload failed:", e);
    } finally {
      setChatImageUploading(false);
    }
  };

  const sendMessage = async () => {
    if ((!chatInput.trim() && !chatImageUrl) || chatLoading) return;

    let userContent: ChatMessage["content"];
    if (chatImageUrl) {
      const parts: ContentPart[] = [];
      parts.push({
        type: "text",
        text: chatInput.trim() || (isEt ? "Vaata seda pilti." : "Look at this image."),
      });
      parts.push({ type: "image_url", image_url: { url: chatImageUrl } });
      userContent = parts;
    } else {
      userContent = chatInput.trim();
    }

    const userMsg: ChatMessage = { role: "user", content: userContent };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setChatInput("");
    setChatImageUrl(null);
    setChatLoading(true);

    setMessages([...newMessages, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, taskSlug: slug, lang }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages([...newMessages, { role: "assistant", content: full }]);
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: isEt
            ? "Vabandust, tekkis viga. Palun proovi uuesti."
            : "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
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
        <Link href="/" className="text-blue-600 hover:underline text-sm">
          ← {isEt ? "Tagasi" : "Back"}
        </Link>
      </div>
    );
  }

  const isCounting = task.chapter === "counting";
  const chapterLabel = {
    counting: { et: "Loendamine", en: "Counting" },
    addition: { et: "Liitmine", en: "Addition" },
    subtraction: { et: "Lahutamine", en: "Subtraction" },
  }[task.chapter];

  const suggestedPrompts = isEt
    ? isCounting
      ? [
          "Kuidas reageerida, kui õpilane loendab ükshaaval?",
          "Mis on kontseptuaalne subitiseerimine?",
          "Kuidas struktureerida flashkaardi tundi?",
        ]
      : [
          "Milliseid strateegiaid õpilased kasutavad?",
          "Kuidas reageerida valele vastusele?",
          "Mis on kompensatsiooni strateegia?",
        ]
    : isCounting
      ? [
          "How do I respond to one-by-one counting?",
          "What is conceptual subitizing?",
          "How do I structure a flash card lesson?",
        ]
      : [
          "What strategies will students use?",
          "How do I respond to wrong answers?",
          "What is the compensation strategy?",
        ];
  const primaryWorkbookImage = taskImageUrl(task);
  const workbookStrategyImages = strategyImageUrls(task);

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href={`/?lang=${lang}`}
            className="text-zinc-400 hover:text-zinc-700 transition-colors text-lg"
          >
            ←
          </Link>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-xs text-zinc-400 shrink-0">
              {isEt ? chapterLabel.et : chapterLabel.en}
            </span>
            <span className="text-zinc-200">·</span>
            <h1 className="text-base font-bold text-zinc-900 truncate">
              {isEt ? task.titleEt : task.title}
            </h1>
          </div>
          <button
            onClick={() => setLang(isEt ? "en" : "et")}
            className="text-sm px-3 py-1 rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-100 transition-colors shrink-0"
          >
            {isEt ? "EN" : "ET"}
          </button>
        </div>
      </header>

      {/* Two-column body */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 flex gap-6 items-start">
        {/* LEFT: Workbook content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Problem card */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex gap-2 flex-wrap">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[task.difficulty]}`}
                >
                  {isEt
                    ? DIFFICULTY_LABELS[task.difficulty].et
                    : DIFFICULTY_LABELS[task.difficulty].en}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                  {isEt
                    ? `${task.gradeMin}–${task.gradeMax} klass`
                    : `Grade ${task.gradeMin}–${task.gradeMax}`}
                </span>
              </div>
              {task.pageRef && (
                <span className="text-xs text-zinc-400 shrink-0">
                  {task.workbookPart ? `${isEt ? "osa" : "part"} ${task.workbookPart} · ` : ""}
                  lk {task.sourcePageNumber ?? task.pageRef}
                </span>
              )}
            </div>

            {isCounting ? (
              <div>
                <p className="text-lg font-semibold text-zinc-700 mb-4">
                  {isEt ? task.problemEt : task.problem}
                </p>

                {/* Task image area */}
                <div className="rounded-2xl overflow-hidden bg-zinc-100 relative" style={{ minHeight: 240 }}>
                  {primaryWorkbookImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={primaryWorkbookImage}
                      alt={isEt ? task.problemEt : task.problem}
                      className="w-full object-contain"
                      style={{ minHeight: 240 }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-400">
                      <span className="text-5xl">👁</span>
                      <p className="text-sm">
                        {isEt ? "Töölehe pilt puudub" : "Workbook image not yet added"}
                      </p>
                      <input
                        ref={taskImageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleTaskImageUpload(f);
                          e.target.value = "";
                        }}
                      />
                      <button
                        onClick={() => taskImageInputRef.current?.click()}
                        disabled={imageUploading}
                        className="px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
                      >
                        {imageUploading
                          ? (isEt ? "Laen üles..." : "Uploading...")
                          : (isEt ? "Lae üles töölehe pilt" : "Upload workbook image")}
                      </button>
                    </div>
                  )}
                  {/* Replace image button */}
                  {primaryWorkbookImage && (
                    <div className="absolute bottom-3 right-3">
                      <input
                        ref={taskImageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleTaskImageUpload(f);
                          e.target.value = "";
                        }}
                      />
                      <button
                        onClick={() => taskImageInputRef.current?.click()}
                        disabled={imageUploading}
                        className="px-3 py-1.5 bg-white/90 backdrop-blur-sm border border-zinc-200 rounded-lg text-xs text-zinc-500 hover:bg-white disabled:opacity-50 transition-colors"
                      >
                        {imageUploading ? "↑" : (isEt ? "Vaheta pilt" : "Replace")}
                      </button>
                    </div>
                  )}
                </div>

                {task.answer && (
                  <details className="mt-4">
                    <summary className="text-sm text-zinc-500 cursor-pointer hover:text-zinc-700">
                      {isEt ? "Näita vastust" : "Show answer"}
                    </summary>
                    <p className="mt-2 text-lg font-semibold text-emerald-700">{task.answer}</p>
                  </details>
                )}
              </div>
            ) : (
              <div>
                <p className="text-4xl font-bold text-zinc-900 mb-3">
                  {isEt ? task.problemEt : task.problem}
                </p>
                {task.answer && (
                  <details className="mt-2">
                    <summary className="text-sm text-zinc-500 cursor-pointer hover:text-zinc-700">
                      {isEt ? "Näita vastust" : "Show answer"}
                    </summary>
                    <p className="mt-2 text-xl font-semibold text-emerald-700">{task.answer}</p>
                  </details>
                )}
                {primaryWorkbookImage && (
                  <div className="mt-5 rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={primaryWorkbookImage}
                      alt={isEt ? "Töövihiku lehekülg" : "Workbook page"}
                      className="w-full object-contain"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Strategies */}
          <div>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
              {isEt ? "Strateegiad" : "Strategies"}
            </h2>
            {workbookStrategyImages.length > 0 && (
              <div className="mb-3 space-y-3">
                {workbookStrategyImages.map((url, index) => (
                  <div
                    key={`${url}-${index}`}
                    className="bg-white border border-zinc-200 rounded-2xl overflow-hidden"
                  >
                    <div className="px-5 py-3 border-b border-zinc-100">
                      <p className="text-sm font-semibold text-zinc-900">
                        {isEt ? "Töövihiku lahendusstrateegiate leht" : "Workbook strategy page"}
                      </p>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={isEt ? "Ülesande lahendusstrateegiad" : "Task solution strategies"}
                      className="w-full object-contain bg-zinc-50"
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {task.strategies.map((strategy, i) => (
                <div
                  key={i}
                  className="bg-white border border-zinc-200 rounded-2xl overflow-hidden"
                >
                  <button
                    onClick={() => setOpenStrategy(openStrategy === i ? null : i)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left"
                  >
                    <p className="font-semibold text-zinc-900">
                      {isEt ? strategy.nameEt : strategy.name}
                    </p>
                    <span className="text-zinc-400 text-xs ml-3">
                      {openStrategy === i ? "▲" : "▼"}
                    </span>
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
            </div>
          </div>

          {/* Misconceptions */}
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5">
            <h3 className="font-semibold text-rose-900 mb-3 text-xs uppercase tracking-wide">
              {isEt ? "Levinud väärarusaamad" : "Common Misconceptions"}
            </h3>
            <ul className="space-y-2">
              {(isEt ? task.commonMisconceptionsEt : task.commonMisconceptions).map((m, i) => (
                <li key={i} className="text-sm text-rose-800 flex gap-2">
                  <span className="shrink-0">⚠</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Facilitation */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
            <h3 className="font-semibold text-blue-900 mb-3 text-xs uppercase tracking-wide">
              {isEt ? "Juhendamine" : "Facilitation"}
            </h3>
            <p className="text-sm text-blue-900 leading-relaxed">
              {isEt ? task.facilitationEt : task.facilitation}
            </p>
          </div>

          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-6">
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: AI Chat — sticky */}
        <div className="w-96 shrink-0 sticky top-16">
          <div
            className="bg-white border border-zinc-200 rounded-2xl flex flex-col"
            style={{ height: "calc(100vh - 5rem)" }}
          >
            {/* Chat header */}
            <div className="px-5 py-4 border-b border-zinc-100 shrink-0">
              <p className="font-semibold text-zinc-900 text-sm">
                {isEt ? "AI abiline" : "AI Coach"}
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">
                {isEt
                  ? "Küsi strateegiate, väärarusaamade kohta või lae üles pilt õpilastööst."
                  : "Ask about strategies, misconceptions, or upload a photo of student work."}
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-8 text-zinc-400">
                  <p className="text-3xl mb-3">💬</p>
                  <div className="flex flex-col gap-1.5">
                    {suggestedPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => setChatInput(prompt)}
                        className="text-xs text-blue-600 hover:bg-blue-50 rounded-lg px-3 py-1.5 transition-colors text-left"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => {
                const text = getMessageText(msg.content);
                const imgUrl = getMessageImage(msg.content);
                const isUser = msg.role === "user";
                return (
                  <div key={i} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                    {imgUrl && (
                      <div className="mb-1 rounded-xl overflow-hidden max-w-[85%]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imgUrl}
                          alt="Shared image"
                          className="max-h-48 object-contain w-full"
                        />
                      </div>
                    )}
                    {(text || (msg.role === "assistant" && chatLoading && i === messages.length - 1)) && (
                      <div
                        className={`max-w-[90%] px-3 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                          isUser
                            ? "bg-blue-600 text-white"
                            : "bg-zinc-100 text-zinc-800"
                        }`}
                      >
                        {text || "▋"}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Pending image preview */}
            {(chatImageUrl || chatImageUploading) && (
              <div className="px-4 pb-2 flex items-center gap-2 shrink-0">
                {chatImageUploading ? (
                  <div className="h-14 w-14 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : chatImageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={chatImageUrl}
                      alt="Pending"
                      className="h-14 w-14 object-cover rounded-xl border border-zinc-200"
                    />
                    <button
                      onClick={() => setChatImageUrl(null)}
                      className="text-xs text-zinc-400 hover:text-zinc-700"
                    >
                      ✕ {isEt ? "Eemalda" : "Remove"}
                    </button>
                  </>
                ) : null}
              </div>
            )}

            {/* Input row */}
            <div className="border-t border-zinc-100 p-3 flex gap-2 items-end shrink-0">
              <input
                type="file"
                ref={chatFileInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleChatImageFile(f);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => chatFileInputRef.current?.click()}
                disabled={chatLoading || chatImageUploading}
                className="p-2.5 rounded-xl border border-zinc-200 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50 shrink-0 text-base"
                title={isEt ? "Lisa pilt õpilastööst" : "Upload student work photo"}
              >
                📷
              </button>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={isEt ? "Küsi küsimus..." : "Ask a question..."}
                rows={1}
                className="flex-1 px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                disabled={chatLoading}
                style={{ minHeight: "42px", maxHeight: "120px" }}
              />
              <button
                onClick={sendMessage}
                disabled={chatLoading || (!chatInput.trim() && !chatImageUrl)}
                className="p-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
              >
                →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TaskPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <TaskPageInner slug={slug} />
    </Suspense>
  );
}
