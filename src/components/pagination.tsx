"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

export type PaginationState<T> = {
  pageItems: T[];
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  setPage: (page: number) => void;
};

export function usePagination<T>(items: T[], pageSize = 20): PaginationState<T> {
  const [rawPage, setRawPage] = useState(1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, rawPage), totalPages);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = useMemo(() => items.slice(start, end), [items, start, end]);
  return {
    pageItems,
    page,
    totalPages,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(end, total),
    setPage: setRawPage,
  };
}

function buildPages(page: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | "ellipsis")[] = [1];
  const left = Math.max(2, page - 1);
  const right = Math.min(totalPages - 1, page + 1);
  if (left > 2) pages.push("ellipsis");
  for (let p = left; p <= right; p++) pages.push(p);
  if (right < totalPages - 1) pages.push("ellipsis");
  pages.push(totalPages);
  return pages;
}

export function Pagination({
  page,
  totalPages,
  total,
  from,
  to,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations("common.pagination");
  if (totalPages <= 1) return null;

  const pages = buildPages(page, totalPages);
  const stepClass =
    "inline-flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-zinc-950";

  return (
    <nav
      aria-label={t("navLabel")}
      className="flex flex-col items-center justify-between gap-3 pt-1 sm:flex-row"
    >
      <p className="text-xs text-zinc-500">{t("showing", { from, to, total })}</p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label={t("previous")}
          className={stepClass}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{t("previous")}</span>
        </button>
        {pages.map((p, idx) =>
          p === "ellipsis" ? (
            <span key={`ellipsis-${idx}`} className="px-1.5 text-sm text-zinc-600">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={`min-w-[2.25rem] rounded-xl border px-2.5 py-1.5 text-sm transition-colors ${
                p === page
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                  : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label={t("next")}
          className={stepClass}
        >
          <span className="hidden sm:inline">{t("next")}</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
