import Link from "next/link";
import TeacherAssistantFlow from "../components/TeacherAssistantFlow";

type Language = "et" | "en";

type PageSearchParams = {
  lang?: string | string[] | undefined;
  prompt?: string | string[] | undefined;
};

const logoFontStyle = {
  fontFamily:
    '"Arial Rounded MT Bold", "Avenir Next Rounded", "Nunito Sans", var(--font-geist-sans), system-ui, sans-serif',
} as const;

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const params = await searchParams;
  const lang = getLanguage(params.lang);
  const prompt = getValue(params.prompt);
  const isEt = lang === "et";

  return (
    <div lang={lang} className="min-h-screen bg-[#fffaf4] text-[#1b1b1f]">
      <header className="border-b border-[#eadfd4] bg-[#fffaf4]/92 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href={lang === "en" ? "/?lang=en" : "/"}
            className="flex items-baseline text-2xl font-black leading-none tracking-[-0.04em] sm:text-[1.7rem]"
            style={logoFontStyle}
            aria-label="Arvutaju avaleht"
          >
            <span className="text-[#1b1b1f]">arvu</span>
            <span className="-mx-0.5 translate-y-[0.02em] text-[#fc6513]">+</span>
            <span className="text-[#7c63d8]">aju</span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/workbook"
              className="hidden text-sm font-medium text-[#5f5b57] transition-colors hover:text-[#1b1b1f] sm:inline"
            >
              {isEt ? "Töövihik" : "Workbook"}
            </Link>
            <Link
              href={lang === "et" ? "/chat?lang=en" : "/chat"}
              className="text-sm font-semibold uppercase text-[#5f5b57] transition-colors hover:text-[#1b1b1f]"
            >
              {lang === "et" ? "EN" : "ET"}
            </Link>
          </div>
        </nav>
      </header>

      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <TeacherAssistantFlow lang={lang} initialPrompt={prompt} />
      </main>
    </div>
  );
}

function getLanguage(lang: PageSearchParams["lang"]): Language {
  const value = getValue(lang);
  return value === "en" ? "en" : "et";
}

function getValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
