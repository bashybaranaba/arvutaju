import Link from "next/link";

type Language = "et" | "en";

type SiteHeaderProps = {
  lang: Language;
  languageHref?: string;
  startHref?: string;
};

const logoFontStyle = {
  fontFamily:
    '"Arial Rounded MT Bold", "Avenir Next Rounded", "Nunito Sans", var(--font-geist-sans), system-ui, sans-serif',
} as const;

const copyByLang = {
  et: {
    navLabel: "Põhinavigatsioon",
    homeLabel: "Arvutaju avaleht",
    languageLabel: "Keelevalik",
    workbook: "Töövihik",
    methodology: "Põhimõtted",
    workflow: "Töövoog",
    login: "Logi sisse",
    loginUnavailable: "Logi sisse ei ole veel saadaval",
    getStarted: "Alusta",
  },
  en: {
    navLabel: "Primary navigation",
    homeLabel: "Arvutaju home",
    languageLabel: "Language selection",
    workbook: "Workbook",
    methodology: "Principles",
    workflow: "Workflow",
    login: "Log in",
    loginUnavailable: "Log in is not available yet",
    getStarted: "Get started",
  },
} as const;

export default function SiteHeader({
  lang,
  languageHref,
  startHref,
}: SiteHeaderProps) {
  const copy = copyByLang[lang];
  const nextLang = lang === "et" ? "en" : "et";
  const homeHref = lang === "en" ? "/?lang=en" : "/";
  const workbookHref = lang === "en" ? "/workbook?lang=en" : "/workbook";
  const principlesHref = lang === "en" ? "/?lang=en#metoodika" : "/#metoodika";
  const workflowHref = lang === "en" ? "/?lang=en#toovoog" : "/#toovoog";
  const resolvedLanguageHref =
    languageHref ?? (nextLang === "en" ? "/?lang=en" : "/");
  const resolvedStartHref = startHref ?? `${homeHref}#alusta`;

  return (
    <header className="border-b border-[#eadfd4] bg-[#fffaf4]/92 backdrop-blur">
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
        aria-label={copy.navLabel}
      >
        <div className="flex h-10 items-center gap-8">
          <Link
            href={homeHref}
            className="inline-flex h-10 -translate-y-[4px] items-center text-2xl font-black leading-none tracking-[-0.04em] sm:text-[1.7rem] [&>span]:leading-none"
            style={logoFontStyle}
            aria-label={copy.homeLabel}
          >
            <span className="text-[#1b1b1f]">arvu</span>
            <span className="-mx-0.5 text-[#fc6513]">+</span>
            <span className="text-[#7c63d8]">aju</span>
          </Link>
          <div className="hidden h-10 items-center gap-6 text-sm font-medium text-[#5f5b57] md:flex">
            <Link
              href={workbookHref}
              className="inline-flex h-10 items-center transition-colors hover:text-[#1b1b1f]"
            >
              {copy.workbook}
            </Link>
            <Link
              href={principlesHref}
              className="inline-flex h-10 items-center transition-colors hover:text-[#1b1b1f]"
            >
              {copy.methodology}
            </Link>
            <Link
              href={workflowHref}
              className="inline-flex h-10 items-center transition-colors hover:text-[#1b1b1f]"
            >
              {copy.workflow}
            </Link>
          </div>
        </div>

        <div className="flex h-10 items-center gap-6">
          <Link
            href={resolvedLanguageHref}
            className="inline-flex h-10 items-center text-sm font-semibold uppercase text-[#5f5b57] transition-colors hover:text-[#1b1b1f]"
            aria-label={copy.languageLabel}
          >
            {nextLang.toUpperCase()}
          </Link>
          <button
            type="button"
            disabled
            className="hidden h-10 cursor-not-allowed items-center text-sm font-medium text-[#6c665f] md:inline-flex"
            aria-label={copy.loginUnavailable}
          >
            {copy.login}
          </button>
          <Link
            href={resolvedStartHref}
            className="hidden h-9 items-center justify-center rounded-full bg-[#fc6513] px-3 text-sm font-medium text-white transition-colors hover:bg-[#e85a10] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b09cf0] focus-visible:ring-offset-2 sm:inline-flex"
          >
            {copy.getStarted}
          </Link>
        </div>
      </nav>
    </header>
  );
}
