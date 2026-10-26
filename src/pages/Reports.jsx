import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { Search, FileDown, Filter, BarChart3, Package, Eye, X } from "lucide-react";
import { getProducts } from "../services/productService";
import { getReportTransactions } from "../services/reportService";
import { formatCurrency } from "../lib/formatters";
import { useToast } from "../context/ToastContext";
import * as XLSX from "xlsx";

export default function Reports() {
    const [transactions, setTransactions] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewingTransaction, setViewingTransaction] = useState(null);
    const { addToast } = useToast();

    // Filters
    const [reportType, setReportType] = useState("movements");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [selectedProduct, setSelectedProduct] = useState("all");
    const [selectedSucursal, setSelectedSucursal] = useState("all");
    const [selectedType, setSelectedType] = useState("all");

    useEffect(() => {
        const unsubscribe = getProducts((data) => setProducts(data));
        return () => unsubscribe();
    }, []);

    const sucursales = useMemo(() => {
        const set = new Set();
        transactions.forEach(tx => {
            const match = tx.notes?.match(/Sucursal:\s*([^|]+)/i);
            if (match) set.add(match[1].trim());
        });
        return Array.from(set).sort();
    }, [transactions]);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const data = await getReportTransactions({ dateFrom, dateTo });
            setTransactions(data);
            addToast(`Se encontraron ${data.length} transacciones`);
        } catch (error) {
            addToast("Error al buscar: " + error.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const getSucursal = (notes) => {
        if (!notes) return null;
        const match = notes.match(/Sucursal:\s*([^|]+)/i);
        return match ? match[1].trim() : null;
    };

    const getTypeLabel = (type) => {
        if (type === 'sale') return 'Venta';
        if (type === 'entry') return 'Entrada';
        return 'Salida';
    };

    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => {
            if (selectedType !== "all" && tx.type !== selectedType) return false;
            if (selectedSucursal !== "all") {
                const txSucursal = getSucursal(tx.notes);
                if (txSucursal !== selectedSucursal) return false;
            }
            if (selectedProduct !== "all") {
                const hasProduct = tx.items?.some(item => item.productId === selectedProduct);
                if (!hasProduct) return false;
            }
            return true;
        });
    }, [transactions, selectedType, selectedSucursal, selectedProduct]);

    const totals = useMemo(() => {
        let totalEntradas = 0;
        let totalSalidas = 0;

        // Calculate totals for movements within the filtered range
        filteredTransactions.forEach(tx => {
            const total = tx.items?.reduce((acc, item) => {
                const currentProduct = products.find(p => p.id === item.productId);
                const unitValue = (tx.type === 'entry' || tx.type === 'exit')
                    ? (currentProduct ? Number(currentProduct.cost || 0) : Number(item.cost || 0))
                    : (currentProduct ? Number(currentProduct.price) : Number(item.price || 0));
                return acc + (unitValue * Number(item.quantity));
            }, 0) || 0;

            if (tx.type === 'entry') totalEntradas += total;
            else if (tx.type === 'exit') totalSalidas += total;
        });

        // Calculate Current Inventory Value
        // If a product is selected, only calculate for that product
        // If specific sucursal is selected... simpler to just show total value based on product filter
        let inventoryValue = 0;

        const productsToSum = selectedProduct !== "all"
            ? products.filter(p => p.id === selectedProduct)
            : products;

        inventoryValue = productsToSum.reduce((acc, p) => {
            return acc + (Number(p.cost || 0) * Number(p.stock || 0));
        }, 0);

        return { totalEntradas, totalSalidas, inventoryValue };
    }, [filteredTransactions, products, selectedProduct]);

    // Summary by Sucursal
    const sucursalData = useMemo(() => {
        const summary = {};

        filteredTransactions.forEach(tx => {
            const sucursal = getSucursal(tx.notes) || 'Sin Sucursal';

            if (!summary[sucursal]) {
                summary[sucursal] = {
                    sucursal,
                    entradasUnidades: 0,
                    entradasMonto: 0,
                    salidasUnidades: 0,
                    salidasMonto: 0
                };
            }

            tx.items?.forEach(item => {
                const currentProduct = products.find(p => p.id === item.productId);
                const unitCost = currentProduct ? Number(currentProduct.cost || 0) : Number(item.cost || 0);
                const qty = Number(item.quantity);

                if (tx.type === 'entry') {
                    summary[sucursal].entradasUnidades += qty;
                    summary[sucursal].entradasMonto += unitCost * qty;
                } else if (tx.type === 'exit' || tx.type === 'sale') {
                    summary[sucursal].salidasUnidades += qty;
                    summary[sucursal].salidasMonto += unitCost * qty;
                }
            });
        });

        return Object.values(summary).sort((a, b) => a.sucursal.localeCompare(b.sucursal));
    }, [filteredTransactions, products]);

    const cardexData = useMemo(() => {
        if (reportType !== "cardex" || selectedProduct === "all") return [];

        const product = products.find(p => p.id === selectedProduct);
        if (!product) return [];

        const sortedTx = [...filteredTransactions].sort((a, b) => {
            const dateA = a.timestamp?.toDate?.() || new Date(0);
            const dateB = b.timestamp?.toDate?.() || new Date(0);
            return dateA - dateB;
        });

        let saldo = 0;
        const cardex = [];

        sortedTx.forEach(tx => {
            const item = tx.items?.find(i => i.productId === selectedProduct);
            if (!item) return;

            const cantidad = Number(item.quantity);
            let entrada = 0;
            let salida = 0;

            if (tx.type === 'entry') {
                entrada = cantidad;
                saldo += cantidad;
            } else {
                salida = cantidad;
                saldo -= cantidad;
            }

            cardex.push({
                fecha: tx.timestamp?.toDate ? format(tx.timestamp.toDate(), 'dd/MM/yyyy') : '',
                tipo: getTypeLabel(tx.type),
                referencia: tx.reference || '',
                sucursal: getSucursal(tx.notes) || '',
                entrada,
                salida,
                saldo
            });
        });

        return cardex;
    }, [reportType, selectedProduct, filteredTransactions, products]);

    const exportToExcel = () => {
        let dataToExport;
        let fileName;

        if (reportType === "cardex" && selectedProduct !== "all") {
            const product = products.find(p => p.id === selectedProduct);
            const productSku = product?.sku || 'SIN-SKU';

            dataToExport = cardexData.map(row => ({
                "Fecha": row.fecha,
                "Producto": `${productSku} - ${product?.name || ''}`,
                "Tipo": row.tipo,
                "Referencia": row.referencia,
                "Sucursal": row.sucursal,
                "Entrada": row.entrada || '',
                "Salida": row.salida || '',
                "Saldo": row.saldo
            }));

            fileName = `cardex_${productSku}_${product?.name?.replace(/\s+/g, '_') || 'producto'}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
        } else if (reportType === "sucursal") {
            dataToExport = sucursalData.map(row => ({
                "Sucursal": row.sucursal,
                "Entradas (Uds)": row.entradasUnidades,
                "Entradas ($)": row.entradasMonto,
                "Salidas (Uds)": row.salidasUnidades,
                "Salidas ($)": row.salidasMonto,
                "Diferencia ($)": row.entradasMonto - row.salidasMonto
            }));
            fileName = `reporte_por_sucursal_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
        } else {
            dataToExport = filteredTransactions.map(tx => ({
                "Fecha": tx.timestamp?.toDate ? format(tx.timestamp.toDate(), 'dd/MM/yyyy') : '',
                "Tipo": getTypeLabel(tx.type),
                "Referencia": tx.reference || '',
                "Sucursal": getSucursal(tx.notes) || '',
                "Productos": `${tx.items?.length || 0} producto(s)`,
                "Total": tx.items?.reduce((acc, item) => {
                    const currentProduct = products.find(p => p.id === item.productId);
                    const unitValue = (tx.type === 'entry' || tx.type === 'exit')
                        ? (currentProduct ? Number(currentProduct.cost || 0) : Number(item.cost || 0))
                        : (currentProduct ? Number(currentProduct.price) : Number(item.price || 0));
                    return acc + (unitValue * Number(item.quantity));
                }, 0) || 0
            }));
            fileName = `reporte_movimientos_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
        }

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte");
        XLSX.writeFile(workbook, fileName);
        addToast(`Archivo exportado: ${fileName}`);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <header className="page-header">
                <div>
                    <h1 className="page-title">Reportes</h1>
                </div>
                {filteredTransactions.length > 0 && (
                    <button onClick={exportToExcel} className="btn-primary self-start sm:self-auto">
                        <FileDown className="h-4 w-4" />
                        Exportar Excel
                    </button>
                )}
            </header>

            {/* Report Type Selector + Rango de fechas */}
            <section className="surface p-4 sm:p-5 space-y-4">
                <div className="segmented flex-wrap">
                    <button
                        onClick={() => setReportType("movements")}
                        className={reportType === "movements" ? "segment segment-active inline-flex items-center gap-1.5" : "segment inline-flex items-center gap-1.5"}
                        aria-pressed={reportType === "movements"}
                    >
                        <BarChart3 className="h-4 w-4" />
                        Movimientos
                    </button>
                    <button
                        onClick={() => setReportType("cardex")}
                        className={reportType === "cardex" ? "segment segment-active inline-flex items-center gap-1.5" : "segment inline-flex items-center gap-1.5"}
                        aria-pressed={reportType === "cardex"}
                    >
                        <Package className="h-4 w-4" />
                        Cardex
                    </button>
                    <button
                        onClick={() => setReportType("sucursal")}
                        className={reportType === "sucursal" ? "segment segment-active inline-flex items-center gap-1.5" : "segment inline-flex items-center gap-1.5"}
                        aria-pressed={reportType === "sucursal"}
                    >
                        <BarChart3 className="h-4 w-4" />
                        Por Sucursal
                    </button>
                </div>

                <div className="divider pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="report-date-from" className="input-label">Desde</label>
                            <input
                                id="report-date-from"
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="input-field"
                            />
                        </div>
                        <div>
                            <label htmlFor="report-date-to" className="input-label">Hasta</label>
                            <input
                                id="report-date-to"
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="input-field"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Filters */}
            <section className="surface p-5">
                <div className="flex items-center gap-2 mb-5">
                    <div className="stat-icon bg-ink-100">
                        <Filter className="h-[18px] w-[18px] text-ink-600" />
                    </div>
                    <h2 className="section-title">Filtros</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label htmlFor="report-product" className="input-label">Producto</label>
                        <select
                            id="report-product"
                            value={selectedProduct}
                            onChange={(e) => setSelectedProduct(e.target.value)}
                            className="input-field"
                        >
                            <option value="all">Todos los productos</option>
                            {products.sort((a, b) => (a.sku || '').localeCompare(b.sku || '')).map(p => (
                                <option key={p.id} value={p.id}>{p.sku ? `${p.sku} - ` : ''}{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="report-type" className="input-label">Tipo de Movimiento</label>
                        <select
                            id="report-type"
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            className="input-field"
                        >
                            <option value="all">Todos</option>
                            <option value="entry">Entradas</option>
                            <option value="exit">Salidas</option>
                            <option value="sale">Ventas</option>
                        </select>
                    </div>
                </div>

                {sucursales.length > 0 && (
                    <div className="mb-4">
                        <label htmlFor="report-sucursal" className="input-label">Sucursal</label>
                        <select
                            id="report-sucursal"
                            value={selectedSucursal}
                            onChange={(e) => setSelectedSucursal(e.target.value)}
                            className="input-field sm:max-w-xs"
                        >
                            <option value="all">Todas las sucursales</option>
                            {sucursales.map(s => (<option key={s} value={s}>{s}</option>))}
                        </select>
                    </div>
                )}

                <div className="flex flex-wrap gap-3">
                    <button onClick={fetchTransactions} disabled={loading} className="btn-primary">
                        <Search className="h-4 w-4" />
                        {loading ? "Buscando..." : "Generar Reporte"}
                    </button>
                </div>
            </section>

            {/* Cardex Warning */}
            {reportType === "cardex" && selectedProduct === "all" && (
                <div className="rounded-2xl border border-warning-200 bg-warning-50 p-4">
                    <p className="text-sm text-warning-800">⚠️ Para ver el Cardex, selecciona un producto específico en los filtros.</p>
                </div>
            )}

            {/* Results */}
            {filteredTransactions.length > 0 && (
                <section className="table-shell">
                    {reportType === "movements" ? (
                        <>
                            <div className="table-scroll custom-scrollbar">
                                <table className="min-w-full">
                                    <thead className="table-head sticky top-0 z-10">
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Tipo</th>
                                            <th>Referencia</th>
                                            <th>Sucursal</th>
                                            <th>Productos</th>
                                            <th className="text-right">Total</th>
                                            <th className="text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="table-body">
                                        {filteredTransactions.map(tx => {
                                            const total = tx.items?.reduce((acc, item) => {
                                                const currentProduct = products.find(p => p.id === item.productId);
                                                const unitValue = (tx.type === 'entry' || tx.type === 'exit')
                                                    ? (currentProduct ? Number(currentProduct.cost || 0) : Number(item.cost || 0))
                                                    : (currentProduct ? Number(currentProduct.price) : Number(item.price || 0));
                                                return acc + (unitValue * Number(item.quantity));
                                            }, 0) || 0;
                                            return (
                                                <tr key={tx.id}>
                                                    <td className="whitespace-nowrap tabular-nums text-ink-700">
                                                        {tx.timestamp?.toDate ? format(tx.timestamp.toDate(), 'dd/MM/yyyy') : '--'}
                                                    </td>
                                                    <td>
                                                        <span className={tx.type === 'entry' ? 'badge-primary' : tx.type === 'sale' ? 'badge-success' : 'badge-warning'}>
                                                            {getTypeLabel(tx.type)}
                                                        </span>
                                                    </td>
                                                    <td className="whitespace-nowrap font-medium text-primary-700">{tx.reference || '--'}</td>
                                                    <td className="whitespace-nowrap text-ink-600">{getSucursal(tx.notes) || '--'}</td>
                                                    <td className="whitespace-nowrap tabular-nums">{tx.items?.length || 0} producto(s)</td>
                                                    <td className="whitespace-nowrap text-right font-semibold text-ink-900 tabular-nums">{formatCurrency(total)}</td>
                                                    <td className="text-center">
                                                        <button
                                                            onClick={() => setViewingTransaction(tx)}
                                                            className="btn-icon h-9 w-9 text-ink-500 hover:text-primary-700 hover:bg-primary-50 transition-colors"
                                                            title="Ver detalles"
                                                            aria-label={`Ver detalles de ${getTypeLabel(tx.type)}`}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="border-t border-ink-200/70 p-4">
                                <div className="surface-muted p-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-6">
                                        <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                                            <span className="text-xs text-ink-500">Entradas:</span>
                                            <span className="ml-2 text-base font-bold text-success-700 tabular-nums">{formatCurrency(totals.totalEntradas)}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                                            <span className="text-xs text-ink-500">Salidas:</span>
                                            <span className="ml-2 text-base font-bold text-warning-700 tabular-nums">{formatCurrency(totals.totalSalidas)}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                                            <span className="text-xs text-ink-500">Valor Inventario Actual:</span>
                                            <span className="ml-2 text-base font-bold text-primary-700 tabular-nums">{formatCurrency(totals.inventoryValue)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : reportType === "cardex" && selectedProduct !== "all" ? (
                        <>
                            <div className="card-header">
                                <h3 className="section-title">Cardex: {products.find(p => p.id === selectedProduct)?.name}</h3>
                            </div>
                            <div className="table-scroll custom-scrollbar">
                                <table className="min-w-full">
                                    <thead className="table-head sticky top-0 z-10">
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Tipo</th>
                                            <th>Referencia</th>
                                            <th>Sucursal</th>
                                            <th className="text-right">Entrada</th>
                                            <th className="text-right">Salida</th>
                                            <th className="text-right">Saldo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="table-body">
                                        {cardexData.map((row, idx) => (
                                            <tr key={idx}>
                                                <td className="whitespace-nowrap tabular-nums">{row.fecha}</td>
                                                <td>
                                                    <span className={row.tipo === 'Entrada' ? 'badge-primary' : row.tipo === 'Venta' ? 'badge-success' : 'badge-warning'}>
                                                        {row.tipo}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap font-medium text-primary-700">{row.referencia || '--'}</td>
                                                <td className="whitespace-nowrap text-ink-600">{row.sucursal || '--'}</td>
                                                <td className="text-right font-semibold text-success-700 tabular-nums">{row.entrada > 0 ? `+${row.entrada}` : ''}</td>
                                                <td className="text-right font-semibold text-danger-700 tabular-nums">{row.salida > 0 ? `-${row.salida}` : ''}</td>
                                                <td className="text-right font-bold text-ink-900 tabular-nums">{row.saldo}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {cardexData.length > 0 && (
                                <div className="border-t border-ink-200/70 p-4">
                                    <div className="surface-muted p-4 flex justify-end">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-ink-500">Saldo Final:</span>
                                            <span className="text-lg font-bold text-ink-900 tabular-nums">{cardexData[cardexData.length - 1]?.saldo || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : reportType === "sucursal" ? (
                        /* Sucursal Summary Table */
                        <>
                            <div className="card-header">
                                <h3 className="section-title">Resumen por Sucursal</h3>
                            </div>
                            <div className="table-scroll custom-scrollbar">
                                <table className="min-w-full">
                                    <thead className="table-head sticky top-0 z-10">
                                        <tr>
                                            <th>Sucursal</th>
                                            <th className="text-right">Entradas (Uds)</th>
                                            <th className="text-right">Entradas ($)</th>
                                            <th className="text-right">Salidas (Uds)</th>
                                            <th className="text-right">Salidas ($)</th>
                                            <th className="text-right">Diferencia ($)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="table-body">
                                        {sucursalData.map((row, idx) => (
                                            <tr key={idx}>
                                                <td className="whitespace-nowrap font-medium text-ink-900">{row.sucursal}</td>
                                                <td className="text-right font-semibold text-success-700 tabular-nums">+{row.entradasUnidades}</td>
                                                <td className="text-right text-success-700 tabular-nums">{formatCurrency(row.entradasMonto)}</td>
                                                <td className="text-right font-semibold text-danger-700 tabular-nums">-{row.salidasUnidades}</td>
                                                <td className="text-right text-danger-700 tabular-nums">{formatCurrency(row.salidasMonto)}</td>
                                                <td className={`text-right font-bold tabular-nums ${(row.entradasMonto - row.salidasMonto) >= 0 ? 'text-success-700' : 'text-danger-700'}`}>
                                                    {formatCurrency(row.entradasMonto - row.salidasMonto)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-ink-100/70 border-t border-ink-200">
                                        <tr>
                                            <td className="px-4 py-3 text-sm font-bold text-ink-900">TOTAL</td>
                                            <td className="px-4 py-3 text-right font-bold text-success-700 tabular-nums">
                                                +{sucursalData.reduce((acc, r) => acc + r.entradasUnidades, 0)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-success-700 tabular-nums">
                                                {formatCurrency(sucursalData.reduce((acc, r) => acc + r.entradasMonto, 0))}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-danger-700 tabular-nums">
                                                -{sucursalData.reduce((acc, r) => acc + r.salidasUnidades, 0)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-danger-700 tabular-nums">
                                                {formatCurrency(sucursalData.reduce((acc, r) => acc + r.salidasMonto, 0))}
                                            </td>
                                            <td className={`px-4 py-3 text-right font-bold tabular-nums ${(sucursalData.reduce((acc, r) => acc + r.entradasMonto - r.salidasMonto, 0)) >= 0 ? 'text-success-700' : 'text-danger-700'}`}>
                                                {formatCurrency(sucursalData.reduce((acc, r) => acc + r.entradasMonto - r.salidasMonto, 0))}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </>
                    ) : null}
                </section>
            )}

            {transactions.length === 0 && !loading && (
                <div className="surface empty-state">
                    <div className="empty-icon">
                        <BarChart3 className="h-5 w-5 text-ink-400" />
                    </div>
                    <p className="text-sm font-medium text-ink-700">Selecciona un rango de fechas y presiona "Generar Reporte" para ver los resultados.</p>
                </div>
            )}

            {/* Transaction Detail Modal */}
            {viewingTransaction && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/60 p-4 animate-fade-in"
                    onClick={() => setViewingTransaction(null)}
                >
                    <div
                        className="modal-panel w-full max-w-2xl max-h-[90dvh] overflow-y-auto animate-scale-in"
                        onClick={e => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Detalle de ${getTypeLabel(viewingTransaction.type)}`}
                    >
                        <div className="card-header">
                            <div>
                                <h3 className="section-title">
                                    Detalle de {getTypeLabel(viewingTransaction.type)}
                                </h3>
                                <p className="text-xs text-ink-500 mt-1">
                                    {viewingTransaction.timestamp?.toDate ? format(viewingTransaction.timestamp.toDate(), 'dd/MM/yyyy') : ''}
                                    {viewingTransaction.reference && ` • Ref: ${viewingTransaction.reference}`}
                                </p>
                            </div>
                            <button
                                onClick={() => setViewingTransaction(null)}
                                className="btn-icon h-9 w-9 -mr-2 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors"
                                title="Cerrar"
                                aria-label="Cerrar"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-5">
                            {getSucursal(viewingTransaction.notes) && (
                                <div className="mb-5 p-3 bg-primary-50 border border-primary-200 rounded-2xl">
                                    <span className="text-sm font-medium text-primary-800">Sucursal: {getSucursal(viewingTransaction.notes)}</span>
                                </div>
                            )}

                            <div className="table-shell mb-5">
                                <div className="table-scroll custom-scrollbar">
                                    <table className="min-w-full">
                                        <thead className="table-head">
                                            <tr>
                                                <th>Producto</th>
                                                <th className="text-center">Cantidad</th>
                                                <th className="text-right">Precio</th>
                                                <th className="text-right">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="table-body">
                                            {viewingTransaction.items?.map((item, idx) => {
                                                const currentProduct = products.find(p => p.id === item.productId);
                                                const unitValue = (viewingTransaction.type === 'entry' || viewingTransaction.type === 'exit')
                                                    ? (currentProduct ? Number(currentProduct.cost || 0) : Number(item.cost || 0))
                                                    : (currentProduct ? Number(currentProduct.price) : Number(item.price || 0));
                                                const subtotal = unitValue * Number(item.quantity);
                                                return (
                                                    <tr key={idx}>
                                                        <td className="font-medium text-ink-900">{item.name}</td>
                                                        <td className="text-center tabular-nums">{item.quantity}</td>
                                                        <td className="text-right text-ink-600 tabular-nums">{formatCurrency(unitValue)}</td>
                                                        <td className="text-right font-semibold text-ink-900 tabular-nums">{formatCurrency(subtotal)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="surface-muted p-4">
                                <div className="text-right">
                                    <span className="text-xs text-ink-500">Total:</span>
                                    <span className="ml-2 text-xl font-bold text-ink-900 tabular-nums">
                                        {formatCurrency(viewingTransaction.items?.reduce((acc, item) => {
                                            const currentProduct = products.find(p => p.id === item.productId);
                                            const unitValue = (viewingTransaction.type === 'entry' || viewingTransaction.type === 'exit')
                                                ? (currentProduct ? Number(currentProduct.cost || 0) : Number(item.cost || 0))
                                                : (currentProduct ? Number(currentProduct.price) : Number(item.price || 0));
                                            return acc + (unitValue * Number(item.quantity));
                                        }, 0))}
                                    </span>
                                </div>
                            </div>

                            {viewingTransaction.notes && (
                                <div className="mt-4 surface-muted p-3.5">
                                    <p className="text-sm text-ink-600"><span className="font-medium text-ink-800">Notas:</span> {viewingTransaction.notes}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
