"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  RotateCcw,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { formatCurrency, formatDateBR } from "@/lib/format";
import { computeAdjustedAmount } from "@/lib/payment-adjustment";
import type { Payment, Vendor } from "@/types";

type PaymentWithVendor = Payment & { vendor: Vendor };

type Props = {
  payments: PaymentWithVendor[];
  onMarkPaid: (payment: PaymentWithVendor) => void;
  onUndoPaid: (payment: PaymentWithVendor) => void;
  onEdit: (payment: PaymentWithVendor) => void;
  onDelete: (payment: PaymentWithVendor) => void;
};

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const WEEKDAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function PaymentsCalendar({
  payments,
  onMarkPaid,
  onUndoPaid,
  onEdit,
  onDelete,
}: Props) {
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Computa os anos dinâmicos de navegação ou permite navegação livre
  function handlePrevYear() {
    setCurrentYear((prev) => prev - 1);
    setSelectedDay(null);
  }

  function handleNextYear() {
    setCurrentYear((prev) => prev + 1);
    setSelectedDay(null);
  }

  function handlePrevMonth() {
    if (selectedMonth === null) return;
    if (selectedMonth === 0) {
      setCurrentYear((prev) => prev - 1);
      setSelectedMonth(11);
    } else {
      setSelectedMonth((prev) => prev! - 1);
    }
    setSelectedDay(null);
  }

  function handleNextMonth() {
    if (selectedMonth === null) return;
    if (selectedMonth === 11) {
      setCurrentYear((prev) => prev + 1);
      setSelectedMonth(0);
    } else {
      setSelectedMonth((prev) => prev! + 1);
    }
    setSelectedDay(null);
  }

  // Agrega dados financeiros para a Visão Anual (Jan-Dez)
  const annualStats = useMemo(() => {
    return Array.from({ length: 12 }, (_, monthIndex) => {
      const monthPayments = payments.filter((p) => {
        const d = new Date(p.dueDate);
        return d.getUTCFullYear() === currentYear && d.getUTCMonth() === monthIndex;
      });

      const total = monthPayments.reduce((sum, p) => sum + p.amount, 0);
      const paid = monthPayments
        .filter((p) => p.status === "PAID")
        .reduce((sum, p) => sum + p.amount, 0);
      const pending = monthPayments
        .filter((p) => p.status === "PENDING")
        .reduce((sum, p) => sum + p.amount, 0);

      const paidCount = monthPayments.filter((p) => p.status === "PAID").length;
      const pendingCount = monthPayments.filter((p) => p.status === "PENDING").length;

      return {
        monthIndex,
        total,
        paid,
        pending,
        paidCount,
        pendingCount,
        totalCount: monthPayments.length,
      };
    });
  }, [payments, currentYear]);

  // Gera a lista de células (dias) do calendário para o mês selecionado
  const calendarCells = useMemo(() => {
    if (selectedMonth === null) return [];

    const firstDayOfMonth = new Date(currentYear, selectedMonth, 1);
    const startDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = new Date(currentYear, selectedMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, selectedMonth, 0).getDate();

    const cells = [];

    // Preenchimento com dias do mês anterior
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const date = new Date(currentYear, selectedMonth - 1, day);
      cells.push({
        date,
        isCurrentMonth: false,
        dayNumber: day,
        payments: [],
      });
    }

    // Dias do mês atual
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, selectedMonth, day);
      const dayPayments = payments.filter((p) => {
        const d = new Date(p.dueDate);
        return (
          d.getUTCFullYear() === currentYear &&
          d.getUTCMonth() === selectedMonth &&
          d.getUTCDate() === day
        );
      });

      cells.push({
        date,
        isCurrentMonth: true,
        dayNumber: day,
        payments: dayPayments,
      });
    }

    // Preenchimento com dias do próximo mês
    const totalCells = cells.length > 35 ? 42 : 35;
    const remaining = totalCells - cells.length;
    for (let day = 1; day <= remaining; day++) {
      const date = new Date(currentYear, selectedMonth + 1, day);
      cells.push({
        date,
        isCurrentMonth: false,
        dayNumber: day,
        payments: [],
      });
    }

    return cells;
  }, [currentYear, selectedMonth, payments]);

  // Filtra e ordena pagamentos detalhados para exibir na listagem inferior
  const detailedPayments = useMemo(() => {
    if (selectedMonth === null) return [];

    return payments
      .filter((p) => {
        const d = new Date(p.dueDate);
        const matchesMonth = d.getUTCFullYear() === currentYear && d.getUTCMonth() === selectedMonth;
        if (!matchesMonth) return false;
        if (selectedDay !== null && d.getUTCDate() !== selectedDay) return false;
        return true;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [payments, currentYear, selectedMonth, selectedDay]);

  // Auxiliar para computar valores ajustados para exibição
  function AmountCell({ payment }: { payment: PaymentWithVendor }) {
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
        title={`Base ${formatCurrency(adj.amount)} + multa ${formatCurrency(adj.lateFee)} + juros ${formatCurrency(adj.interest)} (${adj.lateDays} dia(s) em atraso)`}
      >
        <span className="text-zinc-500 line-through text-xs mr-1">{formatCurrency(adj.amount)}</span>{" "}
        <span>{formatCurrency(adj.adjusted)}</span>
        <span className="ml-1 rounded bg-rose-500/10 px-1 py-0.2 text-[9px] text-rose-300">
          +{adj.lateDays}d
        </span>
      </span>
    );
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO DO CALENDÁRIO */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800/60 pb-5">
        <div className="flex items-center gap-3">
          {selectedMonth !== null && (
            <button
              onClick={() => {
                setSelectedMonth(null);
                setSelectedDay(null);
              }}
              className="group flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-900 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              <span>Visão Anual</span>
            </button>
          )}
          <h2 className="text-xl font-bold text-white tracking-tight">
            {selectedMonth === null
              ? `Calendário Financeiro de ${currentYear}`
              : `${MONTH_NAMES[selectedMonth]} de ${currentYear}`}
          </h2>
        </div>

        {/* NAVEGAÇÃO DE ANOS OU MESES */}
        <div className="flex items-center gap-2">
          {selectedMonth === null ? (
            <>
              <button
                onClick={handlePrevYear}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
                aria-label="Ano anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 text-sm font-semibold text-zinc-200">{currentYear}</span>
              <button
                onClick={handleNextYear}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
                aria-label="Próximo ano"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handlePrevMonth}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 text-sm font-semibold text-zinc-200">
                {MONTH_NAMES[selectedMonth]}
              </span>
              <button
                onClick={handleNextMonth}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* RENDERIZAÇÃO CONDICIONAL DA VISUALIZAÇÃO */}
      {selectedMonth === null ? (
        /* ==================== VISÃO ANUAL (JAN-DEZ) ==================== */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {annualStats.map(({ monthIndex, total, paid, pending, paidCount, pendingCount, totalCount }) => {
            const hasPayments = totalCount > 0;
            const progress = hasPayments ? (paid / total) * 100 : 0;

            return (
              <div
                key={monthIndex}
                onClick={() => setSelectedMonth(monthIndex)}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-rose-500/40 hover:bg-zinc-900/50 cursor-pointer shadow-lg hover:shadow-rose-500/5"
              >
                {/* Nome do Mês */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-100 group-hover:text-rose-400 transition-colors">
                      {MONTH_NAMES[monthIndex]}
                    </h3>
                    <p className="text-xs text-zinc-500">
                      {totalCount === 0
                        ? "Sem gastos agendados"
                        : `${totalCount} ${totalCount === 1 ? "pagamento" : "pagamentos"}`}
                    </p>
                  </div>
                  <CalendarIcon className="h-4 w-4 text-zinc-600 group-hover:text-rose-500/60 transition-colors" />
                </div>

                {/* Valores Resumidos */}
                <div className="mt-5 space-y-1">
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>Total Planejado:</span>
                    <span className="font-semibold text-zinc-200">{formatCurrency(total)}</span>
                  </div>
                  {hasPayments && (
                    <>
                      <div className="flex justify-between text-[11px] text-zinc-500">
                        <span>Pago ({paidCount}):</span>
                        <span className="text-emerald-400">{formatCurrency(paid)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-zinc-500">
                        <span>Pendente ({pendingCount}):</span>
                        <span className="text-amber-400">{formatCurrency(pending)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Barra de Progresso do Mês */}
                {hasPayments && (
                  <div className="mt-4 space-y-1.5">
                    <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                      <span>PROGRESsO</span>
                      <span>{Math.round(progress)}% pago</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ==================== VISÃO MENSAL (GRADE DE DIAS) ==================== */
        <div className="space-y-6">
          {/* GRADE DO CALENDÁRIO */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 backdrop-blur-md shadow-xl">
            {/* Dias da Semana */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 pb-3 border-b border-zinc-800/50 mb-2">
              {WEEKDAY_NAMES.map((name) => (
                <div key={name} className="py-1">
                  {name}
                </div>
              ))}
            </div>

            {/* Dias do Mês */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {calendarCells.map(({ isCurrentMonth, dayNumber, payments: dayPayments }, idx) => {
                const hasPayments = dayPayments.length > 0;
                const isSelected = selectedDay === dayNumber && isCurrentMonth;

                // Destacar o dia atual
                const isToday =
                  new Date().getDate() === dayNumber &&
                  new Date().getMonth() === selectedMonth &&
                  new Date().getFullYear() === currentYear &&
                  isCurrentMonth;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (!isCurrentMonth) return;
                      setSelectedDay(selectedDay === dayNumber ? null : dayNumber);
                    }}
                    className={`flex flex-col justify-between rounded-xl border p-2 min-h-[75px] sm:min-h-[95px] transition-all cursor-pointer ${
                      !isCurrentMonth
                        ? "border-zinc-900/40 bg-zinc-950/10 text-zinc-600 opacity-20 cursor-not-allowed"
                        : isSelected
                        ? "border-rose-500 bg-rose-950/10 text-zinc-100"
                        : "border-zinc-800/60 bg-zinc-950/30 hover:border-zinc-700/60 hover:bg-zinc-900/20 text-zinc-300"
                    }`}
                  >
                    {/* Número do Dia */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center justify-center text-xs font-bold w-5 h-5 rounded-full ${
                          isToday
                            ? "bg-rose-600 text-white shadow-lg shadow-rose-600/30"
                            : isSelected
                            ? "text-rose-400"
                            : ""
                        }`}
                      >
                        {dayNumber}
                      </span>
                      {hasPayments && (
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 sm:hidden" />
                      )}
                    </div>

                    {/* Pagamentos no Dia (Apenas Desktop) */}
                    <div className="mt-1 hidden space-y-1 sm:block max-w-full overflow-hidden">
                      {dayPayments.slice(0, 2).map((p) => (
                        <div
                          key={p.id}
                          className={`truncate rounded px-1.5 py-0.5 text-[9px] font-medium border leading-normal ${
                            p.status === "PAID"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}
                        >
                          <div className="truncate font-semibold">{p.vendor.name}</div>
                          <div>{formatCurrency(p.amount)}</div>
                        </div>
                      ))}
                      {dayPayments.length > 2 && (
                        <div className="text-center text-[9px] font-mono text-zinc-500 py-0.5">
                          +{dayPayments.length - 2} outros
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* INDICADORES E DETALHES DOS GASTOS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-md font-bold text-zinc-200 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-rose-500" />
                <span>
                  {selectedDay === null
                    ? `Todos os Gastos de ${MONTH_NAMES[selectedMonth]}`
                    : `Gastos de ${selectedDay} de ${MONTH_NAMES[selectedMonth]}`}
                </span>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                  {detailedPayments.length}
                </span>
              </h3>
              {selectedDay !== null && (
                <button
                  onClick={() => setSelectedDay(null)}
                  className="text-xs text-rose-400 hover:text-rose-300 font-medium"
                >
                  Ver todos do mês
                </button>
              )}
            </div>

            {/* TABELA DE GASTOS DETALHADOS */}
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/20 backdrop-blur-sm shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-400">
                  <thead className="border-b border-zinc-800 bg-zinc-950/40 text-xs uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-6 py-4 font-medium">Vencimento</th>
                      <th className="px-6 py-4 font-medium">Fornecedor</th>
                      <th className="px-6 py-4 font-medium">Valor</th>
                      <th className="px-6 py-4 font-medium">Parcela</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 text-right font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850">
                    {detailedPayments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                          Nenhum gasto registrado para este período.
                        </td>
                      </tr>
                    ) : (
                      detailedPayments.map((payment) => (
                        <tr
                          key={payment.id}
                          className="transition-colors hover:bg-zinc-800/10"
                        >
                          <td className="px-6 py-4 text-zinc-200">
                            {formatDateBR(payment.dueDate)}
                          </td>
                          <td className="px-6 py-4 font-medium text-zinc-300">
                            {payment.vendor.name}
                          </td>
                          <td className="px-6 py-4">
                            <AmountCell payment={payment} />
                          </td>
                          <td className="px-6 py-4 text-xs text-zinc-500">
                            {payment.installmentNumber && payment.totalInstallments
                              ? `${payment.installmentNumber}/${payment.totalInstallments}`
                              : "—"}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-medium inline-flex items-center ${
                                payment.status === "PAID"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              }`}
                            >
                              {payment.status === "PAID" ? "Pago" : "Pendente"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-1">
                              {payment.status === "PENDING" ? (
                                <button
                                  type="button"
                                  onClick={() => onMarkPaid(payment)}
                                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-emerald-400 transition-colors hover:bg-emerald-500/10"
                                  aria-label="Quitar"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span className="text-xs font-semibold">Quitar</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onUndoPaid(payment)}
                                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-amber-400 transition-colors hover:bg-amber-500/10"
                                  aria-label="Estornar"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                  <span className="text-xs font-semibold">Estornar</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onEdit(payment)}
                                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                                aria-label="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDelete(payment)}
                                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                                aria-label="Excluir"
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
          </div>
        </div>
      )}
    </div>
  );
}
