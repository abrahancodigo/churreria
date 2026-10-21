import { useState, useEffect, useMemo } from "react";
import { db } from "../firebase.config";
import { collection, query, orderBy, getDocs, where, Timestamp } from "firebase/firestore";
import { format, startOfDay, endOfDay, parseISO } from "date-fns";
import { Search, FileDown, Filter, BarChart3, Package, Eye, X } from "lucide-react";
import { getProducts } from "../lib/db";
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
            let q = query(collection(db, "transactions"), orderBy("timestamp", "desc"));

            const constraints = [];
            if (dateFrom) {
                constraints.push(where("timestamp", ">=", Timestamp.fromDate(startOfDay(parseISO(dateFrom)))));
            }
            if (dateTo) {
                constraints.push(where("timestamp", "<=", Timestamp.fromDate(endOfDay(parseISO(dateTo)))));
            }

            if (constraints.length > 0) {
                q = query(collection(db, "transactions"), ...constraints, orderBy("timestamp", "desc"));
            }

            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
        <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Reportes</h1>

            {/* Report Type Selector */}
            <div className="bg-white rounded-lg shadow p-4 mb-4">
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setReportType("movements")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${reportType === "movements" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                    >
                        <BarChart3 className="h-5 w-5" />
                        Movimientos
                    </button>
                    <button
                        onClick={() => setReportType("cardex")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${reportType === "cardex" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                    >
                        <Package className="h-5 w-5" />
                        Cardex
                    </button>
                    <button
                        onClick={() => setReportType("sucursal")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${reportType === "sucursal" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                    >
                        <BarChart3 className="h-5 w-5" />
                        Por Sucursal
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4 mb-4">
                <div className="flex items-center gap-2 mb-4">
                    <Filter className="h-5 w-5 text-gray-500" />
                    <h2 className="font-medium text-gray-900">Filtros</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Producto</label>
                        <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="all">Todos los productos</option>
                            {products.sort((a, b) => (a.sku || '').localeCompare(b.sku || '')).map(p => (
                                <option key={p.id} value={p.id}>{p.sku ? `${p.sku} - ` : ''}{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Movimiento</label>
                        <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="all">Todos</option>
                            <option value="entry">Entradas</option>
                            <option value="exit">Salidas</option>
                            <option value="sale">Ventas</option>
                        </select>
                    </div>
                </div>

                {sucursales.length > 0 && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal</label>
                        <select value={selectedSucursal} onChange={(e) => setSelectedSucursal(e.target.value)}
                            className="w-full sm:w-auto px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="all">Todas las sucursales</option>
                            {sucursales.map(s => (<option key={s} value={s}>{s}</option>))}
                        </select>
                    </div>
                )}

                <div className="flex flex-wrap gap-3">
                    <button onClick={fetchTransactions} disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                        <Search className="h-5 w-5" />
                        {loading ? "Buscando..." : "Generar Reporte"}
                    </button>
                    {filteredTransactions.length > 0 && (
                        <button onClick={exportToExcel}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
                            <FileDown className="h-5 w-5" />
                            Exportar Excel
                        </button>
                    )}
                </div>
            </div>

            {/* Cardex Warning */}
            {reportType === "cardex" && selectedProduct === "all" && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <p className="text-yellow-800">⚠️ Para ver el Cardex, selecciona un producto específico en los filtros.</p>
                </div>
            )}

            {/* Results */}
            {filteredTransactions.length > 0 && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    {reportType === "movements" ? (
                        <>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referencia</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sucursal</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Productos</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredTransactions.map(tx => {
                                            const total = tx.items?.reduce((acc, item) => {
                                                const currentProduct = products.find(p => p.id === item.productId);
                                                const unitValue = (tx.type === 'entry' || tx.type === 'exit')
                                                    ? (currentProduct ? Number(currentProduct.cost || 0) : Number(item.cost || 0))
                                                    : (currentProduct ? Number(currentProduct.price) : Number(item.price || 0));
                                                return acc + (unitValue * Number(item.quantity));
                                            }, 0) || 0;
                                            return (
                                                <tr key={tx.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm text-gray-900">{tx.timestamp?.toDate ? format(tx.timestamp.toDate(), 'dd/MM/yyyy') : '--'}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${tx.type === 'entry' ? 'bg-blue-100 text-blue-800' : tx.type === 'sale' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                            {getTypeLabel(tx.type)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-blue-600 font-medium">{tx.reference || '--'}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-600">{getSucursal(tx.notes) || '--'}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-600">{tx.items?.length || 0} producto(s)</td>
                                                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">${total.toFixed(2)}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => setViewingTransaction(tx)}
                                                            className="text-blue-600 hover:text-blue-800 p-1"
                                                            title="Ver detalles"
                                                        >
                                                            <Eye className="h-5 w-5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="bg-gray-50 px-4 py-4 border-t">
                                <div className="flex flex-wrap justify-end gap-4 text-sm">
                                    <div><span className="text-gray-500">Entradas:</span> <span className="font-bold text-blue-600">${totals.totalEntradas.toFixed(2)}</span></div>
                                    <div><span className="text-gray-500">Salidas:</span> <span className="font-bold text-yellow-600">${totals.totalSalidas.toFixed(2)}</span></div>
                                    <div><span className="text-gray-500">Valor Inventario Actual:</span> <span className="font-bold text-green-600">${totals.inventoryValue.toFixed(2)}</span></div>
                                </div>
                            </div>
                        </>
                    ) : reportType === "cardex" && selectedProduct !== "all" ? (
                        <>
                            <div className="p-4 border-b bg-gray-50">
                                <h3 className="font-bold text-gray-900">Cardex: {products.find(p => p.id === selectedProduct)?.name}</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referencia</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sucursal</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Entrada</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Salida</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {cardexData.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm text-gray-900">{row.fecha}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${row.tipo === 'Entrada' ? 'bg-blue-100 text-blue-800' : row.tipo === 'Venta' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        {row.tipo}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-blue-600 font-medium">{row.referencia || '--'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">{row.sucursal || '--'}</td>
                                                <td className="px-4 py-3 text-sm text-right font-medium text-green-600">{row.entrada > 0 ? `+${row.entrada}` : ''}</td>
                                                <td className="px-4 py-3 text-sm text-right font-medium text-red-600">{row.salida > 0 ? `-${row.salida}` : ''}</td>
                                                <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{row.saldo}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {cardexData.length > 0 && (
                                <div className="bg-gray-50 px-4 py-4 border-t">
                                    <div className="flex justify-end">
                                        <span className="text-gray-500">Saldo Final:</span>
                                        <span className="ml-2 font-bold text-lg">{cardexData[cardexData.length - 1]?.saldo || 0}</span>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : reportType === "sucursal" ? (
                        /* Sucursal Summary Table */
                        <>
                            <div className="p-4 border-b bg-gray-50">
                                <h3 className="font-bold text-gray-900">Resumen por Sucursal</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sucursal</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Entradas (Uds)</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Entradas ($)</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Salidas (Uds)</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Salidas ($)</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Diferencia ($)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {sucursalData.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.sucursal}</td>
                                                <td className="px-4 py-3 text-sm text-right text-blue-600 font-medium">+{row.entradasUnidades}</td>
                                                <td className="px-4 py-3 text-sm text-right text-blue-600">${row.entradasMonto.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">-{row.salidasUnidades}</td>
                                                <td className="px-4 py-3 text-sm text-right text-red-600">${row.salidasMonto.toFixed(2)}</td>
                                                <td className={`px-4 py-3 text-sm text-right font-bold ${(row.entradasMonto - row.salidasMonto) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    ${(row.entradasMonto - row.salidasMonto).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-100">
                                        <tr>
                                            <td className="px-4 py-3 text-sm font-bold text-gray-900">TOTAL</td>
                                            <td className="px-4 py-3 text-sm text-right font-bold text-blue-600">
                                                +{sucursalData.reduce((acc, r) => acc + r.entradasUnidades, 0)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-bold text-blue-600">
                                                ${sucursalData.reduce((acc, r) => acc + r.entradasMonto, 0).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-bold text-red-600">
                                                -{sucursalData.reduce((acc, r) => acc + r.salidasUnidades, 0)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-bold text-red-600">
                                                ${sucursalData.reduce((acc, r) => acc + r.salidasMonto, 0).toFixed(2)}
                                            </td>
                                            <td className={`px-4 py-3 text-sm text-right font-bold ${(sucursalData.reduce((acc, r) => acc + r.entradasMonto - r.salidasMonto, 0)) >= 0 ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                ${sucursalData.reduce((acc, r) => acc + r.entradasMonto - r.salidasMonto, 0).toFixed(2)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </>
                    ) : null}
                </div>
            )}

            {transactions.length === 0 && !loading && (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Selecciona un rango de fechas y presiona "Generar Reporte" para ver los resultados.</p>
                </div>
            )}

            {/* Transaction Detail Modal */}
            {viewingTransaction && (
                <div className="fixed inset-0 z-50 overflow-y-auto" onClick={() => setViewingTransaction(null)}>
                    <div className="flex items-center justify-center min-h-screen p-4">
                        <div className="fixed inset-0 bg-black bg-opacity-50"></div>
                        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">
                                        Detalle de {getTypeLabel(viewingTransaction.type)}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        {viewingTransaction.timestamp?.toDate ? format(viewingTransaction.timestamp.toDate(), 'dd/MM/yyyy') : ''}
                                        {viewingTransaction.reference && ` • Ref: ${viewingTransaction.reference}`}
                                    </p>
                                </div>
                                <button onClick={() => setViewingTransaction(null)} className="text-gray-400 hover:text-gray-600">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                            <div className="p-6">
                                {getSucursal(viewingTransaction.notes) && (
                                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                                        <span className="text-sm font-medium text-blue-800">Sucursal: {getSucursal(viewingTransaction.notes)}</span>
                                    </div>
                                )}
                                <table className="min-w-full divide-y divide-gray-200 mb-4">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Precio</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {viewingTransaction.items?.map((item, idx) => {
                                            const currentProduct = products.find(p => p.id === item.productId);
                                            const unitValue = (viewingTransaction.type === 'entry' || viewingTransaction.type === 'exit')
                                                ? (currentProduct ? Number(currentProduct.cost || 0) : Number(item.cost || 0))
                                                : (currentProduct ? Number(currentProduct.price) : Number(item.price || 0));
                                            const subtotal = unitValue * Number(item.quantity);
                                            return (
                                                <tr key={idx}>
                                                    <td className="px-4 py-2 text-sm text-gray-900">{item.name}</td>
                                                    <td className="px-4 py-2 text-sm text-center text-gray-900">{item.quantity}</td>
                                                    <td className="px-4 py-2 text-sm text-right text-gray-600">${unitValue.toFixed(2)}</td>
                                                    <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">${subtotal.toFixed(2)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                <div className="flex justify-end border-t pt-4">
                                    <div className="text-right">
                                        <span className="text-gray-500">Total:</span>
                                        <span className="ml-2 text-xl font-bold text-gray-900">
                                            ${viewingTransaction.items?.reduce((acc, item) => {
                                                const currentProduct = products.find(p => p.id === item.productId);
                                                const unitValue = (viewingTransaction.type === 'entry' || viewingTransaction.type === 'exit')
                                                    ? (currentProduct ? Number(currentProduct.cost || 0) : Number(item.cost || 0))
                                                    : (currentProduct ? Number(currentProduct.price) : Number(item.price || 0));
                                                return acc + (unitValue * Number(item.quantity));
                                            }, 0).toFixed(2) || '0.00'}
                                        </span>
                                    </div>
                                </div>
                                {viewingTransaction.notes && (
                                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                        <p className="text-sm text-gray-600"><span className="font-medium">Notas:</span> {viewingTransaction.notes}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
