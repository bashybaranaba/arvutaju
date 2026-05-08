import type { ReactNode } from "react";
import Link from "next/link";

type Language = "et" | "en";

type PageSearchParams = {
  lang?: string | string[] | undefined;
};

const logoFontStyle = {
  fontFamily:
    '"Arial Rounded MT Bold", "Avenir Next Rounded", "Nunito Sans", system-ui, sans-serif',
} as const;

const sectionClassName = "px-4 py-16 sm:px-6 sm:py-20 lg:px-8";
const containerClassName = "mx-auto max-w-6xl";

const landingCopy = {
  et: {
    navLabel: "Põhinavigatsioon",
    homeLabel: "Arvutaju avaleht",
    languageLabel: "Keelevalik",
    methodology: "Põhimõtted",
    samples: "Töövoog",
    login: "Logi sisse",
    loginUnavailable: "Logi sisse ei ole veel saadaval",
    start: "Alusta",
    getStarted: "Alusta",
    headline: "Muuda matemaatiline mõtlemine nähtavaks",
    subheading: "Valmista ülesandeid, mis avavad õpilaste mõtlemise ja strateegiad.",
    attachmentLabel: "Lisa manus",
    voiceLabel: "Häälsisend",
    promptLabel: "Kirjelda arvutaju ülesannet",
    promptPlaceholder: "Kirjelda, millist arvutaju ülesannet vajad…",
    promptChips: [
      "5. klass · kümnendmurrud",
      "Lahutamine arvteljel",
      "Suunavad küsimused",
    ],
    sampleEyebrow: "Klassiruumi töövoog",
    sampleHeading: "Valmis arutelu tunniks",
    sampleBody: "Ülesanne, võimalikud strateegiad ja suunavad küsimused on ühes selges vaates.",
    taskTitle: "Ülesanne tunniks",
    taskText:
      "Telefonipaketis oli 45,6 GB mobiilset internetti. Kuu jooksul kasutati ära 28,7 GB. Kui palju internetimahtu jäi alles?",
    taskTags: ["5.–6. klass", "Kümnendmurrud", "Lahutamine", "Arvuteisendus"],
    strategiesTitle: "Võimalikud strateegiad",
    strategies: ["Arvu tükeldamine", "Arvtelg", "Kompensatsioon"],
    guidingQuestionsTitle: "Suunavad küsimused",
    guidingQuestions: [
      "Kuidas saaksid arve osadeks jaotada?",
      "Kuidas kontrollid, kas vastus on mõistlik?",
    ],
    featureHeading: "Üks töövoog matemaatiliseks aruteluks",
    featureSubheading: "Vähem ettevalmistusmüra. Rohkem sisukat matemaatilist arutelu.",
    features: [
      {
        title: "Ülesanded klassiruumi",
        body: "Vali või koosta lühike arutelupõhine ülesanne.",
      },
      {
        title: "Strateegiad nähtavaks",
        body: "Too esile eri lahenduskäigud ja seosed.",
      },
      {
        title: "Suunavad küsimused",
        body: "Valmista ette küsimused, mis viivad arutelu edasi.",
      },
    ],
    methodEyebrow: "Põhimõtted",
    principlesHeading: "Arutelu enne vastust",
    principlesBody:
      "Kui õpilased saavad oma mõtlemist sõnastada, muutub matemaatika seoste, põhjenduste ja valikute uurimiseks. Vastus on oluline, aga see ei ole kogu õppimine.",
    principles: [
      {
        title: "Mõtlemine enne vastust",
        body: "Aeg märgata seoseid.",
      },
      {
        title: "Mitu strateegiat",
        body: "Rohkem kui üks lahendustee.",
      },
      {
        title: "Selgitamine",
        body: "Mõtlemine sõnadesse.",
      },
    ],
    finalCtaEyebrow: "Järgmine samm",
    finalCta: "Valmista esimene arvutaju arutelu ette",
    finalCtaBody:
      "Alusta klassi, teema ja arutelu fookuse kirjeldamisest. Arvutaju aitab koondada ülesande, strateegiad ja suunavad küsimused õpetaja töövoogu.",
    footerTagline: "Õpetaja tööriist matemaatilise mõtlemise nähtavaks muutmiseks.",
    footerColumns: [
      {
        title: "Toode",
        links: [
          { label: "Alusta", href: "#alusta" },
          { label: "Töövoog", href: "#toovoog" },
          { label: "Põhimõtted", href: "#metoodika" },
        ],
      },
      {
        title: "Õpetajale",
        links: [
          { label: "Ülesanded klassiruumi", href: "#toovoog" },
          { label: "Lahendusstrateegiad", href: "#toovoog" },
          { label: "Arutelu tugi", href: "#metoodika" },
        ],
      },
      {
        title: "Ressursid",
        links: [
          { label: "Metoodika", href: "#metoodika" },
          { label: "Töövoo näide", href: "#toovoog" },
          { label: "English", href: "/?lang=en" },
        ],
      },
    ],
    footerCopyright: "© 2026 Arvutaju.",
  },
  en: {
    navLabel: "Primary navigation",
    homeLabel: "Arvutaju home",
    languageLabel: "Language selection",
    methodology: "Principles",
    samples: "Workflow",
    login: "Log in",
    loginUnavailable: "Log in is not available yet",
    start: "Start",
    getStarted: "Get started",
    headline: "Make mathematical thinking visible",
    subheading: "Prepare tasks that reveal students' thinking and strategies.",
    attachmentLabel: "Add attachment",
    voiceLabel: "Voice input",
    promptLabel: "Describe a number sense task",
    promptPlaceholder: "Describe the number sense task you need…",
    promptChips: [
      "Grade 5 · decimals",
      "Subtraction on a number line",
      "Guiding questions",
    ],
    sampleEyebrow: "Classroom workflow",
    sampleHeading: "Ready for class discussion",
    sampleBody: "The task, possible strategies, and guiding questions live in one clear view.",
    taskTitle: "Task for class",
    taskText:
      "A phone plan had 45.6 GB of mobile data. During the month, 28.7 GB was used. How much data remained?",
    taskTags: ["Grades 5–6", "Decimals", "Subtraction", "Real-world context"],
    strategiesTitle: "Possible strategies",
    strategies: ["Decomposing numbers", "Number line", "Compensation"],
    guidingQuestionsTitle: "Guiding questions",
    guidingQuestions: [
      "How could you decompose the numbers?",
      "How can you check whether the answer is reasonable?",
    ],
    featureHeading: "One workflow for mathematical discussion",
    featureSubheading: "Less planning noise. More meaningful mathematical discussion.",
    features: [
      {
        title: "Classroom-ready tasks",
        body: "Choose or create a short discussion-based task.",
      },
      {
        title: "Visible strategies",
        body: "Surface different solution paths and relationships.",
      },
      {
        title: "Guiding questions",
        body: "Prepare questions that move the discussion forward.",
      },
    ],
    methodEyebrow: "Principles",
    principlesHeading: "Discussion before answers",
    principlesBody:
      "When students put their thinking into words, mathematics becomes a study of relationships, justifications, and choices. The answer matters, but it is not the whole learning.",
    principles: [
      {
        title: "Thinking before answers",
        body: "Time to notice relationships.",
      },
      {
        title: "Many strategies",
        body: "More than one path.",
      },
      {
        title: "Explanation",
        body: "Thinking put into words.",
      },
    ],
    finalCtaEyebrow: "Next step",
    finalCta: "Prepare your first number sense discussion",
    finalCtaBody:
      "Start by describing the grade, topic, and discussion focus. Arvutaju helps bring the task, strategies, and guiding questions into a teacher-friendly workflow.",
    footerTagline: "A teacher tool for making mathematical thinking visible.",
    footerColumns: [
      {
        title: "Product",
        links: [
          { label: "Start", href: "#alusta" },
          { label: "Workflow", href: "#toovoog" },
          { label: "Principles", href: "#metoodika" },
        ],
      },
      {
        title: "For Teachers",
        links: [
          { label: "Classroom tasks", href: "#toovoog" },
          { label: "Solution strategies", href: "#toovoog" },
          { label: "Discussion support", href: "#metoodika" },
        ],
      },
      {
        title: "Resources",
        links: [
          { label: "Methodology", href: "#metoodika" },
          { label: "Example workflow", href: "#toovoog" },
          { label: "Eesti", href: "/" },
        ],
      },
    ],
    footerCopyright: "© 2026 Arvutaju.",
  },
} as const;

type LandingCopy = (typeof landingCopy)[Language];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const params = await searchParams;
  const lang = getLanguage(params.lang);
  const copy = landingCopy[lang];

  return (
    <div lang={lang} className="min-h-screen bg-[#fffaf4] text-[#1b1b1f]">
      <Header copy={copy} lang={lang} />

      <main>
        <Hero copy={copy} lang={lang} />
        <WorkflowPreview copy={copy} lang={lang} />
        <Features copy={copy} />
        <Principles copy={copy} />
        <FinalCta copy={copy} />
        <Footer copy={copy} lang={lang} />
      </main>
    </div>
  );
}

function getLanguage(lang: PageSearchParams["lang"]): Language {
  const value = Array.isArray(lang) ? lang[0] : lang;
  return value === "en" ? "en" : "et";
}

function Header({ copy, lang }: { copy: LandingCopy; lang: Language }) {
  return (
    <header className="border-b border-[#eadfd4] bg-[#fffaf4]/92 backdrop-blur">
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
        aria-label={copy.navLabel}
      >
        <div className="flex items-center gap-8">
          <Logo copy={copy} lang={lang} />
          <div className="hidden items-center gap-6 text-sm font-medium text-[#5f5b57] md:flex">
            <Link href="#metoodika" className="transition-colors hover:text-[#1b1b1f]">
              {copy.methodology}
            </Link>
            <Link href="#toovoog" className="transition-colors hover:text-[#1b1b1f]">
              {copy.samples}
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <LanguageToggle copy={copy} lang={lang} />
          <button
            type="button"
            disabled
            className="hidden cursor-not-allowed text-sm font-medium text-[#6c665f] md:inline-flex"
            aria-label={copy.loginUnavailable}
          >
            {copy.login}
          </button>
          <ButtonLink href="#alusta" size="sm" className="hidden sm:inline-flex">
            {copy.getStarted}
          </ButtonLink>
        </div>
      </nav>
    </header>
  );
}

function Logo({ copy, lang }: { copy: LandingCopy; lang: Language }) {
  return (
    <Link
      href={lang === "en" ? "/?lang=en" : "/"}
      className="flex items-baseline text-2xl font-black leading-none tracking-[-0.04em] sm:text-[1.7rem]"
      style={logoFontStyle}
      aria-label={copy.homeLabel}
    >
      <span className="text-[#1b1b1f]">arvu</span>
      <span className="-mx-0.5 translate-y-[0.02em] text-[#fc6513]">+</span>
      <span className="text-[#7c63d8]">aju</span>
    </Link>
  );
}

function LanguageToggle({ copy, lang }: { copy: LandingCopy; lang: Language }) {
  const nextLang = lang === "et" ? "en" : "et";

  return (
    <Link
      href={nextLang === "en" ? "/?lang=en" : "/"}
      className="text-sm font-semibold uppercase text-[#5f5b57] transition-colors hover:text-[#1b1b1f]"
      aria-label={copy.languageLabel}
    >
      {nextLang.toUpperCase()}
    </Link>
  );
}

function Hero({ copy, lang }: { copy: LandingCopy; lang: Language }) {
  const isEt = lang === "et";

  return (
    <section className="relative flex min-h-[calc(100svh-4rem)] items-center overflow-hidden bg-[radial-gradient(circle_at_50%_70%,rgba(176,156,240,0.15),transparent_34%),radial-gradient(circle_at_48%_80%,rgba(252,101,19,0.10),transparent_32%),linear-gradient(180deg,#fffaf4_0%,#fffdf9_60%,#fffaf4_100%)] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="mx-auto w-full">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-balance text-[2.25rem] font-semibold leading-[1.08] tracking-[-0.03em] text-[#1b1b1f] sm:text-[2.875rem] lg:text-[3.25rem]">
            {copy.headline}
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-pretty text-lg leading-8 text-[#5f5b57]">
            {copy.subheading}
          </p>
          <Link
            href="/workbook"
            className="inline-flex mt-4 text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            {isEt
              ? "Liigu läbi töövihiku ülesanne ülesande haaval →"
              : "Walk through the workbook task by task →"}
          </Link>
        </div>

        <PromptPreview copy={copy} />
      </div>
    </section>
  );
}

function PromptPreview({ copy }: { copy: LandingCopy }) {
  return (
    <div id="alusta" className="mx-auto mt-10 max-w-3xl scroll-mt-8">
      <div className="rounded-[2rem] border border-[#eadfd4] bg-white p-4 shadow-lg shadow-[#b09cf0]/10">
        <label htmlFor="task-prompt" className="sr-only">
          {copy.promptLabel}
        </label>
        <div
          id="task-prompt"
          role="textbox"
          aria-label={copy.promptLabel}
          aria-readonly="true"
          className="min-h-24 text-base leading-7 text-[#8a8179]"
        >
          {copy.promptPlaceholder}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled
            className="flex h-9 w-9 shrink-0 cursor-not-allowed items-center justify-center rounded-full bg-[#fffaf4] text-xl leading-none text-[#5f5b57]"
            aria-label={copy.attachmentLabel}
          >
            +
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-full text-[#8a8179]"
              aria-label={copy.voiceLabel}
            >
              <MicrophoneIcon />
            </button>
            <ButtonLink href="#toovoog" size="prompt" ariaLabel={copy.start}>
              <span className="hidden sm:inline">{copy.start}</span>
              <span aria-hidden="true">↑</span>
            </ButtonLink>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {copy.promptChips.map((chip) => (
          <QuickPrompt key={chip}>{chip}</QuickPrompt>
        ))}
      </div>
    </div>
  );
}

function QuickPrompt({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      disabled
      className="inline-flex h-8 cursor-not-allowed items-center gap-2 rounded-full border border-[#d8cdf9] bg-white/80 px-3 text-xs font-medium text-[#6a50d4] shadow-sm shadow-[#b09cf0]/10"
    >
      {children}
      <span className="text-[#7c63d8]" aria-hidden="true">
        ↑
      </span>
    </button>
  );
}

function WorkflowPreview({ copy, lang }: { copy: LandingCopy; lang: Language }) {
  return (
    <section id="toovoog" className={sectionClassName}>
      <div className={cn(containerClassName, "grid items-start gap-8 lg:grid-cols-[0.9fr_1.1fr]")}>
        <SectionIntro eyebrow={copy.sampleEyebrow} title={copy.sampleHeading}>
          {copy.sampleBody}
        </SectionIntro>

        <Card className="border-t-4 border-t-[#b09cf0] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#7c63d8]">{copy.taskTitle}</p>
              <p className="mt-3 text-xl font-semibold leading-8 text-[#1b1b1f]">
                {copy.taskText}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {copy.taskTags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>

          <Separator className="my-5" />

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-[#1b1b1f]">{copy.strategiesTitle}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {copy.strategies.map((strategy) => (
                  <Badge key={strategy} variant="outline">
                    {strategy}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-[#eadfd4] bg-[#fffaf4] p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-[#5f5b57]">
                <span>{formatDecimal("45.6", lang)}</span>
                <span className="h-px flex-1 bg-[#d9cec3]" />
                <span>{formatDecimal("28.7", lang)}</span>
              </div>
              <div className="mt-4 grid grid-cols-5 gap-1.5" aria-hidden="true">
                {[...Array(15)].map((_, index) => (
                  <span
                    key={index}
                    className={cn(
                      "h-1.5 rounded-full",
                      index < 9 ? "bg-[#7c63d8]/45" : "bg-[#fc6513]/45",
                    )}
                  />
                ))}
              </div>
            </div>
          </div>

          <Separator className="my-5" />

          <div>
            <h3 className="text-sm font-semibold text-[#1b1b1f]">
              {copy.guidingQuestionsTitle}
            </h3>
            <ul className="mt-3 space-y-2">
              {copy.guidingQuestions.map((question) => (
                <li key={question} className="flex gap-2 text-sm leading-6 text-[#5f5b57]">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#fc6513]" />
                  <span>{question}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </section>
  );
}

function Features({ copy }: { copy: LandingCopy }) {
  return (
    <section className={sectionClassName} aria-labelledby="features-heading">
      <div className={containerClassName}>
        <div className="max-w-2xl">
          <h2
            id="features-heading"
            className="text-2xl font-semibold tracking-normal text-[#1b1b1f] sm:text-3xl"
          >
            {copy.featureHeading}
          </h2>
          <p className="mt-3 text-base leading-7 text-[#5f5b57]">{copy.featureSubheading}</p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {copy.features.map((feature, index) => (
            <Card
              key={feature.title}
              className={cn("flex min-h-[9rem] flex-col p-5", featureAccent(index))}
            >
              <h3 className="text-base font-semibold text-[#1b1b1f]">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#5f5b57]">{feature.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function Principles({ copy }: { copy: LandingCopy }) {
  return (
    <section
      id="metoodika"
      className={sectionClassName}
      aria-labelledby="principles-heading"
    >
      <div className={containerClassName}>
        <Card className="overflow-hidden rounded-[2rem] bg-white p-0">
          <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
            <div className="p-6 sm:p-8 lg:p-10">
              <SectionIntro
                eyebrow={copy.methodEyebrow}
                title={copy.principlesHeading}
                id="principles-heading"
              >
                {copy.principlesBody}
              </SectionIntro>
            </div>

            <ol className="grid gap-3 border-t border-[#eadfd4] bg-[#fffdf9] p-4 sm:p-5 lg:border-l lg:border-t-0 lg:p-6">
              {copy.principles.map((principle, index) => (
                <li
                  key={principle.title}
                  className="flex min-h-24 items-start gap-4 rounded-2xl border border-[#eadfd4] bg-white/80 p-4"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f1edff] text-sm font-semibold text-[#6a50d4]">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold leading-5 text-[#1b1b1f] sm:text-base">
                      {principle.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#5f5b57]">{principle.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Card>
      </div>
    </section>
  );
}

function FinalCta({ copy }: { copy: LandingCopy }) {
  return (
    <section className="px-4 pb-8 pt-4 sm:px-6 sm:pb-10 sm:pt-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-[2rem] border border-[#2b2926] bg-[#1b1b1f] p-6 text-white shadow-sm shadow-[#eadfd4]/55 sm:p-7 lg:p-8">
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[#b09cf0]">{copy.finalCtaEyebrow}</p>
            <h2 className="mt-2 text-balance text-2xl font-semibold tracking-normal sm:text-3xl">
              {copy.finalCta}
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/75 sm:text-base">
              {copy.finalCtaBody}
            </p>
          </div>
          <ButtonLink href="#alusta" variant="inverse" className="shrink-0">
            {copy.start}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

function Footer({ copy, lang }: { copy: LandingCopy; lang: Language }) {
  return (
    <footer className="px-4 pb-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-[2rem] border border-[#eadfd4] bg-white p-6 shadow-sm shadow-[#eadfd4]/55 sm:p-8 lg:p-10">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_2fr]">
          <div className="flex flex-col justify-between gap-8">
            <div>
              <Logo copy={copy} lang={lang} />
              <p className="mt-4 max-w-xs text-sm leading-6 text-[#5f5b57]">
                {copy.footerTagline}
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm text-[#6c665f]">
              <Link
                href={lang === "et" ? "/?lang=en" : "/"}
                className="font-semibold uppercase transition-colors hover:text-[#1b1b1f]"
                aria-label={copy.languageLabel}
              >
                {lang === "et" ? "EN" : "ET"}
              </Link>
              <span aria-hidden="true">·</span>
              <span>{copy.footerCopyright}</span>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {copy.footerColumns.map((column) => (
              <div key={column.title}>
                <h2 className="text-sm font-semibold text-[#1b1b1f]">{column.title}</h2>
                <ul className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm leading-6 text-[#5f5b57] transition-colors hover:text-[#1b1b1f]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

function SectionIntro({
  eyebrow,
  title,
  children,
  id,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-[#7c63d8]">{eyebrow}</p>
      <h2
        id={id}
        className="mt-3 text-2xl font-semibold tracking-normal text-[#1b1b1f] sm:text-3xl"
      >
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-base leading-7 text-[#5f5b57]">{children}</p>
    </div>
  );
}

function ButtonLink({
  href,
  children,
  variant = "default",
  size = "default",
  ariaLabel,
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "default" | "outline" | "inverse";
  size?: "default" | "sm" | "icon" | "prompt";
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center justify-center rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b09cf0] focus-visible:ring-offset-2",
        variant === "default" && "bg-[#fc6513] text-white hover:bg-[#e85a10]",
        variant === "outline" &&
          "border border-[#d9cec3] bg-white text-[#1b1b1f] hover:bg-[#f8f0e8]",
        variant === "inverse" && "bg-white text-[#1b1b1f] hover:bg-[#fff0e7]",
        size === "sm" && "h-9 px-3",
        size === "default" && "h-10 px-4",
        size === "icon" && "h-9 w-9 rounded-full px-0 text-lg",
        size === "prompt" && "h-9 gap-2 rounded-full px-3 sm:px-4",
        className,
      )}
    >
      {children}
    </Link>
  );
}

function Card({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        "rounded-2xl border border-[#eadfd4] bg-white shadow-sm shadow-[#eadfd4]/55",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Badge({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "secondary" | "outline" | "violet" | "orange";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium",
        variant === "default" && "bg-[#1b1b1f] text-white",
        variant === "secondary" && "bg-[#f7efe7] text-[#5f5b57]",
        variant === "outline" && "border border-[#eadfd4] bg-white text-[#5f5b57]",
        variant === "violet" && "bg-[#f1edff] text-[#6a50d4]",
        variant === "orange" && "bg-[#fff0e7] text-[#b83f05]",
      )}
    >
      {children}
    </span>
  );
}

function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-[#eadfd4]", className)} />;
}

function MicrophoneIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
    </svg>
  );
}

function formatDecimal(value: string, lang: Language) {
  return lang === "et" ? value.replace(".", ",") : value;
}

function featureAccent(index: number) {
  const accents = [
    "border-t-4 border-t-[#fc6513]",
    "border-t-4 border-t-[#b09cf0]",
    "border-t-4 border-t-[#1b1b1f]",
  ];

  return accents[index % accents.length];
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
