import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth } from "date-fns";
import { Search, FileDown, BarChart3, Package, Eye, Printer } from "lucide-react";
import { getProducts } from "../lib/db";
import { getSucursal, buildReceiptHtml, printHtmlDocument, openHtmlDocument } from "../lib/receipt";
import { useToast } from "../hooks/useToast";
import { useCompany } from "../hooks/useCompany";
import { PageHeader, EmptyState, Sheet } from "../components/ui";
import { TypeBadge } from "../components/ui";
import { typeLabel } from "../components/TypeBadge";
import { getReportTransactions, getOpeningStock, REPORT_ROW_LIMIT } from "../services/reportService";

export default function Reports() {
    const [transactions, setTransactions] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [truncated, setTruncated] = useState(false);
    const [viewingTransaction, setViewingTransaction] = useState(null);
    const [openingStock, setOpeningStock] = useState(0);
    const { addToast } = useToast();
    const company = useCompany();

    /**
     * Imprimir / Descargar PDF de un movimiento concreto. Se usa el mismo
     * comprobante A4 que genera Historial, para que el papel sea idéntico
     * venga de donde venga.
     */
    const handlePrintReceipt = (tx) => {
        if (!printHtmlDocument(buildReceiptHtml(tx, company))) {
            addToast("Permite las ventanas emergentes para imprimir", "error");
        }
    };
    const handleDownloadPdf = (tx) => {
        if (!openHtmlDocument(buildReceiptHtml(tx, company))) {
            addToast("Permite las ventanas emergentes para descargar el PDF", "error");
            return;
        }
        addToast("Selecciona «Guardar como PDF» en el visor de impresión");
    };

    const [reportType, setReportType] = useState("movements");
    const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
    const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
    const [selectedProduct, setSelectedProduct] = useState("all");
    const [selectedSucursal, setSelectedSucursal] = useState("all");
    const [selectedReason, setSelectedReason] = useState("all");
    const [selectedType, setSelectedType] = useState("all");
    const [filtersOpen, setFiltersOpen] = useState(true);

    useEffect(() => {
        const unsub = getProducts((data) => setProducts(data));
        return () => unsub();
    }, []);

    const sucursales = useMemo(() => {
        const set = new Set();
        transactions.forEach((tx) => {
            const s = tx.sucursal || getSucursal(tx);
            if (s) set.add(s);
        });
        return Array.from(set).sort();
    }, [transactions]);

    /** Motivos presentes en los datos, para el filtro. */
    const reasons = useMemo(() => {
        const set = new Set();
        transactions.forEach((tx) => {
            const r = String(tx.reason || "").trim();
            if (r) set.add(r);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [transactions]);

    // Saldo del producto antes del rango: el cardex necesita saldo inicial real.
    useEffect(() => {
        let active = true;
        if (reportType !== "cardex" || selectedProduct === "all" || !dateFrom) {
            setOpeningStock(0);
            return undefined;
        }
        getOpeningStock(selectedProduct, dateFrom)
            .then((saldo) => { if (active) setOpeningStock(saldo); })
            .catch((error) => {
                console.error("Error calculando saldo inicial:", error);
                if (active) setOpeningStock(0);
            });
        return () => { active = false; };
    }, [reportType, selectedProduct, dateFrom]);

    const fetchTransactions = async () => {
        if (!dateFrom || !dateTo) {
            addToast("Selecciona la fecha inicial y la fecha final.", "error");
            return;
        }
        if (dateFrom > dateTo) {
            addToast("La fecha inicial no puede ser posterior a la final.", "error");
            return;
        }

        setLoading(true);
        try {
            const result = await getReportTransactions({ dateFrom, dateTo });
            setTransactions(result.transactions);
            setTruncated(result.truncated);
            setSearched(true);
            addToast(
                result.truncated
                    ? `Se muestran las primeras ${result.limit} transacciones. Reduce el rango para ver el resto.`
                    : `Se encontraron ${result.transactions.length} transacciones`
            );
        } catch (error) {
            addToast("Error al buscar: " + error.message, "error");
        } finally {
            setLoading(false);
        }
    };
    const filteredTransactions = useMemo(() => {
        return transactions.filter((tx) => {
            if (selectedType !== "all" && tx.type !== selectedType) return false;
            if (selectedReason !== "all" && (tx.reason || "") !== selectedReason) return false;
            if (selectedSucursal !== "all") {
                const s = tx.sucursal || getSucursal(tx);
                if (s !== selectedSucursal) return false;
            }
            if (selectedProduct !== "all" && !tx.items?.some((i) => i.productId === selectedProduct)) return false;
            return true;
        });
    }, [transactions, selectedType, selectedSucursal, selectedReason, selectedProduct]);

    const unitValue = (tx, item) => (
        tx.type === "entry" || tx.type === "exit"
            ? Number(item.cost || 0)
            : Number(item.price || 0)
    );

    const totals = useMemo(() => {
        let entradas = 0;
        let salidas = 0;
        filteredTransactions.forEach((tx) => {
            const t = tx.items?.reduce((a, i) => a + unitValue(tx, i) * Number(i.quantity), 0) || 0;
            if (tx.type === "entry") entradas += t;
            else if (tx.type === "exit") salidas += t;
        });
        const list = selectedProduct === "all" ? products : products.filter((p) => p.id === selectedProduct);
        const inventoryValue = list.reduce((a, p) => a + Number(p.cost || 0) * Number(p.stock || 0), 0);
        return { entradas, salidas, inventoryValue };
    }, [filteredTransactions, products, selectedProduct]);

    const sucursalData = useMemo(() => {
        const summary = {};
        filteredTransactions.forEach((tx) => {
            const s = tx.sucursal || getSucursal(tx) || "Sin sucursal";
            if (!summary[s]) summary[s] = { sucursal: s, entradasU: 0, entradasM: 0, salidasU: 0, salidasM: 0 };
            tx.items?.forEach((item) => {
                // Igual que el historial: cada movimiento conserva su valor original.
                const value = unitValue(tx, item);
                const qty = Number(item.quantity || 0);
                if (tx.type === "entry") { summary[s].entradasU += qty; summary[s].entradasM += value * qty; }
                else if (tx.type === "exit" || tx.type === "sale") { summary[s].salidasU += qty; summary[s].salidasM += value * qty; }
            });
        });
        return Object.values(summary).sort((a, b) => a.sucursal.localeCompare(b.sucursal));
    }, [filteredTransactions]);

    const cardexData = useMemo(() => {
        if (reportType !== "cardex" || selectedProduct === "all") return [];
        const sorted = [...filteredTransactions].sort((a, b) => {
            const da = a.timestamp?.toDate?.() || new Date(0);
            const db = b.timestamp?.toDate?.() || new Date(0);
            return da - db;
        });
        let saldo = Number(openingStock) || 0;
        const rows = [];
        sorted.forEach((tx) => {
            const item = tx.items?.find((i) => i.productId === selectedProduct);
            if (!item) return;
            const qty = Number(item.quantity);
            let entrada = 0;
            let salida = 0;
            if (tx.type === "entry") { entrada = qty; saldo += qty; }
            else { salida = qty; saldo -= qty; }
            rows.push({
                fecha: tx.timestamp?.toDate ? format(tx.timestamp.toDate(), "dd/MM/yyyy") : "",
                tipo: typeLabel(tx.type),
                referencia: tx.reference || "",
                sucursal: tx.sucursal || getSucursal(tx) || "",
                entrada, salida, saldo,
            });
        });
        return rows;
    }, [reportType, selectedProduct, filteredTransactions, openingStock]);

    const exportToExcel = async () => {
        let rows;
        let file;
        const product = products.find((p) => p.id === selectedProduct);
        if (reportType === "cardex" && selectedProduct !== "all") {
            rows = cardexData.map((r) => ({
                Fecha: r.fecha, Producto: `${product?.sku || "SIN-SKU"} - ${product?.name || ""}`,
                Tipo: r.tipo, Referencia: r.referencia, Sucursal: r.sucursal,
                Entrada: r.entrada || "", Salida: r.salida || "", Saldo: r.saldo,
            }));
            file = `cardex_${product?.sku || "prod"}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
        } else if (reportType === "sucursal") {
            rows = sucursalData.map((r) => ({
                Sucursal: r.sucursal, "Entradas (Uds)": r.entradasU, "Entradas ($)": r.entradasM,
                "Salidas (Uds)": r.salidasU, "Salidas ($)": r.salidasM,
                "Diferencia ($)": r.entradasM - r.salidasM,
            }));
            file = `reporte_por_sucursal_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
        } else {
            rows = filteredTransactions.map((tx) => ({
                Fecha: tx.timestamp?.toDate ? format(tx.timestamp.toDate(), "dd/MM/yyyy") : "",
                Tipo: typeLabel(tx.type), Referencia: tx.reference || "",
                Motivo: tx.reason || "",
                Sucursal: tx.sucursal || getSucursal(tx) || "",
                Productos: `${tx.items?.length || 0} producto(s)`,
                Total: tx.items?.reduce((a, i) => a + unitValue(tx, i) * Number(i.quantity), 0) || 0,
            }));
            file = `reporte_movimientos_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
        }
        const { utils, writeFile } = await import("xlsx");
        const ws = utils.json_to_sheet(rows);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Reporte");
        writeFile(wb, file);
        addToast(`Archivo exportado: ${file}`);
    };

    return (
        <div>
            <PageHeader title="Reportes" sub="Consulta y exporta movimientos" icon={BarChart3} accent="sky" />

            <div className="flex gap-1.5 mb-3 overflow-x-auto" role="tablist" aria-label="Tipo de reporte">
                {[["movements", "Movimientos"], ["cardex", "Cardex"], ["sucursal", "Por sucursal"]].map(([v, l]) => (
                    <button key={v} onClick={() => setReportType(v)}
                        className={`flex-1 sm:flex-none min-h-[44px] px-4 rounded-xl text-sm font-extrabold whitespace-nowrap transition-all border-2 ${reportType === v ? "bg-sky-700 text-white border-sky-700" : "bg-white text-ink-2 border-line-strong hover:border-sky-600 hover:text-brand-700"}`}>
                        {l}
                    </button>
                ))}
            </div>

            <div className="card !p-4 mb-3">
                <button onClick={() => setFiltersOpen(!filtersOpen)}
                    className="flex items-center justify-between w-full min-h-[44px] font-extrabold text-ink">
                    <span>Filtros</span>
                    <span className={`transition-transform ${filtersOpen ? "rotate-180" : ""}`}>▾</span>
                </button>
                {filtersOpen && (
                    <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="label" htmlFor="rep-from">Desde</label>
                                <input id="rep-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input" />
                            </div>
                            <div>
                                <label className="label" htmlFor="rep-to">Hasta</label>
                                <input id="rep-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                                <label className="label" htmlFor="rep-prod">Producto</label>
                                <select id="rep-prod" value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="select">
                                    <option value="all">Todos</option>
                                    {products.map((p) => (
                                        <option key={p.id} value={p.id}>{p.sku ? `${p.sku} - ` : ""}{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="label" htmlFor="rep-type">Tipo</label>
                                <select id="rep-type" value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="select">
                                    <option value="all">Todos</option>
                                    <option value="entry">Entradas</option>
                                    <option value="exit">Salidas</option>
                                    <option value="sale">Ventas</option>
                                </select>
                            </div>
                            {reasons.length > 0 && (
                                <div>
                                    <label className="label" htmlFor="rep-reason">Motivo</label>
                                    <select id="rep-reason" value={selectedReason} onChange={(e) => setSelectedReason(e.target.value)} className="select">
                                        <option value="all">Todos</option>
                                        {reasons.map((r) => (<option key={r} value={r}>{r}</option>))}
                                    </select>
                                </div>
                            )}
                            {sucursales.length > 0 && (
                                <div>
                                    <label className="label" htmlFor="rep-suc">Sucursal</label>
                                    <select id="rep-suc" value={selectedSucursal} onChange={(e) => setSelectedSucursal(e.target.value)} className="select">
                                        <option value="all">Todas</option>
                                        {sucursales.map((s) => (<option key={s} value={s}>{s}</option>))}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2.5">
                            <button onClick={fetchTransactions} disabled={loading} className="btn-primary flex-1">
                                <Search className="h-5 w-5" />{loading ? "Buscando..." : "Generar reporte"}
                            </button>
                            {filteredTransactions.length > 0 && (
                                <button onClick={exportToExcel} className="btn-success flex-1">
                                    <FileDown className="h-5 w-5" />Exportar
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {truncated && (
                <div className="card !p-4 mb-3 !border-amber-300 !bg-amber-50">
                    <p className="text-sm font-bold text-amber-800">
                        Se muestran las primeras {REPORT_ROW_LIMIT} transacciones. Reduce el rango de fechas para consultar el resto.
                    </p>
                </div>
            )}
            {reportType === "cardex" && selectedProduct === "all" && searched && (
                <div className="card !p-4 mb-3 !border-amber-300 !bg-amber-50">
                    <p className="text-sm font-bold text-amber-800">⚠️ Para ver el cardex, elige un producto en los filtros.</p>
                </div>
            )}

            {!searched && !loading && (
                <EmptyState icon={BarChart3} accent="sky" title="Sin resultados todavía"
                    hint="Elige un rango de fechas y presiona “Generar reporte”." />
            )}

            {searched && filteredTransactions.length === 0 && !loading && (
                <EmptyState icon={Package} accent="sky" title="Sin movimientos" hint="No hay registros con esos filtros." />
            )}

            {filteredTransactions.length > 0 && reportType === "movements" && (
                <div className="card !p-0 overflow-hidden">
                    <div className="table-wrap">
                        <table className="table">
                            <thead><tr><th>Fecha</th><th>Tipo</th><th>Referencia</th><th>Motivo</th><th>Sucursal</th><th className="!text-right">Total</th><th /></tr></thead>
                            <tbody>
                                {filteredTransactions.map((tx) => (
                                    <tr key={tx.id}>
                                        <td className="whitespace-nowrap text-ink-3">{tx.timestamp?.toDate ? format(tx.timestamp.toDate(), "dd/MM/yyyy") : "--"}</td>
                                        <td><TypeBadge type={tx.type} /></td>
                                        <td className="font-bold text-brand-700">{tx.reference || "--"}</td>
                                        <td className="text-ink-2">{tx.reason || "—"}</td>
                                        <td className="text-ink-3">{tx.sucursal || getSucursal(tx) || "--"}</td>
                                        <td className="!text-right font-black !text-ink">
                                            ${(tx.items?.reduce((a, i) => a + unitValue(tx, i) * Number(i.quantity), 0) || 0).toFixed(2)}
                                        </td>
                                        <td className="!text-right">
                                            <button onClick={() => setViewingTransaction(tx)} aria-label="Ver detalle"
                                                className="p-2 text-brand-700 hover:bg-brand-50 rounded-xl"><Eye className="h-5 w-5" /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 px-4 py-3.5 border-t border-line bg-paper">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-line px-3 py-1 text-xs font-bold text-ink-2">
                            Entradas <b className="text-sky-700 tnum">${totals.entradas.toFixed(2)}</b>
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-line px-3 py-1 text-xs font-bold text-ink-2">
                            Salidas <b className="text-amber-800 tnum">${totals.salidas.toFixed(2)}</b>
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-line px-3 py-1 text-xs font-bold text-ink-2">
                            Inventario <b className="text-emerald-800 tnum">${totals.inventoryValue.toFixed(2)}</b>
                        </span>
                    </div>
                </div>
            )}

            {filteredTransactions.length > 0 && reportType === "cardex" && selectedProduct !== "all" && (
                <div className="card !p-0 overflow-hidden">
                    <div className="px-4 py-3 border-b border-line bg-paper">
                        <h3 className="font-extrabold text-ink">Cardex: {products.find((p) => p.id === selectedProduct)?.name}</h3>
                        <p className="text-xs font-semibold text-ink-3 mt-0.5">
                            Saldo inicial: <b className="text-ink tnum">{openingStock}</b>
                        </p>
                    </div>
                    <div className="table-wrap">
                        <table className="table">
                            <thead><tr><th>Fecha</th><th>Tipo</th><th>Ref.</th><th className="!text-right">Entrada</th><th className="!text-right">Salida</th><th className="!text-right">Saldo</th></tr></thead>
                            <tbody>
                                {cardexData.map((r, i) => (
                                    <tr key={i}>
                                        <td className="whitespace-nowrap">{r.fecha}</td>
                                        <td className="text-ink-3">{r.tipo}</td>
                                        <td className="font-bold text-brand-700">{r.referencia || "--"}</td>
                                        <td className="!text-right font-bold text-emerald-700">{r.entrada > 0 ? `+${r.entrada}` : ""}</td>
                                        <td className="!text-right font-bold text-rose-700">{r.salida > 0 ? `−${r.salida}` : ""}</td>
                                        <td className="!text-right font-black !text-ink">{r.saldo}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {cardexData.length > 0 && (
                        <div className="px-4 py-3.5 border-t border-line text-right text-sm text-ink-3">
                            Saldo final <b className="text-lg text-ink ml-1">{cardexData[cardexData.length - 1].saldo}</b>
                        </div>
                    )}
                </div>
            )}

            {filteredTransactions.length > 0 && reportType === "sucursal" && (
                <div className="card !p-0 overflow-hidden">
                    <div className="table-wrap">
                        <table className="table">
                            <thead><tr><th>Sucursal</th><th className="!text-right">Ent. uds</th><th className="!text-right">Ent. $</th><th className="!text-right">Sal. uds</th><th className="!text-right">Sal. $</th><th className="!text-right">Dif.</th></tr></thead>
                            <tbody>
                                {sucursalData.map((r, i) => (
                                    <tr key={i}>
                                        <td className="font-bold !text-ink">{r.sucursal}</td>
                                        <td className="!text-right text-brand-700 font-bold">+{r.entradasU}</td>
                                        <td className="!text-right">${r.entradasM.toFixed(2)}</td>
                                        <td className="!text-right text-rose-700 font-bold">−{r.salidasU}</td>
                                        <td className="!text-right">${r.salidasM.toFixed(2)}</td>
                                        <td className={`!text-right font-black ${(r.entradasM - r.salidasM) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                            ${(r.entradasM - r.salidasM).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <Sheet open={!!viewingTransaction} onClose={() => setViewingTransaction(null)}
                title={viewingTransaction ? `${typeLabel(viewingTransaction.type)} · ${viewingTransaction.reference || "s/ref"}` : ""} wide>
                {viewingTransaction && (
                    <div className="space-y-3">
                        <div className="table-wrap border border-line rounded-xl">
                            <table className="table">
                                <thead><tr><th>Producto</th><th className="!text-center">Cant.</th><th className="!text-right">Unit.</th><th className="!text-right">Subtotal</th></tr></thead>
                                <tbody>
                                    {viewingTransaction.items?.map((item, i) => {
                                        const unit = unitValue(viewingTransaction, item);
                                        return (
                                            <tr key={i}>
                                                <td className="font-bold !text-ink">{item.name}</td>
                                                <td className="!text-center">×{item.quantity}</td>
                                                <td className="!text-right">${unit.toFixed(2)}</td>
                                                <td className="!text-right font-bold !text-ink">${(unit * Number(item.quantity)).toFixed(2)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {viewingTransaction.notes && (
                            <div className="rounded-xl bg-paper p-3.5 text-sm text-ink-2">{viewingTransaction.notes}</div>
                        )}
                        {(viewingTransaction.reason || viewingTransaction.party) && (
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                {viewingTransaction.reason && (
                                    <div className="rounded-xl bg-paper p-3">
                                        <span className="block text-[10px] font-bold uppercase tracking-wide text-ink-3">Motivo</span>
                                        <span className="font-bold text-ink">{viewingTransaction.reason}</span>
                                    </div>
                                )}
                                {viewingTransaction.party && (
                                    <div className="rounded-xl bg-paper p-3">
                                        <span className="block text-[10px] font-bold uppercase tracking-wide text-ink-3">
                                            {viewingTransaction.type === "entry" ? "Proveedor" : "Destino"}
                                        </span>
                                        <span className="font-bold text-ink">{viewingTransaction.party}</span>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex flex-col-reverse sm:flex-row gap-2.5">
                            <button onClick={() => setViewingTransaction(null)} className="btn-ghost flex-1">Cerrar</button>
                            <button onClick={() => handleDownloadPdf(viewingTransaction)} className="btn-soft flex-1">
                                <FileDown className="h-5 w-5" /> Descargar PDF
                            </button>
                            <button onClick={() => handlePrintReceipt(viewingTransaction)} className="btn-primary flex-1">
                                <Printer className="h-5 w-5" /> Imprimir
                            </button>
                        </div>
                    </div>
                )}
            </Sheet>
        </div>
    );
}
