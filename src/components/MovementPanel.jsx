import { useState } from "react";
import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency } from "../lib/formatters";

function DateRangeModal({ startDate, endDate, onClose, onSelect }) {
    const [startValue, setStartValue] = useState(format(startDate, "yyyy-MM-dd"));
    const [endValue, setEndValue] = useState(format(endDate, "yyyy-MM-dd"));
    const hasInvalidRange = startValue > endValue;

    const applyRange = () => {
        if (hasInvalidRange) return;
        onSelect(parseISO(startValue), parseISO(endValue));
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex animate-fade-in items-center justify-center bg-scrim/60 p-4"
            onClick={onClose}
        >
            <div
                className="modal-panel w-full max-w-md animate-scale-in p-6"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="movement-date-title"
            >
                <div className="mb-6 flex items-center justify-between">
                    <h3 id="movement-date-title" className="section-title">Elegir fechas</h3>
                    <button onClick={onClose} className="btn-icon h-10 w-10 rounded-xl" aria-label="Cerrar">
                        <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="movement-start" className="input-label">Desde</label>
                        <input
                            id="movement-start"
                            type="date"
                            value={startValue}
                            onChange={(event) => setStartValue(event.target.value)}
                            className="input-field"
                        />
                    </div>
                    <div>
                        <label htmlFor="movement-end" className="input-label">Hasta</label>
                        <input
                            id="movement-end"
                            type="date"
                            value={endValue}
                            onChange={(event) => setEndValue(event.target.value)}
                            className="input-field"
                        />
                    </div>
                    {hasInvalidRange && (
                        <p className="text-sm text-danger-700" role="alert">
                            La fecha inicial debe ser anterior a la fecha final.
                        </p>
                    )}
                </div>

                <div className="mt-6 flex gap-3">
                    <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
                    <button onClick={applyRange} className="btn-primary flex-1" disabled={hasInvalidRange}>
                        Aplicar
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function MovementPanel({
    title,
    type,
    transactions,
    total,
    startDate,
    endDate,
    loading,
    productsById,
    onPrevious,
    onNext,
    onReset,
    onDateSelect,
    onViewTransaction,
    icon: PanelIcon,
}) {
    const [showDatePicker, setShowDatePicker] = useState(false);
    const isEntry = type === "entry";

    return (
        <>
            <section className="surface flex flex-col overflow-hidden">
                <div className="card-header">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className={`stat-icon ${isEntry ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700"}`}>
                            <PanelIcon className="h-[18px] w-[18px]" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="section-title">{title}</h2>
                            <p className="mt-0.5 text-xs capitalize text-ink-500">
                                {format(startDate, "MMMM yyyy", { locale: es })}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 border-b border-ink-200/70 bg-ink-50/60 px-4 py-3 sm:px-5">
                    <button onClick={onPrevious} className="btn-icon h-10 w-10 rounded-xl" title="Periodo anterior" aria-label="Periodo anterior">
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => setShowDatePicker(true)}
                        className="chip min-h-10 flex-1 justify-center gap-2 tabular-nums"
                        aria-label="Cambiar rango de fechas"
                    >
                        <Calendar className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
                        {format(startDate, "dd/MM/yy")} — {format(endDate, "dd/MM/yy")}
                    </button>
                    <button onClick={onNext} className="btn-icon h-10 w-10 rounded-xl" title="Periodo siguiente" aria-label="Periodo siguiente">
                        <ChevronRight className="h-4 w-4" />
                    </button>
                    <button onClick={onReset} className="chip min-h-10 font-semibold text-primary-700 hover:border-primary-300 hover:bg-primary-50" title="Ver mes actual">
                        Este mes
                    </button>
                </div>

                <div className="flex-1 overflow-hidden">
                    <div className="table-scroll max-h-[380px] overflow-y-auto custom-scrollbar">
                        <table className="min-w-full">
                            <thead className="table-head sticky top-0 z-10">
                                <tr>
                                    <th>Fecha</th>
                                    <th>Referencia</th>
                                    <th>Sucursal</th>
                                    <th className="text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="table-body">
                                {loading ? (
                                    <tr>
                                        <td colSpan="4" className="px-4 py-12 text-center">
                                            <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-ink-300 border-t-primary-600" />
                                            <p className="mt-3 text-xs text-ink-500">Cargando movimientos...</p>
                                        </td>
                                    </tr>
                                ) : transactions.length ? (
                                    transactions.map((transaction) => {
                                        const rowTotal = transaction.items?.reduce((sum, item) => {
                                            const product = productsById.get(item.productId);
                                            const cost = Number(product?.cost ?? item.cost ?? 0);
                                            return sum + cost * Number(item.quantity || 0);
                                        }, 0) || 0;

                                        return (
                                            <tr
                                                key={transaction.id}
                                                className="cursor-pointer"
                                                onClick={() => onViewTransaction(transaction)}
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter" || event.key === " ") {
                                                        event.preventDefault();
                                                        onViewTransaction(transaction);
                                                    }
                                                }}
                                                tabIndex={0}
                                                role="button"
                                                aria-label={`Ver movimiento ${transaction.reference || "sin referencia"}`}
                                            >
                                                <td className="whitespace-nowrap tabular-nums">
                                                    {transaction.timestamp?.toDate
                                                        ? format(transaction.timestamp.toDate(), "dd/MM/yyyy")
                                                        : "—"}
                                                </td>
                                                <td className="font-medium text-ink-900">{transaction.reference || "Sin referencia"}</td>
                                                <td className="text-ink-500">{transaction.sucursal || "Principal"}</td>
                                                <td className="text-right font-semibold tabular-nums">
                                                    <span className={isEntry ? "text-success-700" : "text-warning-700"}>
                                                        {formatCurrency(rowTotal)}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="4">
                                            <div className="empty-state">
                                                <div className={`empty-icon ${isEntry ? "bg-success-50 text-success-600" : "bg-warning-50 text-warning-700"}`}>
                                                    <PanelIcon className="h-6 w-6" aria-hidden="true" />
                                                </div>
                                                <p className="text-sm font-semibold text-ink-800">No hay movimientos</p>
                                                <p className="mt-1 text-xs text-ink-500">Prueba con otro rango de fechas.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex items-center justify-between border-t border-ink-200/70 bg-ink-50/60 px-5 py-4">
                    <div>
                        <p className="section-label">Total {title.toLowerCase()}</p>
                        <p className="mt-0.5 text-xs text-ink-500">
                            {transactions.length} {transactions.length === 1 ? "movimiento" : "movimientos"}
                        </p>
                    </div>
                    <span className={`text-xl font-bold tabular-nums ${isEntry ? "text-success-700" : "text-warning-700"}`}>
                        {formatCurrency(total)}
                    </span>
                </div>
            </section>

            {showDatePicker && (
                <DateRangeModal
                    startDate={startDate}
                    endDate={endDate}
                    onClose={() => setShowDatePicker(false)}
                    onSelect={onDateSelect}
                />
            )}
        </>
    );
}
