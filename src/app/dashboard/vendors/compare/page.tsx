import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { resolveCategoryLabel } from "@/lib/categories";
import { formatCurrency, formatDateBR } from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = { ids?: string };

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const t = await getTranslations("dashboard.vendors.compare");
  const STATUS_LABEL: Record<string, string> = {
    NEGOTIATION: t("status.negotiation"),
    CONTRACTED: t("status.contracted"),
    FINALIZED: t("status.finalized"),
  };
  const params = await searchParams;
  const ids = (params.ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);

  const vendors = ids.length
    ? await prisma.vendor.findMany({
        where: { id: { in: ids }, deletedAt: null },
        include: {
          budgetItems: { where: { deletedAt: null } },
          payments: { where: { deletedAt: null } },
          contacts: { where: { deletedAt: null }, select: { id: true } },
          contracts: { where: { deletedAt: null }, select: { id: true } },
          attachments: { where: { deletedAt: null }, select: { id: true } },
          vendorNotes: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { body: true, createdAt: true, kind: true },
          },
        },
      })
    : [];

  const sorted = ids
    .map((id) => vendors.find((v) => v.id === id))
    .filter((v): v is (typeof vendors)[number] => !!v);

  const computed = sorted.map((v) => {
    const totalBudget = v.budgetItems.reduce(
      (s, b) => s + (b.actualValue ?? b.estimatedValue),
      0,
    );
    const paid = v.payments
      .filter((p) => p.status === "PAID")
      .reduce((s, p) => s + p.amount, 0);
    return {
      vendor: v,
      totalBudget,
      paid,
      balance: totalBudget - paid,
    };
  });

  const minPrice = computed.length ? Math.min(...computed.map((c) => c.totalBudget).filter((n) => n > 0)) : 0;
  const maxRating = computed.length ? Math.max(...computed.map((c) => c.vendor.rating ?? 0)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/dashboard/vendors"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" /> {t("back")}
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{t("title")}</h1>
        <p className="text-sm text-zinc-500">
          {computed.length === 0
            ? t("hint")
            : t("comparing", { count: computed.length })}
        </p>
      </div>

      {computed.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/40">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-44 bg-zinc-900/80 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  {t("criterion")}
                </th>
                {computed.map(({ vendor }) => (
                  <th key={vendor.id} className="min-w-[220px] px-4 py-3 text-left">
                    <Link
                      href={`/dashboard/vendors/${vendor.id}`}
                      className="text-base font-semibold text-zinc-100 hover:text-rose-300"
                    >
                      {vendor.name}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {resolveCategoryLabel(vendor.categoryKey, vendor.category)}
                    </p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              <Row label={t("row.status")}>
                {computed.map(({ vendor }) => (
                  <Cell key={vendor.id}>{STATUS_LABEL[vendor.status] ?? vendor.status}</Cell>
                ))}
              </Row>
              <Row label={t("row.rating")}>
                {computed.map(({ vendor }) => (
                  <Cell key={vendor.id} highlight={!!vendor.rating && vendor.rating === maxRating}>
                    {vendor.rating ? `${vendor.rating} ★` : "—"}
                  </Cell>
                ))}
              </Row>
              <Row label={t("row.totalValue")}>
                {computed.map((c) => (
                  <Cell
                    key={c.vendor.id}
                    highlight={c.totalBudget === minPrice && c.totalBudget > 0}
                    accent="rose"
                  >
                    {formatCurrency(c.totalBudget)}
                  </Cell>
                ))}
              </Row>
              <Row label={t("row.paid")}>
                {computed.map((c) => (
                  <Cell key={c.vendor.id} accent="emerald">
                    {formatCurrency(c.paid)}
                  </Cell>
                ))}
              </Row>
              <Row label={t("row.balance")}>
                {computed.map((c) => (
                  <Cell key={c.vendor.id} accent={c.balance > 0 ? "rose" : "emerald"}>
                    {formatCurrency(c.balance)}
                  </Cell>
                ))}
              </Row>
              <Row label={t("row.indicatedBy")}>
                {computed.map(({ vendor }) => (
                  <Cell key={vendor.id}>{vendor.indicatedBy ?? "—"}</Cell>
                ))}
              </Row>
              <Row label={t("row.tags")}>
                {computed.map(({ vendor }) => (
                  <Cell key={vendor.id}>
                    {vendor.tags ? (
                      <div className="flex flex-wrap gap-1">
                        {vendor.tags
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean)
                          .map((t) => (
                            <span
                              key={t}
                              className="rounded-full border border-zinc-700 bg-zinc-800/60 px-1.5 py-0.5 text-[10px]"
                            >
                              {t}
                            </span>
                          ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </Cell>
                ))}
              </Row>
              <Row label={t("row.counts")}>
                {computed.map(({ vendor }) => (
                  <Cell key={vendor.id}>
                    {vendor.contacts.length} / {vendor.contracts.length} / {vendor.attachments.length}
                  </Cell>
                ))}
              </Row>
              <Row label={t("row.notes")}>
                {computed.map(({ vendor }) => (
                  <Cell key={vendor.id}>
                    {vendor.notes ? (
                      <p className="whitespace-pre-line text-xs text-zinc-300">{vendor.notes}</p>
                    ) : (
                      "—"
                    )}
                  </Cell>
                ))}
              </Row>
              <Row label={t("row.lastInteraction")}>
                {computed.map(({ vendor }) => {
                  const last = vendor.vendorNotes[0];
                  return (
                    <Cell key={vendor.id}>
                      {last ? (
                        <div>
                          <p className="text-xs text-zinc-500">{formatDateBR(last.createdAt)}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-zinc-200">{last.body}</p>
                        </div>
                      ) : (
                        "—"
                      )}
                    </Cell>
                  );
                })}
              </Row>
              <Row label={t("row.contractLink")}>
                {computed.map(({ vendor }) =>
                  vendor.contractLink ? (
                    <Cell key={vendor.id}>
                      <a
                        href={vendor.contractLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-rose-300 hover:text-rose-200"
                      >
                        {t("open")}
                      </a>
                    </Cell>
                  ) : (
                    <Cell key={vendor.id}>—</Cell>
                  ),
                )}
              </Row>
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-zinc-600">
        {t("legend")}
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <th
        scope="row"
        className="sticky left-0 z-10 w-44 bg-zinc-900/80 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500"
      >
        {label}
      </th>
      {children}
    </tr>
  );
}

function Cell({
  children,
  highlight,
  accent,
}: {
  children: React.ReactNode;
  highlight?: boolean;
  accent?: "rose" | "emerald";
}) {
  const baseAccent =
    accent === "rose" ? "text-rose-300" : accent === "emerald" ? "text-emerald-300" : "text-zinc-200";
  return (
    <td
      className={`min-w-[220px] px-4 py-3 align-top text-sm ${baseAccent} ${
        highlight ? "bg-emerald-500/10 ring-1 ring-emerald-500/30" : ""
      }`}
    >
      {children}
    </td>
  );
}

async function EmptyState() {
  const t = await getTranslations("dashboard.vendors.compare");
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center">
      <p className="text-zinc-300">{t("empty.title")}</p>
      <p className="mt-2 text-sm text-zinc-500">
        {t("empty.description")}
      </p>
      <Link
        href="/dashboard/vendors"
        className="mt-4 inline-flex items-center gap-1 text-sm text-rose-300 hover:text-rose-200"
      >
        {t("empty.cta")}
      </Link>
    </div>
  );
}
