"use client";

import { type ChangeEvent, type FormEvent, type ReactNode, useRef, useState } from "react";

type Language = "et" | "en";

type PromptStartFormProps = {
  lang: Language;
  promptLabel: string;
  promptPlaceholder: string;
  promptChips: readonly string[];
  emptySubmitLabel: string;
  attachmentLabel: string;
  voiceLabel: string;
  startLabel: string;
  children: ReactNode;
};

export default function PromptStartForm({
  lang,
  promptLabel,
  promptPlaceholder,
  promptChips,
  emptySubmitLabel,
  attachmentLabel,
  voiceLabel,
  startLabel,
  children,
}: PromptStartFormProps) {
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasMeaningfulPrompt = prompt.trim().length > 0 || files.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!hasMeaningfulPrompt) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    setFileError(null);

    try {
      if (files.length > 0) {
        const pendingFiles = await Promise.all(files.map(fileToPendingUpload));
        sessionStorage.setItem("arvutaju.pendingChatFiles", JSON.stringify(pendingFiles));
      } else {
        sessionStorage.removeItem("arvutaju.pendingChatFiles");
      }

      const params = new URLSearchParams();
      if (lang === "en") params.set("lang", "en");
      if (prompt.trim()) params.set("prompt", prompt.trim());
      window.location.assign(`/chat${params.toString() ? `?${params.toString()}` : ""}`);
    } catch {
      setFileError(lang === "et" ? "Faili ei õnnestunud lisada." : "Could not attach that file.");
    }
  }

  function handlePromptChip(chip: string) {
    setPrompt(chip);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      textarea.focus();
      textarea.setSelectionRange(chip.length, chip.length);
    });
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length === 0) return;
    setFiles((current) => [...current, ...selectedFiles].slice(0, 6));
    setFileError(null);
    event.target.value = "";
  }

  function removeFile(fileToRemove: File) {
    setFiles((current) => current.filter((file) => file !== fileToRemove));
  }

  return (
    <>
      <form
        action="/chat"
        onSubmit={handleSubmit}
        className="rounded-[2rem] border border-[#eadfd4] bg-white p-4 shadow-lg shadow-[#b09cf0]/10"
      >
        <input type="hidden" name="lang" value={lang} />
        <label htmlFor="task-prompt" className="sr-only">
          {promptLabel}
        </label>
        <textarea
          ref={textareaRef}
          id="task-prompt"
          name="prompt"
          rows={3}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={promptPlaceholder}
          className="block min-h-24 w-full resize-none border-0 bg-transparent text-base leading-7 text-[#1b1b1f] outline-none placeholder:text-[#8a8179]"
        />
        {files.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {files.map((file) => (
              <span
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#eadfd4] bg-[#fffaf4] px-3 py-1.5 text-xs font-medium text-[#5f5b57]"
              >
                <span className="max-w-[12rem] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(file)}
                  className="font-semibold text-[#b83f05] hover:text-[#1b1b1f] focus-visible:outline-none"
                  aria-label={`${attachmentLabel}: ${file.name}`}
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}
        {fileError && (
          <p className="mt-3 rounded-lg border border-[#ffd7bd] bg-[#fff6ef] px-3 py-2 text-xs leading-5 text-[#8f3508]">
            {fileError}
          </p>
        )}
        <div className="mt-4 flex items-center justify-between gap-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt,.md,.json,.pptx"
            onChange={handleFileChange}
            className="hidden"
            aria-label={attachmentLabel}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fffaf4] text-xl leading-none text-[#5f5b57] transition-colors hover:bg-[#fff0e7] hover:text-[#b83f05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b09cf0] focus-visible:ring-offset-2"
            aria-label={attachmentLabel}
          >
            +
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-full text-[#8a8179]"
              aria-label={voiceLabel}
            >
              {children}
            </button>
            <button
              type="submit"
              disabled={!hasMeaningfulPrompt}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[#fc6513] px-3 text-sm font-medium text-white transition-colors hover:bg-[#e85a10] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b09cf0] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#d8d2cc] disabled:text-[#6c665f] disabled:hover:bg-[#d8d2cc] sm:px-4"
              aria-label={hasMeaningfulPrompt ? startLabel : emptySubmitLabel}
            >
              <span className="hidden sm:inline">{startLabel}</span>
              <span aria-hidden="true">↑</span>
            </button>
          </div>
        </div>
      </form>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {promptChips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => handlePromptChip(chip)}
            className="inline-flex h-8 items-center rounded-full border border-[#d8cdf9] bg-white/80 px-3 text-xs font-medium text-[#6a50d4] shadow-sm shadow-[#b09cf0]/10 transition-colors hover:border-[#b09cf0] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b09cf0] focus-visible:ring-offset-2"
          >
            {chip}
          </button>
        ))}
      </div>
    </>
  );
}

type PendingUpload = {
  name: string;
  type: string;
  lastModified: number;
  dataUrl: string;
};

function fileToPendingUpload(file: File): Promise<PendingUpload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Invalid file result"));
        return;
      }

      resolve({
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        dataUrl: reader.result,
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}
