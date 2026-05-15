"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  HelpCircle,
  Lightbulb,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  HELP_ARTICLES,
  HELP_CATEGORIES,
  HELP_FAQ,
  type HelpArticle,
  type HelpCategoryId,
} from "@/lib/help-content";
import { CHANGELOG } from "@/lib/changelog";

const ALL_CATEGORIES = "all" as const;
type CategoryFilter = HelpCategoryId | typeof ALL_CATEGORIES;

export default function HelpClient() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CategoryFilter>(ALL_CATEGORIES);
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const filteredArticles = useMemo(() => {
    const term = search.trim().toLowerCase();
    return HELP_ARTICLES.filter((a) => {
      if (filter !== ALL_CATEGORIES && a.category !== filter) return false;
      if (!term) return true;
      const haystack = [
        a.title,
        a.summary,
        ...a.keywords,
        ...(a.steps?.map((s) => `${s.title} ${s.body}`) ?? []),
        ...(a.tips ?? []),
        ...(a.warnings ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [search, filter]);

  const grouped = useMemo(() => {
    const map = new Map<HelpCategoryId, HelpArticle[]>();
    for (const a of filteredArticles) {
      const list = map.get(a.category) ?? [];
      list.push(a);
      map.set(a.category, list);
    }
    return HELP_CATEGORIES.map((c) => ({ category: c, articles: map.get(c.id) ?? [] })).filter(
      (g) => g.articles.length > 0,
    );
  }, [filteredArticles]);

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-zinc-900/30 p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-rose-500/20 p-2.5 ring-1 ring-rose-500/30">
            <HelpCircle className="h-6 w-6 text-rose-200" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-white">Central de Ajuda</h1>
            <p className="mt-1 text-sm text-zinc-300">
              Tudo o que você precisa para usar o Wedding Finance Planner. Busque,
              filtre e expanda os artigos por categoria.
            </p>
          </div>
        </div>

        <div className="relative mt-5">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar (ex.: WhatsApp, pagamento, RSVP, backup...)"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-3 pl-11 pr-10 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-rose-500/40"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </header>

      <Filters current={filter} onChange={setFilter} />

      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-10 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-zinc-600" />
          <h3 className="mt-3 text-lg font-medium text-zinc-300">Nada encontrado</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Tente outro termo ou limpe os filtros.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ category, articles }) => {
            const Icon = category.icon;
            return (
              <section
                key={category.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6"
              >
                <header className="mb-4 flex items-center gap-3">
                  <div className={`rounded-xl border bg-zinc-950 p-2 ${tone(category.color)}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{category.label}</h2>
                    <p className="text-xs text-zinc-500">{category.description}</p>
                  </div>
                  <span className="ml-auto rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
                    {articles.length} {articles.length === 1 ? "artigo" : "artigos"}
                  </span>
                </header>

                <div className="space-y-2">
                  {articles.map((article) => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      expanded={expandedArticle === article.id}
                      onToggle={() =>
                        setExpandedArticle((prev) => (prev === article.id ? null : article.id))
                      }
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <FaqSection expandedFaq={expandedFaq} setExpandedFaq={setExpandedFaq} />

      <ChangelogSection />
    </div>
  );
}

function Filters({
  current,
  onChange,
}: {
  current: CategoryFilter;
  onChange: (v: CategoryFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(ALL_CATEGORIES)}
        className={chipClass(current === ALL_CATEGORIES)}
      >
        Todos
      </button>
      {HELP_CATEGORIES.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={chipClass(current === c.id)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

function chipClass(active: boolean): string {
  const base =
    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors";
  return active
    ? `${base} border-rose-500/40 bg-rose-500/15 text-rose-200`
    : `${base} border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200`;
}

function ArticleCard({
  article,
  expanded,
  onToggle,
}: {
  article: HelpArticle;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = article.icon;
  return (
    <article
      className={`overflow-hidden rounded-xl border transition-colors ${
        expanded
          ? "border-rose-500/30 bg-zinc-950/50"
          : "border-zinc-800 bg-zinc-950/30 hover:border-zinc-700"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <Icon className={`h-5 w-5 shrink-0 ${expanded ? "text-rose-300" : "text-zinc-400"}`} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-zinc-100">{article.title}</h3>
          <p className="mt-0.5 truncate text-xs text-zinc-500">{article.summary}</p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${
            expanded ? "rotate-180 text-rose-300" : ""
          }`}
        />
      </button>

      {expanded ? (
        <div className="space-y-4 border-t border-zinc-800 px-4 py-4 text-sm text-zinc-300">
          {article.steps ? (
            <ol className="space-y-3">
              {article.steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-[11px] font-semibold text-rose-200 ring-1 ring-rose-500/30">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium text-zinc-100">{s.title}</p>
                    <p className="mt-0.5 text-zinc-400">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}

          {article.tips && article.tips.length > 0 ? (
            <div className="space-y-1 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="flex items-center gap-2 text-emerald-300">
                <Lightbulb className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Dicas</span>
              </div>
              <ul className="space-y-1 text-emerald-100/90">
                {article.tips.map((t, i) => (
                  <li key={i} className="text-xs">
                    • {t}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {article.warnings && article.warnings.length > 0 ? (
            <div className="space-y-1 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="flex items-center gap-2 text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Atenção</span>
              </div>
              <ul className="space-y-1 text-amber-100/90">
                {article.warnings.map((w, i) => (
                  <li key={i} className="text-xs">
                    • {w}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {article.externalDoc ? (
            <a
              href={article.externalDoc}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-rose-300 hover:text-rose-200"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Leia o guia técnico completo →
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function FaqSection({
  expandedFaq,
  setExpandedFaq,
}: {
  expandedFaq: number | null;
  setExpandedFaq: (v: number | null) => void;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
      <header className="mb-4 flex items-center gap-3">
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-2 text-violet-200">
          <HelpCircle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Perguntas Frequentes</h2>
          <p className="text-xs text-zinc-500">As 10 dúvidas mais comuns dos casais.</p>
        </div>
      </header>

      <div className="space-y-2">
        {HELP_FAQ.map((item, i) => {
          const open = expandedFaq === i;
          return (
            <div
              key={i}
              className={`overflow-hidden rounded-xl border transition-colors ${
                open
                  ? "border-violet-500/30 bg-zinc-950/50"
                  : "border-zinc-800 bg-zinc-950/30 hover:border-zinc-700"
              }`}
            >
              <button
                type="button"
                onClick={() => setExpandedFaq(open ? null : i)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
                aria-expanded={open}
              >
                <span className="flex-1 text-sm font-medium text-zinc-100">{item.question}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${
                    open ? "rotate-180 text-violet-300" : ""
                  }`}
                />
              </button>
              {open ? (
                <div className="border-t border-zinc-800 px-4 py-3 text-sm text-zinc-300">
                  {item.answer}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ChangelogSection() {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
      <header className="mb-4 flex items-center gap-3">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-200">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Histórico de Versões</h2>
          <p className="text-xs text-zinc-500">O que mudou em cada release.</p>
        </div>
      </header>

      <div className="space-y-4">
        {CHANGELOG.map((entry) => (
          <article
            key={entry.version}
            className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4"
          >
            <header className="flex items-baseline justify-between">
              <span className="font-mono text-sm font-semibold text-zinc-100">
                v{entry.version}
              </span>
              <span className="text-xs text-zinc-500">{entry.date}</span>
            </header>
            <ul className="mt-3 space-y-1 text-sm text-zinc-300">
              {entry.highlights.map((h, i) => (
                <li key={i}>• {h}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function tone(color: string): string {
  switch (color) {
    case "rose":
      return "border-rose-500/30 text-rose-300";
    case "emerald":
      return "border-emerald-500/30 text-emerald-300";
    case "blue":
      return "border-blue-500/30 text-blue-300";
    case "amber":
      return "border-amber-500/30 text-amber-300";
    case "violet":
      return "border-violet-500/30 text-violet-300";
    case "cyan":
      return "border-cyan-500/30 text-cyan-300";
    case "pink":
      return "border-pink-500/30 text-pink-300";
    case "teal":
      return "border-teal-500/30 text-teal-300";
    default:
      return "border-zinc-700 text-zinc-300";
  }
}
