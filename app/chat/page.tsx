import SiteHeader from "../components/SiteHeader";
import TeacherAssistantFlow from "../components/TeacherAssistantFlow";

type Language = "et" | "en";

type PageSearchParams = {
  lang?: string | string[] | undefined;
  prompt?: string | string[] | undefined;
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const params = await searchParams;
  const lang = getLanguage(params.lang);
  const prompt = getValue(params.prompt);
  const languageHref = lang === "et" ? "/chat?lang=en" : "/chat";
  const startHref = lang === "en" ? "/?lang=en#alusta" : "/#alusta";

  return (
    <div lang={lang} className="min-h-screen bg-[#fffaf4] text-[#1b1b1f] lg:h-screen lg:overflow-hidden">
      <SiteHeader lang={lang} languageHref={languageHref} startHref={startHref} />

      <main className="px-4 py-5 sm:px-6 lg:h-[calc(100svh-4rem)] lg:overflow-hidden lg:p-0">
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
