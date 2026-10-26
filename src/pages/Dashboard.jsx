import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
    ArrowDownLeft,
    ArrowUpRight,
    X,
    Package,
    User,
    Calendar,
    ChevronLeft,
    ChevronRight,
    ChevronRight as ChevronRightSm,
    Plus,
    LayoutDashboard,
    Store,
    Coins,
    AlertTriangle,
    Printer,
    FileDown,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "react-router-dom";
import { getProducts } from "../lib/db";
import { buildReceiptHtml, printHtmlDocument, openHtmlDocument } from "../lib/receipt";
import { useToast } from "../hooks/useToast";
import { useCompany } from "../hooks/useCompany";
import { PageHeader, EmptyState, ListSkeleton, StatCard } from "../components/ui";
import { getTransactionsByTypeAndRange } from "../services/dashboardService";

const money = (value) =>
    "$" + Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function useMovements(type, start, end) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const requestId = useRef(0);

    useEffect(() => {
        const currentRequest = ++requestId.current;
        let active = true;

        const fetchData = async () => {
            setLoading(true);
            try {
                const data = await getTransactionsByTypeAndRange(
                    type,
                    startOfDay(start),
                    endOfDay(end)
                );
                if (!active || currentRequest !== requestId.current) return;
                setData(data);
            } catch (err) {
                if (!active || currentRequest !== requestId.current) return;
                console.error(`Error fetching ${type}:`, err);
                setData([]);
            } finally {
                if (active && currentRequest === requestId.current) {
                    setLoading(false);
                }
            }
        };

        fetchData();
        return () => {
            active = false;
        };
    }, [type, start, end]);

    return { data, loading };
}

function rowTotal(tx, products) {
    return (
        tx.items?.reduce((sum, item) => {
            const p = products.find((x) => x.id === item.productId);
            return sum + (Number(p?.cost ?? item.cost ?? 0) * Number(item.quantity));
        }, 0) || 0
    );
}

export default function Dashboard() {
    const [products, setProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [viewingTx, setViewingTx] = useState(null);

    const now = useMemo(() => new Date(), []);
    const [rangeStart, setRangeStart] = useState(() => startOfMonth(new Date()));
    const [rangeEnd, setRangeEnd] = useState(() => endOfMonth(new Date()));

    const { data: entries, loading: loadingEntries } = useMovements("entry", rangeStart, rangeEnd);
    const { data: exits, loading: loadingExits } = useMovements("exit", rangeStart, rangeEnd);

    useEffect(() => {
        const unsub = getProducts((data) => {
            setProducts(data);
            setLoadingProducts(false);
        });
        return () => unsub();
    }, []);

    const balance = useMemo(
        () => products.reduce((acc, p) => acc + Number(p.cost || 0) * Number(p.stock || 0), 0),
        [products]
    );
    const totalItems = useMemo(() => products.reduce((acc, p) => acc + Number(p.stock || 0), 0), [products]);
    const totalEntries = useMemo(() => entries.reduce((a, tx) => a + rowTotal(tx, products), 0), [entries, products]);
    const totalExits = useMemo(() => exits.reduce((a, tx) => a + rowTotal(tx, products), 0), [exits, products]);
    const lowStock = useMemo(() => products.filter((p) => Number(p.stock) <= 10).length, [products]);

    const shiftMonth = (delta) => {
        const base = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + delta, 1);
        if (delta > 0 && (base.getFullYear() > now.getFullYear() ||
            (base.getFullYear() === now.getFullYear() && base.getMonth() > now.getMonth()))) {
            setRangeStart(startOfMonth(now));
            setRangeEnd(endOfMonth(now));
        } else {
            setRangeStart(startOfMonth(base));
            setRangeEnd(endOfMonth(base));
        }
    };

    const loading = loadingProducts || loadingEntries || loadingExits;
    const isCurrentMonth = rangeStart.getMonth() === now.getMonth() && rangeStart.getFullYear() === now.getFullYear();

    return (
        <div>
            <PageHeader
                title="Inicio"
                sub="Movimientos de almacén y valor del inventario"
                icon={LayoutDashboard}
                accent="brand"
                action={
                    <Link to="/stock-adjustments" className="btn-primary !py-2.5">
                        <Plus className="h-5 w-5" />
                        <span className="hidden sm:inline">Nuevo movimiento</span>
                        <span className="sm:hidden">Nuevo</span>
                    </Link>
                }
            />

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <StatCard
                    label="Entradas"
                    value={money(totalEntries)}
                    hint={`${entries.length} movimientos`}
                    icon={ArrowDownLeft}
                    accent="entry"
                    valueTone="text-sky-700"
                />
                <StatCard
                    label="Salidas"
                    value={money(totalExits)}
                    hint={`${exits.length} movimientos`}
                    icon={ArrowUpRight}
                    accent="exit"
                    valueTone="text-amber-800"
                />
                <StatCard
                    label="Inventario"
                    value={money(balance)}
                    hint={`${products.length} productos · ${totalItems} uds`}
                    icon={Coins}
                    accent="emerald"
                    valueTone="text-emerald-800"
                />
                <Link to="/inventory" className="block">
                    <StatCard
                        label="Stock bajo"
                        value={lowStock}
                        hint="Ver inventario →"
                        icon={AlertTriangle}
                        accent="brand"
                        valueTone={lowStock > 0 ? "text-rose-700" : "text-ink"}
                    />
                </Link>
            </div>

            {/* Selector de periodo */}
            <div className="card !p-2 mb-4 flex items-center gap-1.5">
                <button onClick={() => shiftMonth(-1)} aria-label="Mes anterior"
                    className="h-11 w-11 flex items-center justify-center rounded-xl hover:bg-paper text-ink-2 transition-colors">
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                    onClick={() => { setRangeStart(startOfMonth(now)); setRangeEnd(endOfMonth(now)); }}
                    className={`flex-1 flex items-center justify-center gap-2 min-h-[44px] px-3 rounded-xl font-bold text-sm capitalize transition-colors
                        ${isCurrentMonth ? "bg-brand-50 text-brand-700" : "bg-paper text-ink-2 hover:bg-paper-deep"}`}>
                    <Calendar className="h-4 w-4" />
                    {format(rangeStart, "MMMM yyyy", { locale: es })}
                    {isCurrentMonth && <span className="badge bg-white text-brand-700 ring-1 ring-brand-200">Actual</span>}
                </button>
                <button onClick={() => shiftMonth(1)} aria-label="Mes siguiente"
                    className="h-11 w-11 flex items-center justify-center rounded-xl hover:bg-paper text-ink-2 transition-colors">
                    <ChevronRight className="h-5 w-5" />
                </button>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <ListSkeleton rows={4} />
                    <ListSkeleton rows={4} />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <MovementCard title="Entradas" kind="entry" data={entries} total={totalEntries}
                        products={products} onView={setViewingTx} />
                    <MovementCard title="Salidas" kind="exit" data={exits} total={totalExits}
                        products={products} onView={setViewingTx} />
                </div>
            )}

            {/* Detalle del movimiento */}
            {viewingTx && (
                <TxDetailModal tx={viewingTx} products={products} onClose={() => setViewingTx(null)} />
            )}
        </div>
    );
}

function MovementCard({ title, kind, data, total, products, onView }) {
    const isEntry = kind === "entry";
    const Icon = isEntry ? ArrowDownLeft : ArrowUpRight;
    // Banda de color superior por tipo: misma leyenda visual que los KPIs.
    const band = isEntry ? "bg-sky-600" : "bg-amber-600";
    return (
        <section className="card !p-0 overflow-hidden relative">
            <span className={`absolute inset-x-0 top-0 h-1 ${band}`} aria-hidden="true" />
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-5 pb-3">
                <div className="flex items-center gap-3 min-w-0">
                    <span className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0
                        ${isEntry ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-800"}`}>
                        <Icon className="h-5 w-5" strokeWidth={2.4} />
                    </span>
                    <div className="min-w-0">
                        <h2 className="section-title">{title}</h2>
                        <p className="text-xs font-semibold text-ink-3">{data.length} en el periodo</p>
                    </div>
                </div>
                <p className={`text-lg font-extrabold tnum whitespace-nowrap ${isEntry ? "text-sky-700" : "text-amber-800"}`}>
                    {money(total)}
                </p>
            </div>
            {data.length === 0 ? (
                <div className="px-4 sm:px-5 pb-5">
                    <EmptyState accent={kind} icon={Package}
                        title={`Sin ${title.toLowerCase()} en este periodo`}
                        hint="Crea un movimiento desde «Nuevo movimiento»." />
                </div>
            ) : (
                <ul className="divide-y divide-line max-h-[380px] overflow-y-auto">
                    {data.map((tx) => (
                        <li key={tx.id}>
                            <button onClick={() => onView(tx)}
                                className="group w-full text-left px-4 sm:px-5 py-3.5 hover:bg-brand-50/40 flex items-center gap-3 transition-colors">
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-ink truncate text-sm">
                                        {tx.reference ? `Folio ${tx.reference}` : "Sin referencia"}
                                    </p>
                                    <p className="text-xs text-ink-3 truncate">
                                        {tx.timestamp?.toDate ? format(tx.timestamp.toDate(), "dd/MM/yyyy") : "--"}
                                        {" · "}
                                        <Store className="inline h-3 w-3 -mt-0.5" /> {tx.sucursal || "Principal"}
                                    </p>
                                </div>
                                <span className="font-extrabold text-sm text-ink tnum whitespace-nowrap">
                                    {money(rowTotal(tx, products))}
                                </span>
                                <ChevronRightSm className="h-4 w-4 text-ink-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

function TxDetailModal({ tx, products, onClose }) {
    const isEntry = tx.type === "entry";
    const { addToast } = useToast();
    const company = useCompany();

    // El comprobante se arma bajo demanda: el modal abre al instante y generar
    // el documento A4 (que mide y pagina) solo cuesta cuando se pide.
    const receiptHtml = () => buildReceiptHtml(tx, company);

    const handlePrint = () => {
        if (!printHtmlDocument(receiptHtml())) {
            addToast("Permite las ventanas emergentes para imprimir", "error");
        }
    };

    const handlePdf = () => {
        if (!openHtmlDocument(receiptHtml())) {
            addToast("Permite las ventanas emergentes para descargar el PDF", "error");
            return;
        }
        addToast("Selecciona «Guardar como PDF» en el visor de impresión");
    };

    // El panel se monta en <body>: dentro de <main> hereda contenedores con
    // `transform`/`overflow` que pueden dejarlo detras del fondo oscuro.
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", onKey);
        const { body } = document;
        const prevOverflow = body.style.overflow;
        body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 isolate" role="dialog" aria-modal="true">
            <div className="absolute inset-0 z-0 bg-ink/60 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden="true" />
            <div className="modal relative z-10 sm:max-w-2xl w-full">
                <div className="drag-handle"><span /></div>
                <div className="sticky top-0 bg-white/95 backdrop-blur px-4 sm:px-6 py-3.5 border-b border-line flex items-center justify-between z-10 rounded-t-3xl sm:rounded-t-2xl">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0
                            ${isEntry ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-800"}`}>
                            {isEntry ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                        </span>
                        <div className="min-w-0">
                            <h2 className="font-extrabold text-ink truncate">
                                {isEntry ? "Entrada" : "Salida"} · {tx.reference || "s/ref"}
                            </h2>
                            <p className="text-xs font-semibold text-ink-3">
                                {tx.timestamp?.toDate ? format(tx.timestamp.toDate(), "dd/MM/yyyy HH:mm") : "--"}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Cerrar" className="btn-icon flex-shrink-0">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="p-4 sm:p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-paper border border-line p-3">
                            <p className="eyebrow flex items-center gap-1"><User className="h-3.5 w-3.5" /> Usuario</p>
                            <p className="text-sm font-bold text-ink truncate mt-1">
                                {tx.createdBy || tx.userId || "—"}
                            </p>
                        </div>
                        <div className="rounded-xl bg-paper border border-line p-3">
                            <p className="eyebrow flex items-center gap-1"><Store className="h-3.5 w-3.5" /> Sucursal</p>
                            <p className="text-sm font-bold text-ink truncate mt-1">{tx.sucursal || "Principal"}</p>
                        </div>
                    </div>
                    <div className="rounded-xl border border-line overflow-hidden">
                        <div className="table-wrap">
                            <table className="table">
                                <thead><tr><th>Producto</th><th className="!text-center">Cant.</th><th className="!text-right">Costo</th><th className="!text-right">Subtotal</th></tr></thead>
                                <tbody>
                                    {tx.items?.map((item, i) => {
                                        const p = products.find((x) => x.id === item.productId);
                                        const cost = Number(p?.cost ?? item.cost ?? 0);
                                        return (
                                            <tr key={i}>
                                                <td className="font-bold !text-ink">{item.name}</td>
                                                <td className="!text-center font-bold text-brand-700 tnum">×{item.quantity}</td>
                                                <td className="!text-right tnum">{money(cost)}</td>
                                                <td className="!text-right font-extrabold !text-ink tnum">{money(cost * Number(item.quantity))}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    {tx.notes && (
                        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5">
                            <p className="eyebrow text-amber-800 mb-1">Notas</p>
                            <p className="text-sm text-ink-2">{tx.notes}</p>
                        </div>
                    )}
                    <div className="flex justify-between items-end pt-3 border-t border-line">
                        <span className="eyebrow">Total</span>
                        <span className="text-2xl font-extrabold text-ink tnum">{money(rowTotal(tx, products))}</span>
                    </div>

                    {/* Acciones: mismo comprobante A4 que usa el Historial. */}
                    <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
                        <button type="button" onClick={onClose} className="btn-ghost flex-1">
                            <X className="h-4 w-4" /> Cerrar
                        </button>
                        <button type="button" onClick={handlePdf} className="btn-soft flex-1">
                            <FileDown className="h-4 w-4" /> Descargar PDF
                        </button>
                        <button type="button" onClick={handlePrint} className="btn-primary flex-1">
                            <Printer className="h-4 w-4" /> Imprimir
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
