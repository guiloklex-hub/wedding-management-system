"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import {
  createPayment,
  createSplitPayment,
  deletePayment,
  generateInstallments,
  markPaymentAsPaid,
  undoPaymentPaid,
  updatePayment,
} from "@/app/actions/paymentActions";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination, usePagination } from "@/components/pagination";
import { formatCurrency, formatDateBR, toIsoDate } from "@/lib/format";
import { computeAdjustedAmount } from "@/lib/payment-adjustment";
import type { Payment, PaymentMethod, PaymentStatus, Vendor } from "@/types";
import PaymentsCalendar from "./payments-calendar";

type PaymentWithVendor = Payment & { vendor: Vendor };

type Props = {
  payments: PaymentWithVendor[];
  vendors: Vendor[];
};

const METHOD_VALUES: PaymentMethod[] = ["PIX", "BOLETO", "CREDIT", "TRANSFER", "CASH"];

type MethodTranslator = (key: string) => string;

function MethodOptions({ t }: { t: MethodTranslator }) {
  return (
    <>
      {METHOD_VALUES.map((value) => (
        <option key={value} value={value}>
          {t(`method.${value}`)}
        </option>
      ))}
    </>
  );
}

export default function PaymentsClient({ payments, vendors }: Props) {
  const t = useTranslations("dashboard.payments");
  const tc = useTranslations("common");
  const toast = useToast();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isInstallmentsOpen, setInstallmentsOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentWithVendor | null>(null);
  const [deleting, setDeleting] = useState<PaymentWithVendor | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | PaymentStatus>("ALL");
  const [isSplit, setIsSplit] = useState(false);
  const [, startTransition] = useTransition();
  const [isCreating, setCreating] = useState(false);
  const [isUpdating, setUpdating] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  function handleCreate(formData: FormData) {
    setCreating(true);
    startTransition(async () => {
      try {
        const r = isSplit
          ? await createSplitPayment(undefined, formData)
          : await createPayment(undefined, formData);
        if (r.success) {
          toast.success(isSplit ? t("toast.splitCreated") : t("toast.created"));
          setCreateOpen(false);
          setIsSplit(false);
        } else {
          toast.error(t("toast.createFailed"), r.error);
        }
      } finally {
        setCreating(false);
      }
    });
  }

  function handleUpdate(formData: FormData) {
    setUpdating(true);
    startTransition(async () => {
      try {
        const r = await updatePayment(undefined, formData);
        if (r.success) {
          toast.success(t("toast.updated"));
          setEditing(null);
        } else {
          toast.error(t("toast.updateFailed"), r.error);
        }
      } finally {
        setUpdating(false);
      }
    });
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (term && !p.vendor.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [payments, search, statusFilter]);

  const { pageItems, page, totalPages, total, from, to, setPage } = usePagination(filtered, 20);

  function handleMarkPaid(payment: PaymentWithVendor) {
    startTransition(async () => {
      const r = await markPaymentAsPaid(payment.id);
      if (r.success) toast.success(t("toast.markedPaid"));
      else toast.error(t("toast.genericFailed"), r.error);
    });
  }

  function handleUndo(payment: PaymentWithVendor) {
    startTransition(async () => {
      const r = await undoPaymentPaid(payment.id);
      if (r.success) toast.success(t("toast.reverted"));
      else toast.error(t("toast.genericFailed"), r.error);
    });
  }

  function handleDelete() {
    if (!deleting) return;
    const target = deleting;
    startTransition(async () => {
      const r = await deletePayment(target.id);
      if (r.success) {
        toast.success(t("toast.deleted"));
        setDeleting(null);
      } else {
        toast.error(t("toast.deleteFailed"), r.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          {viewMode === "list" ? (
            <>
              <div className="relative flex-1 max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder={t("list.searchPlaceholder")}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as "ALL" | PaymentStatus);
                  setPage(1);
                }}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
              >
                <option value="ALL">{t("filter.allStatus")}</option>
                <option value="PENDING">{tc("status.pending")}</option>
                <option value="PAID">{tc("status.paid")}</option>
              </select>
            </>
          ) : (
            <div className="flex-1" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Alternador de visualização Lista vs Calendário */}
          <div className="flex rounded-xl border border-zinc-800 bg-zinc-950 p-1 shrink-0">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                viewMode === "list"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t("view.list")}
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                viewMode === "calendar"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t("view.calendar")}
            </button>
          </div>
          <button
            onClick={() => setInstallmentsOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3.5 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <Layers className="h-4 w-4" />
            <span className="hidden md:inline">{t("actions.generateInstallments")}</span>
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-lg transition-colors hover:bg-rose-500"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden md:inline">{t("actions.new")}</span>
          </button>
        </div>
      </div>

      {viewMode === "list" ? (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-400">
                <thead className="border-b border-zinc-800 bg-zinc-900/80 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-6 py-4 font-medium">{t("table.dueDate")}</th>
                    <th className="px-6 py-4 font-medium">{t("table.vendor")}</th>
                    <th className="px-6 py-4 font-medium">{tc("labels.amount")}</th>
                    <th className="px-6 py-4 font-medium">{t("table.method")}</th>
                    <th className="px-6 py-4 font-medium">{t("table.installment")}</th>
                    <th className="px-6 py-4 font-medium">{tc("labels.status")}</th>
                    <th className="px-6 py-4 text-right font-medium">{tc("labels.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-zinc-500">
                        {payments.length === 0 ? t("list.empty") : t("list.noResults")}
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((payment) => (
                      <tr key={payment.id} className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30">
                        <td className="px-6 py-4 text-zinc-200">{formatDateBR(payment.dueDate)}</td>
                        <td className="px-6 py-4">{payment.vendor.name}</td>
                        <td className="px-6 py-4">
                          <AmountCell payment={payment} />
                        </td>
                        <td className="px-6 py-4">{payment.method ?? "—"}</td>
                        <td className="px-6 py-4 text-xs text-zinc-500">
                          {payment.installmentNumber && payment.totalInstallments
                            ? `${payment.installmentNumber}/${payment.totalInstallments}`
                            : "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                              payment.status === "PAID"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            }`}
                          >
                            {payment.status === "PAID" ? tc("status.paid") : tc("status.pending")}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            {payment.status === "PENDING" ? (
                              <button
                                type="button"
                                onClick={() => handleMarkPaid(payment)}
                                className="flex items-center gap-1 rounded-lg px-2 py-1 text-emerald-400 transition-colors hover:bg-emerald-500/10"
                                aria-label={t("actions.markPaid")}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                <span className="text-xs">{t("actions.markPaid")}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleUndo(payment)}
                                className="flex items-center gap-1 rounded-lg px-2 py-1 text-amber-400 transition-colors hover:bg-amber-500/10"
                                aria-label={t("actions.revert")}
                              >
                                <RotateCcw className="h-4 w-4" />
                                <span className="text-xs">{t("actions.revert")}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditing(payment)}
                              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                              aria-label={tc("actions.edit")}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleting(payment)}
                              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                              aria-label={tc("actions.delete")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-8 text-center text-sm text-zinc-500">
                {payments.length === 0 ? t("list.empty") : t("list.noResults")}
              </div>
            ) : (
              pageItems.map((payment) => (
                <div key={payment.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-zinc-100">{payment.vendor.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">{t("card.dueOn", { date: formatDateBR(payment.dueDate) })}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        payment.status === "PAID"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}
                    >
                      {payment.status === "PAID" ? tc("status.paid") : tc("status.pending")}
                    </span>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <div className="text-lg font-semibold text-rose-400">
                        <AmountCell payment={payment} />
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        {payment.method ?? "—"}
                        {payment.installmentNumber && payment.totalInstallments
                          ? ` · ${payment.installmentNumber}/${payment.totalInstallments}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {payment.status === "PENDING" ? (
                        <button
                          type="button"
                          onClick={() => handleMarkPaid(payment)}
                          className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400"
                          aria-label={t("actions.markPaid")}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUndo(payment)}
                          className="rounded-lg bg-amber-500/10 p-2 text-amber-400"
                          aria-label={t("actions.revert")}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditing(payment)}
                        className="rounded-lg bg-zinc-800/60 p-2 text-zinc-300"
                        aria-label={tc("actions.edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(payment)}
                        className="rounded-lg bg-zinc-800/60 p-2 text-rose-400"
                        aria-label={tc("actions.delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            from={from}
            to={to}
            onPageChange={setPage}
          />
        </>
      ) : (
        <PaymentsCalendar
          payments={payments}
          onMarkPaid={handleMarkPaid}
          onUndoPaid={handleUndo}
          onEdit={setEditing}
          onDelete={setDeleting}
        />
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-sm sm:items-center">
          <div className="my-4 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">{t("form.createTitle")}</h2>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
                  <input
                    type="checkbox"
                    checked={isSplit}
                    onChange={(e) => setIsSplit(e.target.checked)}
                    className="accent-rose-500"
                  />
                  <span>{t("form.splitToggle")}</span>
                </label>
              </div>

              <form action={handleCreate} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.vendor")}</label>
                  <select
                    name="vendorId"
                    required
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
                  >
                    <option value="">{t("form.selectPlaceholder")}</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                {!isSplit ? (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.amount")}</label>
                        <input
                          type="number"
                          step="0.01"
                          name="amount"
                          required
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.dueDate")}</label>
                        <input
                          type="date"
                          name="dueDate"
                          required
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.method")}</label>
                        <select
                          name="method"
                          required
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
                        >
                          <MethodOptions t={t} />
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.status")}</label>
                        <select
                          name="status"
                          defaultValue="PENDING"
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
                        >
                          <option value="PENDING">{tc("status.pending")}</option>
                          <option value="PAID">{tc("status.paid")}</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-sm font-medium text-zinc-400">
                        {t("form.installments")} <span className="text-xs text-zinc-500">{tc("labels.optional")}</span>
                      </p>
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <input
                          type="number"
                          name="installmentNumber"
                          min="1"
                          max="999"
                          placeholder={t("form.installmentNumberPlaceholder")}
                          aria-label={t("form.installmentNumberLabel")}
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
                        />
                        <span className="text-zinc-500">{t("form.installmentOf")}</span>
                        <input
                          type="number"
                          name="totalInstallments"
                          min="1"
                          max="999"
                          placeholder={t("form.totalInstallmentsPlaceholder")}
                          aria-label={t("form.totalInstallmentsLabel")}
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-500">
                        {t("form.installmentsHint")}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-400">
                          {t("form.lateFee")} <span className="text-xs text-zinc-500">{t("form.optionalShort")}</span>
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          name="lateFeePercent"
                          placeholder={t("form.lateFeePlaceholder")}
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-400">
                          {t("form.interest")} <span className="text-xs text-zinc-500">{t("form.optionalShort")}</span>
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          name="interestPercentPerMonth"
                          placeholder={t("form.interestPlaceholder")}
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        {t("split.depositTitle")}
                      </h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.amount")}</label>
                          <input
                            type="number"
                            step="0.01"
                            name="depositAmount"
                            required
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-zinc-200 outline-none focus:border-rose-500/50"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.method")}</label>
                          <select
                            name="depositMethod"
                            required
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-zinc-200 outline-none focus:border-rose-500/50"
                          >
                            <MethodOptions t={t} />
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        {t("split.balanceTitle")}
                      </h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.amount")}</label>
                          <input
                            type="number"
                            step="0.01"
                            name="finalAmount"
                            required
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-zinc-200 outline-none focus:border-rose-500/50"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.dueDate")}</label>
                          <input
                            type="date"
                            name="finalDueDate"
                            required
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-zinc-200 outline-none focus:border-rose-500/50"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-400">{t("split.balanceMethod")}</label>
                        <select
                          name="finalMethod"
                          defaultValue="PIX"
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-zinc-200 outline-none focus:border-rose-500/50"
                        >
                          <MethodOptions t={t} />
                        </select>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateOpen(false);
                      setIsSplit(false);
                    }}
                    className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
                  >
                    {tc("actions.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex flex-1 items-center justify-center rounded-xl bg-rose-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:opacity-50"
                  >
                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : tc("actions.save")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <EditPaymentModal
          payment={editing}
          vendors={vendors}
          isBusy={isUpdating}
          formAction={handleUpdate}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t("delete.title")}
        description={
          deleting
            ? t("delete.description", {
                amount: formatCurrency(deleting.amount),
                vendor: deleting.vendor.name,
              })
            : undefined
        }
        confirmLabel={tc("actions.delete")}
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />

      {isInstallmentsOpen ? (
        <InstallmentsModal
          vendors={vendors}
          onClose={() => setInstallmentsOpen(false)}
          onSuccess={() => {
            toast.success(t("toast.installmentsGenerated"));
            setInstallmentsOpen(false);
            startTransition(() => {});
          }}
        />
      ) : null}
    </div>
  );
}

function AmountCell({ payment }: { payment: PaymentWithVendor }) {
  const t = useTranslations("dashboard.payments");
  const adj = computeAdjustedAmount({
    amount: payment.amount,
    dueDate: payment.dueDate,
    paidAt: payment.paidAt,
    status: payment.status,
    lateFeePercent: payment.lateFeePercent,
    interestPercentPerMonth: payment.interestPercentPerMonth,
  });
  if (!adj.hasAdjustment) {
    return <span className="font-medium text-rose-400">{formatCurrency(payment.amount)}</span>;
  }
  return (
    <span
      className="font-medium text-rose-400"
      title={t("amount.adjustedTooltip", {
        base: formatCurrency(adj.amount),
        lateFee: formatCurrency(adj.lateFee),
        interest: formatCurrency(adj.interest),
        days: adj.lateDays,
      })}
    >
      <span className="text-zinc-500 line-through">{formatCurrency(adj.amount)}</span>{" "}
      <span>{formatCurrency(adj.adjusted)}</span>
      <span className="ml-1 rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-300">
        +{adj.lateDays}d
      </span>
    </span>
  );
}

function InstallmentsModal({
  vendors,
  onClose,
  onSuccess,
}: {
  vendors: Vendor[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useTranslations("dashboard.payments");
  const tc = useTranslations("common");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(10);
  const [totalAmount, setTotalAmount] = useState("");
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [firstDueDate, setFirstDueDate] = useState(toIsoDate(new Date()));
  const [intervalDays, setIntervalDays] = useState(30);
  const [method, setMethod] = useState<PaymentMethod>("PIX");
  const [lateFeePercent, setLateFeePercent] = useState<string>("");
  const [interestPercentPerMonth, setInterestPercentPerMonth] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [, startTransition] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await generateInstallments({
      vendorId,
      totalAmount: Number(totalAmount),
      installmentsCount: count,
      firstDueDate,
      intervalDays,
      method,
      lateFeePercent: lateFeePercent ? Number(lateFeePercent) : undefined,
      interestPercentPerMonth: interestPercentPerMonth
        ? Number(interestPercentPerMonth)
        : undefined,
      notes: notes.trim() || undefined,
    });
    setBusy(false);
    if (!res.success) {
      toast.error(tc("common.errorGeneric"), res.error);
      return;
    }
    startTransition(() => onSuccess());
  }

  const installmentValue =
    Number(totalAmount) > 0 && count > 0
      ? formatCurrency(Number(totalAmount) / count)
      : "—";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={submit}
        className="my-4 w-full max-w-md space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
      >
        <h2 className="text-base font-semibold text-zinc-100">{t("installmentsModal.title")}</h2>
        <p className="text-xs text-zinc-500">
          {t("installmentsModal.description")}
        </p>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-zinc-400">{t("form.vendor")}</span>
          <select
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
          >
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-400">{t("installmentsModal.totalAmount")}</span>
            <input
              type="number"
              step="0.01"
              min={0.01}
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-400">{t("installmentsModal.count")}</span>
            <input
              type="number"
              min={1}
              max={60}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
        </div>
        <p className="text-xs text-zinc-500">
          {t("installmentsModal.eachInstallment")} <strong className="text-zinc-200">{installmentValue}</strong>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-400">{t("installmentsModal.firstDate")}</span>
            <input
              type="date"
              value={firstDueDate}
              onChange={(e) => setFirstDueDate(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-400">{t("installmentsModal.intervalDays")}</span>
            <input
              type="number"
              min={1}
              max={366}
              value={intervalDays}
              onChange={(e) => setIntervalDays(Number(e.target.value))}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-zinc-400">{t("form.method")}</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
          >
            <MethodOptions t={t} />
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-400">{t("installmentsModal.lateFee")}</span>
            <input
              type="number"
              step="0.1"
              min={0}
              max={100}
              value={lateFeePercent}
              onChange={(e) => setLateFeePercent(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
              placeholder={t("form.lateFeePlaceholder")}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-400">{t("installmentsModal.interest")}</span>
            <input
              type="number"
              step="0.1"
              min={0}
              max={100}
              value={interestPercentPerMonth}
              onChange={(e) => setInterestPercentPerMonth(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
              placeholder={t("form.interestPlaceholder")}
            />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-zinc-400">{t("form.notes")}</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={500}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            {tc("actions.cancel")}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60"
          >
            {busy ? t("installmentsModal.generating") : t("installmentsModal.generateButton", { count })}
          </button>
        </div>
      </form>
    </div>
  );
}

function EditPaymentModal({
  payment,
  vendors,
  isBusy,
  formAction,
  onClose,
}: {
  payment: PaymentWithVendor;
  vendors: Vendor[];
  isBusy: boolean;
  formAction: (formData: FormData) => void;
  onClose: () => void;
}) {
  const t = useTranslations("dashboard.payments");
  const tc = useTranslations("common");
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="my-4 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <form action={formAction} className="space-y-4 p-6">
          <h2 className="text-xl font-bold text-white">{t("form.editTitle")}</h2>
          <input type="hidden" name="id" value={payment.id} />

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.vendor")}</label>
            <select
              name="vendorId"
              defaultValue={payment.vendorId}
              required
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
            >
              {vendors.find((v) => v.id === payment.vendorId) ? null : (
                <option value={payment.vendorId}>{payment.vendor.name}</option>
              )}
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.amount")}</label>
              <input
                type="number"
                step="0.01"
                name="amount"
                required
                defaultValue={payment.amount}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.dueDate")}</label>
              <input
                type="date"
                name="dueDate"
                required
                defaultValue={toIsoDate(new Date(payment.dueDate))}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.method")}</label>
              <select
                name="method"
                defaultValue={payment.method ?? "PIX"}
                required
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
              >
                <MethodOptions t={t} />
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.status")}</label>
              <select
                name="status"
                defaultValue={payment.status}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
              >
                <option value="PENDING">{tc("status.pending")}</option>
                <option value="PAID">{tc("status.paid")}</option>
              </select>
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-zinc-400">
              {t("form.installments")} <span className="text-xs text-zinc-500">{tc("labels.optional")}</span>
            </p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <input
                type="number"
                name="installmentNumber"
                min="1"
                max="999"
                placeholder={t("form.installmentNumberPlaceholder")}
                defaultValue={payment.installmentNumber ?? ""}
                aria-label={t("form.installmentNumberLabel")}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
              />
              <span className="text-zinc-500">{t("form.installmentOf")}</span>
              <input
                type="number"
                name="totalInstallments"
                min="1"
                max="999"
                placeholder={t("form.totalInstallmentsPlaceholder")}
                defaultValue={payment.totalInstallments ?? ""}
                aria-label={t("form.totalInstallmentsLabel")}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">
                {t("form.lateFee")} <span className="text-xs text-zinc-500">{t("form.optionalShort")}</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                name="lateFeePercent"
                defaultValue={payment.lateFeePercent ?? ""}
                placeholder={t("form.lateFeePlaceholder")}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">
                {t("form.interest")} <span className="text-xs text-zinc-500">{t("form.optionalShort")}</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                name="interestPercentPerMonth"
                defaultValue={payment.interestPercentPerMonth ?? ""}
                placeholder={t("form.interestPlaceholder")}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.notes")}</label>
            <textarea
              name="notes"
              rows={2}
              defaultValue={payment.notes ?? ""}
              maxLength={500}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
            >
              {tc("actions.cancel")}
            </button>
            <button
              type="submit"
              disabled={isBusy}
              className="flex flex-1 items-center justify-center rounded-xl bg-rose-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:opacity-50"
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : tc("actions.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
