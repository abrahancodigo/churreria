import { useState, useEffect } from "react";
import { db } from "../firebase.config";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { format } from "date-fns";
import { Search, Trash2, Eye, X, Printer, RefreshCw, FileDown, Edit2 } from "lucide-react";
import { deleteTransaction, editTransaction, getProducts } from "../lib/db";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useCompany } from "../context/CompanyContext";
import { useRole } from "../hooks/useRole";
import { formatCurrency } from "../lib/formatters";
import ConfirmDialog from "../components/ConfirmDialog";
import * as XLSX from "xlsx";

export default function Transactions() {
    const [transactions, setTransactions] = useState([]);
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [deleting, setDeleting] = useState(null);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [editFormData, setEditFormData] = useState(null);
    const [viewingTransaction, setViewingTransaction] = useState(null);
    const [enrichedItems, setEnrichedItems] = useState([]);
    const [savingEdit, setSavingEdit] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState(null);
    const { addToast } = useToast();
    const { user } = useAuth();
    const { isAdmin } = useRole();
    const { companyInfo } = useCompany();

    // Fetch products for current prices
    useEffect(() => {
        const unsubscribe = getProducts((data) => setProducts(data));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const q = query(
            collection(db, "transactions"),
            orderBy("timestamp", "desc"),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setTransactions(data);
        });
        return () => unsubscribe();
    }, []);

    // Function to enrich transaction items with current product prices
    const enrichTransactionWithCurrentPrices = (tx) => {
        if (!tx || !tx.items) return [];

        return tx.items.map(item => {
            const currentProduct = products.find(p => p.id === item.productId);
            return {
                ...item,
                currentPrice: currentProduct ? Number(currentProduct.price) : null,
                currentCost: currentProduct ? Number(currentProduct.cost || 0) : null,
                priceChanged: currentProduct && Number(currentProduct.price) !== Number(item.price),
                costChanged: currentProduct && Number(currentProduct.cost || 0) !== Number(item.cost || 0)
            };
        });
    };

    // Calculate updated total for a transaction based on current product costs/prices
    const getUpdatedTotal = (tx) => {
        if (!tx || !tx.items || products.length === 0) return Number(tx?.total || 0);

        const isMovement = tx.type === 'entry' || tx.type === 'exit';

        return tx.items.reduce((acc, item) => {
            const currentProduct = products.find(p => p.id === item.productId);
            const unitValue = isMovement
                ? (currentProduct ? Number(currentProduct.cost || 0) : Number(item.cost || 0))
                : (currentProduct ? Number(currentProduct.price) : Number(item.price || 0));
            return acc + (unitValue * Number(item.quantity));
        }, 0);
    };

    // When viewing a transaction, enrich items with current prices
    const handleViewTransaction = (tx) => {
        setViewingTransaction(tx);
        const enriched = enrichTransactionWithCurrentPrices(tx);
        setEnrichedItems(enriched);
    };

    const filteredTransactions = transactions
        .filter(t => {
            const search = searchTerm.toLowerCase();
            
            // Buscar en todos los campos disponibles
            const matchId = t.id.toLowerCase().includes(search);
            const matchType = t.type.toLowerCase().includes(search);
            const matchReference = t.reference && t.reference.toLowerCase().includes(search);
            const matchSucursal = t.sucursal && t.sucursal.toLowerCase().includes(search);
            const matchNotes = t.notes && t.notes.toLowerCase().includes(search);
            
            // Buscar en los nombres de los productos del items
            const matchItems = t.items && t.items.some(item => 
                (item.name && item.name.toLowerCase().includes(search)) ||
                (item.productId && item.productId.toLowerCase().includes(search))
            );
            
            // Buscar en el email del usuario
            const matchUser = t.userId && t.userId.toLowerCase().includes(search);
            
            // Buscar en el total (como string)
            const matchTotal = String(t.total || 0).includes(search);
            
            return matchId || matchType || matchReference || matchSucursal || matchNotes || matchItems || matchUser || matchTotal;
        })
        .sort((a, b) => {
            const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
            const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : (b.timestamp ? new Date(b.timestamp).getTime() : 0);

            if (timeB !== timeA) return timeB - timeA;

            // If same time, sort by reference numeric value DESC
            const refA = parseInt(a.reference) || 0;
            const refB = parseInt(b.reference) || 0;
            return refB - refA;
        });

    const handleDelete = async (tx) => {
        if (!isAdmin) {
            addToast("Solo los administradores pueden eliminar transacciones.", "error");
            return;
        }
        setTransactionToDelete(tx);
    };

    const confirmDelete = async () => {
        if (!transactionToDelete) return;
        const tx = transactionToDelete;
        setDeleting(tx.id);
        try {
            await deleteTransaction(tx.id, tx);
            addToast("Transacción eliminada y stock revertido correctamente.");
            setTransactionToDelete(null);
        } catch (error) {
            addToast("Error al eliminar: " + error.message, "error");
        } finally {
            setDeleting(null);
        }
    };

    const handleEdit = (tx) => {
        if (!isAdmin) {
            addToast("Solo los administradores pueden editar transacciones.", "error");
            return;
        }
        // Preparar el formulario con todos los datos de la transacción
        setEditFormData({
            ...tx,
            items: tx.items.map(item => ({ ...item })), // Copia profunda de items
            date: tx.timestamp?.toDate ? format(tx.timestamp.toDate(), 'yyyy-MM-dd') : new Date().toISOString().split('T')[0],
            time: tx.timestamp?.toDate ? format(tx.timestamp.toDate(), 'HH:mm') : '12:00'
        });
        setEditingTransaction(tx);
    };

    const handleSaveEdit = async () => {
        if (!isAdmin) {
            addToast("Solo los administradores pueden guardar cambios.", "error");
            return;
        }

        if (!editFormData.reference || !editFormData.reference.trim()) {
            addToast("La referencia es obligatoria.", "error");
            return;
        }

        if (!editFormData.items || editFormData.items.length === 0) {
            addToast("La transacción debe tener al menos un producto.", "error");
            return;
        }

        setSavingEdit(true);
        try {
            // Crear timestamp desde la fecha y hora seleccionadas
            const timestamp = new Date(`${editFormData.date}T${editFormData.time || '12:00'}`);

            // Calcular el total
            const isMovement = editFormData.type === 'entry' || editFormData.type === 'exit';
            const total = editFormData.items.reduce((acc, item) => {
                const unitValue = isMovement ? Number(item.cost || 0) : Number(item.price || 0);
                return acc + (unitValue * Number(item.quantity));
            }, 0);

            const newData = {
                ...editFormData,
                total,
                timestamp,
                editedBy: user?.email || 'admin'
            };

            const oldData = {
                type: editingTransaction.type,
                items: editingTransaction.items
            };

            await editTransaction(editingTransaction.id, oldData, newData);
            addToast("Transacción actualizada correctamente.");
            handleCloseEditModal();
        } catch (error) {
            addToast("Error al actualizar: " + error.message, "error");
        } finally {
            setSavingEdit(false);
        }
    };

    const handleCloseEditModal = () => {
        setEditingTransaction(null);
        setEditFormData(null);
        setSavingEdit(false);
    };

    // Funciones para manejar los items en el modal de edición
    const handleUpdateItemQuantity = (index, newQty) => {
        const qty = Math.max(1, parseInt(newQty) || 1);
        const newItems = [...editFormData.items];
        newItems[index] = { ...newItems[index], quantity: qty };
        setEditFormData({ ...editFormData, items: newItems });
    };

    const handleRemoveItem = (index) => {
        const newItems = editFormData.items.filter((_, i) => i !== index);
        setEditFormData({ ...editFormData, items: newItems });
    };

    const handleUpdateItemPrice = (index, newPrice) => {
        const newItems = [...editFormData.items];
        newItems[index] = { ...newItems[index], price: Number(newPrice) || 0 };
        setEditFormData({ ...editFormData, items: newItems });
    };

    const handleUpdateItemCost = (index, newCost) => {
        const newItems = [...editFormData.items];
        newItems[index] = { ...newItems[index], cost: Number(newCost) || 0 };
        setEditFormData({ ...editFormData, items: newItems });
    };

    const handlePrint = () => {
        window.print();
    };

    const getTypeLabel = (type) => {
        if (type === 'sale') return 'Venta';
        if (type === 'entry') return 'Entrada';
        return 'Salida';
    };

    const getTypeBadgeClass = (type) => {
        if (type === 'sale') return 'badge-success';
        if (type === 'entry') return 'badge-primary';
        return 'badge-warning';
    };

    // Extract sucursal from field or notes
    const getSucursal = (tx) => {
        if (tx.sucursal) return tx.sucursal;
        if (!tx.notes) return null;
        const match = tx.notes.match(/Sucursal:\s*([^|]+)/i);
        return match ? match[1].trim() : null;
    };

    // Export to Excel function
    const exportToExcel = () => {
        const dataToExport = filteredTransactions.map(tx => {
            const sucursal = getSucursal(tx);

            return {
                "Fecha": tx.timestamp?.toDate ? format(tx.timestamp.toDate(), 'dd/MM/yyyy HH:mm:ss') : '',
                "Tipo": getTypeLabel(tx.type),
                "Referencia": tx.reference || '',
                "Sucursal": sucursal || '',
                "Productos": `${tx.items?.length || 0} producto(s)`,
                "Total": getUpdatedTotal(tx),
                "Notas": tx.notes || ''
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Historial");

        // Set column widths for better readability
        worksheet['!cols'] = [
            { wch: 20 }, // Fecha
            { wch: 10 }, // Tipo
            { wch: 15 }, // Referencia
            { wch: 20 }, // Sucursal
            { wch: 15 }, // Productos
            { wch: 12 }, // Total
            { wch: 30 }  // Notas
        ];

        // Format Total column as currency  
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for (let row = 1; row <= range.e.r; row++) { // Start from row 1 to skip header
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: 5 }); // Column F (index 5) is Total
            if (worksheet[cellAddress]) {
                worksheet[cellAddress].z = '$#,##0.00'; // Apply currency format
            }
        }


        const fileName = `historial_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`;
        XLSX.writeFile(workbook, fileName);

        addToast(`Archivo exportado: ${fileName}`);
    };

    return (
        <div className="space-y-6">
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .print-content, .print-content * {
                        visibility: visible;
                    }
                    .print-content {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        padding: 20px;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-only {
                        display: block !important;
                    }
                    .print-header {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 15px;
                        margin-bottom: 20px;
                        border-bottom: 2px solid #000;
                        padding-bottom: 10px;
                    }
                    .print-logo {
                        width: 60px;
                        height: 60px;
                        object-fit: contain;
                    }
                    .print-header-text {
                        text-align: left;
                    }
                    .print-header-text h1 {
                        font-size: 18px;
                        margin: 0;
                    }
                    .print-header-text h2 {
                        font-size: 14px;
                        margin: 0;
                        color: #666;
                    }
                    .print-signatures {
                        margin-top: 40px;
                        page-break-inside: avoid;
                    }
                    .signature-row {
                        display: flex;
                        justify-content: space-around;
                        margin-bottom: 30px;
                    }
                    .signature-field {
                        text-align: center;
                        width: 40%;
                    }
                    .signature-line {
                        border-bottom: 1px solid #000;
                        height: 40px;
                        margin-bottom: 5px;
                    }
                    .signature-label {
                        font-size: 12px;
                    }
                    .hora-field {
                        text-align: center;
                        margin-top: 20px;
                    }
                    .hora-line {
                        display: inline-block;
                        width: 150px;
                        border-bottom: 1px solid #000;
                        height: 30px;
                    }
                }
            `}</style>

            {/* Header */}
            <header className="page-header">
                <div>
                    <h1 className="page-title">Historial de Transacciones</h1>
                    <p className="page-subtitle" aria-hidden="true">&nbsp;</p>
                </div>
                <button
                    onClick={exportToExcel}
                    className="btn-primary self-start sm:self-auto"
                    title="Exportar a Excel"
                >
                    <FileDown className="h-4 w-4" />
                    Exportar
                </button>
            </header>

            {/* Search */}
            <div className="surface p-3 sm:p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" />
                    <input
                        type="search"
                        className="input-field pl-9"
                        placeholder="Buscar por ID, producto, referencia, sucursal, notas..."
                        aria-label="Buscar transacciones"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="table-shell hidden md:block">
                <div className="table-scroll custom-scrollbar max-h-[calc(100dvh-260px)] overflow-y-auto">
                    <table className="min-w-full">
                        <thead className="table-head sticky top-0 z-10">
                            <tr>
                                <th>Fecha</th>
                                <th>Tipo</th>
                                <th>Referencia</th>
                                <th>Sucursal</th>
                                <th>Productos</th>
                                <th className="text-right">Total</th>
                                <th className="text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="table-body">
                            {filteredTransactions.map((tx) => (
                                <tr key={tx.id}>
                                    <td className="whitespace-nowrap text-ink-500 tabular-nums">
                                        {tx.timestamp?.toDate ? format(tx.timestamp.toDate(), 'dd/MM/yyyy HH:mm') : '--'}
                                    </td>
                                    <td className="whitespace-nowrap">
                                        <span className={getTypeBadgeClass(tx.type)}>
                                            {getTypeLabel(tx.type)}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap font-semibold text-primary-700">
                                        {tx.reference || '--'}
                                    </td>
                                    <td className="whitespace-nowrap text-ink-600">
                                        {getSucursal(tx) || '--'}
                                    </td>
                                    <td className="text-ink-500">
                                        <div className="max-w-xs truncate">
                                            {tx.items?.length || 0} producto(s)
                                        </div>
                                    </td>
                                    <td className="whitespace-nowrap text-right font-semibold text-ink-900 tabular-nums">
                                        {formatCurrency(getUpdatedTotal(tx))}
                                    </td>
                                    <td className="whitespace-nowrap text-right">
                                        <div className="inline-flex items-center gap-1">
                                            <button
                                                onClick={() => handleViewTransaction(tx)}
                                                className="btn-icon h-9 w-9 touch-target text-ink-500 hover:text-primary-700 hover:bg-primary-50 transition-colors"
                                                title="Ver Detalles"
                                                aria-label="Ver Detalles"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleEdit(tx)}
                                                disabled={!isAdmin}
                                                className="btn-icon h-9 w-9 touch-target text-ink-500 hover:text-primary-700 hover:bg-primary-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                title={!isAdmin ? "Solo administradores" : "Editar Transacción"}
                                                aria-label="Editar Transacción"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(tx)}
                                                disabled={deleting === tx.id}
                                                className="btn-icon h-9 w-9 touch-target text-danger-600 hover:text-danger-700 hover:bg-danger-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                title="Eliminar Transacción"
                                                aria-label="Eliminar Transacción"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredTransactions.length === 0 && (
                                <tr>
                                    <td colSpan="7">
                                        <div className="empty-state">
                                            <div className="empty-icon">
                                                <Search className="h-5 w-5 text-ink-400" />
                                            </div>
                                            <p className="text-sm font-medium text-ink-700">No se encontraron transacciones.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {filteredTransactions.map((tx) => (
                    <div key={tx.id} className="surface p-4">
                        <div className="flex justify-between items-start gap-3 mb-2">
                            <span className={getTypeBadgeClass(tx.type)}>
                                {getTypeLabel(tx.type)}
                            </span>
                            <span className="text-sm text-ink-500 whitespace-nowrap tabular-nums">
                                {tx.timestamp?.toDate ? format(tx.timestamp.toDate(), 'dd/MM HH:mm') : '--'}
                            </span>
                        </div>

                        {tx.reference && (
                            <p className="text-sm font-semibold text-primary-700 mb-1 truncate">{tx.reference}</p>
                        )}

                        {getSucursal(tx) && (
                            <p className="text-sm text-ink-600 mb-1">📍 {getSucursal(tx)}</p>
                        )}

                        <div className="flex justify-between items-center mt-3 gap-3">
                            <div>
                                <p className="text-lg font-bold text-ink-900 tabular-nums">{formatCurrency(getUpdatedTotal(tx))}</p>
                                <p className="text-xs text-ink-500">{tx.items?.length || 0} producto(s)</p>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handleViewTransaction(tx)}
                                    className="btn-icon h-9 w-9 touch-target text-ink-500 hover:text-primary-700 hover:bg-primary-50 transition-colors"
                                    title="Ver Detalles"
                                    aria-label="Ver Detalles"
                                >
                                    <Eye className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => handleEdit(tx)}
                                    disabled={!isAdmin}
                                    className="btn-icon h-9 w-9 touch-target text-ink-500 hover:text-primary-700 hover:bg-primary-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    title={!isAdmin ? "Solo administradores" : "Editar"}
                                    aria-label="Editar"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(tx)}
                                    disabled={deleting === tx.id}
                                    className="btn-icon h-9 w-9 touch-target text-danger-600 hover:text-danger-700 hover:bg-danger-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    title="Eliminar"
                                    aria-label="Eliminar"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                {filteredTransactions.length === 0 && (
                    <div className="surface empty-state">
                        <div className="empty-icon">
                            <Search className="h-5 w-5 text-ink-400" />
                        </div>
                        <p className="text-sm font-medium text-ink-700">No se encontraron transacciones.</p>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {viewingTransaction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/60 p-4 animate-fade-in">
                    <div
                        className="modal-panel w-full max-w-2xl max-h-[90dvh] overflow-y-auto animate-scale-in"
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Detalles de ${getTypeLabel(viewingTransaction.type)}`}
                    >
                        <div className="sticky top-0 z-10 bg-surface border-b border-ink-200/70 px-6 py-4 flex items-center justify-between gap-4 no-print">
                            <h2 className="section-title">
                                Detalles de {getTypeLabel(viewingTransaction.type)}
                            </h2>
                            <button
                                onClick={() => setViewingTransaction(null)}
                                className="btn-icon h-9 w-9 -mr-2 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors"
                                title="Cerrar"
                                aria-label="Cerrar"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5 print-content">
                            <div className="print-header hidden print:flex">
                                {companyInfo.logoUrl && (
                                    <img src={companyInfo.logoUrl} alt="Logo" className="print-logo" />
                                )}
                                <div className="print-header-text">
                                    <h1>{companyInfo.name || 'Mi Empresa'}</h1>
                                    <h2>DETALLE DE {getTypeLabel(viewingTransaction.type).toUpperCase()}</h2>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="surface-muted p-4">
                                    <label className="input-label">Referencia / Factura</label>
                                    <p className="text-base sm:text-lg font-semibold text-primary-700 break-words">
                                        {viewingTransaction.reference || 'Sin referencia'}
                                    </p>
                                </div>
                                <div className="surface-muted p-4">
                                    <label className="input-label">Fecha y Hora</label>
                                    <p className="text-base sm:text-lg font-semibold text-ink-900 tabular-nums">
                                        {viewingTransaction.timestamp?.toDate ?
                                            format(viewingTransaction.timestamp.toDate(), 'dd/MM/yyyy HH:mm:ss') : '--'}
                                    </p>
                                </div>
                                <div className="surface-muted p-4">
                                    <label className="input-label">Tipo</label>
                                    <p className="mt-1">
                                        <span className={getTypeBadgeClass(viewingTransaction.type)}>
                                            {getTypeLabel(viewingTransaction.type)}
                                        </span>
                                    </p>
                                </div>
                                <div className="surface-muted p-4">
                                    <label className="input-label">
                                        {(viewingTransaction.type === 'entry' || viewingTransaction.type === 'exit') ? 'Costo Total (Actual)' : 'Total'}
                                    </label>
                                    <p className="text-lg font-bold text-ink-900 tabular-nums">
                                        {formatCurrency((viewingTransaction.type === 'entry' || viewingTransaction.type === 'exit')
                                            ? enrichedItems.reduce((acc, item) => acc + ((item.currentCost !== null ? item.currentCost : Number(item.cost || 0)) * Number(item.quantity)), 0)
                                            : enrichedItems.reduce((acc, item) => acc + ((item.currentPrice !== null ? item.currentPrice : Number(item.price || 0)) * Number(item.quantity)), 0)
                                        )}
                                    </p>
                                    {(viewingTransaction.type === 'entry' || viewingTransaction.type === 'exit') && (
                                        <p className="text-xs text-ink-400 mt-1 tabular-nums">
                                            Costo original: {formatCurrency(viewingTransaction.items?.reduce((acc, item) => acc + (Number(item.cost || 0) * Number(item.quantity)), 0))}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {viewingTransaction.notes && (
                                <div className="surface-muted p-4">
                                    <label className="input-label">Notas / Sucursal</label>
                                    <p className="text-sm text-ink-700 whitespace-pre-line">{viewingTransaction.notes}</p>
                                </div>
                            )}

                            <div>
                                <label className="input-label mb-2">
                                    Productos {(viewingTransaction.type === 'entry' || viewingTransaction.type === 'exit') ? '(Costos Actualizados)' : '(Precios Actualizados)'}
                                </label>
                                <div className="table-shell">
                                    {/* Desktop Table */}
                                    <div className="hidden sm:block table-scroll">
                                        <table className="min-w-full">
                                            <thead className="table-head sticky top-0 z-10">
                                                <tr>
                                                    <th>Producto</th>
                                                    <th className="text-right">Cantidad</th>
                                                    <th className="text-right">
                                                        {(viewingTransaction.type === 'entry' || viewingTransaction.type === 'exit') ? 'Costo Unit.' : 'Precio Unit.'}
                                                    </th>
                                                    <th className="text-right">Subtotal</th>
                                                </tr>
                                            </thead>
                                            <tbody className="table-body">
                                                {enrichedItems.map((item, idx) => {
                                                    const isMovement = viewingTransaction.type === 'entry' || viewingTransaction.type === 'exit';
                                                    const unitValue = isMovement
                                                        ? (item.currentCost !== null ? item.currentCost : Number(item.cost || 0))
                                                        : (item.currentPrice !== null ? item.currentPrice : Number(item.price || 0));
                                                    const valueChanged = isMovement ? item.costChanged : item.priceChanged;
                                                    const originalValue = isMovement ? Number(item.cost || 0) : Number(item.price || 0);

                                                    return (
                                                        <tr key={idx}>
                                                            <td className="font-medium text-ink-900">{item.name}</td>
                                                            <td className="text-right text-ink-700 tabular-nums">{item.quantity}</td>
                                                            <td className="text-right tabular-nums">
                                                                <span className={valueChanged ? (isMovement ? 'text-warning-700 font-semibold' : 'text-success-700 font-semibold') : 'text-ink-700'}>
                                                                    {formatCurrency(unitValue)}
                                                                </span>
                                                                {valueChanged && (
                                                                    <span className="text-xs text-ink-400 line-through ml-1">
                                                                        {formatCurrency(originalValue)}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="text-right font-semibold text-ink-900 tabular-nums">
                                                                {formatCurrency(unitValue * Number(item.quantity))}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile List */}
                                    <div className="sm:hidden divide-y divide-ink-100">
                                        {enrichedItems.map((item, idx) => {
                                            const isMovement = viewingTransaction.type === 'entry' || viewingTransaction.type === 'exit';
                                            const unitValue = isMovement
                                                ? (item.currentCost !== null ? item.currentCost : Number(item.cost || 0))
                                                : (item.currentPrice !== null ? item.currentPrice : Number(item.price || 0));
                                            const valueChanged = isMovement ? item.costChanged : item.priceChanged;
                                            const originalValue = isMovement ? Number(item.cost || 0) : Number(item.price || 0);

                                            return (
                                                <div key={idx} className="p-3">
                                                    <div className="flex justify-between items-start gap-3">
                                                        <p className="font-medium text-ink-900">{item.name}</p>
                                                        <span className="font-bold text-ink-900 whitespace-nowrap tabular-nums">
                                                            {formatCurrency(unitValue * Number(item.quantity))}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-ink-500 mt-1 tabular-nums">
                                                        {item.quantity} x
                                                        <span className={valueChanged ? (isMovement ? 'text-warning-700 font-semibold' : 'text-success-700 font-semibold') : ''}>
                                                            {formatCurrency(unitValue)}
                                                        </span>
                                                        {valueChanged && (
                                                            <span className="text-xs text-ink-400 line-through ml-1">
                                                                (antes: {formatCurrency(originalValue)})
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Signature fields for entry/exit - only visible when printing */}
                            {(viewingTransaction.type === 'entry' || viewingTransaction.type === 'exit') && (
                                <div className="print-signatures hidden print:block">
                                    <div className="signature-row">
                                        <div className="signature-field">
                                            <div className="signature-line"></div>
                                            <div className="signature-label">Entregado por</div>
                                        </div>
                                        <div className="signature-field">
                                            <div className="signature-line"></div>
                                            <div className="signature-label">Recibido por</div>
                                        </div>
                                    </div>
                                    <div className="hora-field">
                                        <div className="hora-line"></div>
                                        <div className="signature-label">Hora</div>
                                    </div>
                                </div>
                            )}

                            <div className="divider pt-4">
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                                    <span className="text-sm text-ink-500">ID de Transacción:</span>
                                    <span className="text-xs font-mono text-ink-400 truncate">{viewingTransaction.id}</span>
                                </div>
                            </div>
                        </div>

                        <div className="divider bg-ink-50/70 px-6 py-4 flex flex-col sm:flex-row sm:justify-end gap-3 no-print">
                            <button
                                onClick={handlePrint}
                                className="btn-secondary flex-1 sm:flex-none"
                            >
                                <Printer className="h-4 w-4" />
                                Imprimir
                            </button>
                            <button
                                onClick={() => setViewingTransaction(null)}
                                className="btn-primary flex-1 sm:flex-none"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Transaction Modal */}
            {editingTransaction && editFormData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/60 p-4 animate-fade-in">
                    <div
                        className="modal-panel w-full max-w-3xl max-h-[90dvh] overflow-y-auto animate-scale-in"
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Editar ${getTypeLabel(editFormData.type)}`}
                    >
                        <div className="sticky top-0 z-10 bg-surface border-b border-ink-200/70 px-6 py-4 flex items-center justify-between gap-4">
                            <h2 className="section-title">
                                Editar {getTypeLabel(editFormData.type)}
                            </h2>
                            <button
                                onClick={handleCloseEditModal}
                                className="btn-icon h-9 w-9 -mr-2 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors"
                                title="Cerrar"
                                aria-label="Cerrar"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Información básica */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="edit-type" className="input-label">Tipo de Movimiento</label>
                                    <select
                                        id="edit-type"
                                        value={editFormData.type}
                                        onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value })}
                                        className="input-field"
                                        disabled={editFormData.type === 'sale'}
                                    >
                                        <option value="entry">Entrada</option>
                                        <option value="exit">Salida</option>
                                        {editFormData.type === 'sale' && <option value="sale">Venta</option>}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="edit-date" className="input-label">Fecha</label>
                                    <input
                                        id="edit-date"
                                        type="date"
                                        value={editFormData.date}
                                        onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                                        className="input-field"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="edit-time" className="input-label">Hora</label>
                                    <input
                                        id="edit-time"
                                        type="time"
                                        value={editFormData.time}
                                        onChange={(e) => setEditFormData({ ...editFormData, time: e.target.value })}
                                        className="input-field"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="edit-reference" className="input-label">Referencia *</label>
                                    <input
                                        id="edit-reference"
                                        type="text"
                                        value={editFormData.reference}
                                        onChange={(e) => setEditFormData({ ...editFormData, reference: e.target.value })}
                                        className="input-field"
                                        placeholder="ej. FAC-1234"
                                    />
                                </div>
                            </div>

                            {/* Sucursal para salidas */}
                            {editFormData.type === 'exit' && (
                                <div>
                                    <label htmlFor="edit-sucursal" className="input-label">Sucursal Destino *</label>
                                    <input
                                        id="edit-sucursal"
                                        type="text"
                                        value={editFormData.sucursal || ''}
                                        onChange={(e) => setEditFormData({ ...editFormData, sucursal: e.target.value })}
                                        className="input-field"
                                        placeholder="ej. Sucursal Centro"
                                    />
                                </div>
                            )}

                            {/* Notas */}
                            <div>
                                <label htmlFor="edit-notes" className="input-label">Notas</label>
                                <textarea
                                    id="edit-notes"
                                    value={editFormData.notes || ''}
                                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                                    className="input-field"
                                    rows="2"
                                    placeholder="Comentarios adicionales..."
                                />
                            </div>

                            {/* Items */}
                            <div>
                                <label className="input-label mb-2">Productos</label>
                                <div className="table-shell">
                                    <div className="table-scroll">
                                        <table className="min-w-full">
                                            <thead className="table-head sticky top-0 z-10">
                                                <tr>
                                                    <th>Producto</th>
                                                    <th className="text-right">Cantidad</th>
                                                    <th className="text-right">Precio</th>
                                                    <th className="text-right">Costo</th>
                                                    <th className="text-right">Total</th>
                                                    <th className="text-center">Acción</th>
                                                </tr>
                                            </thead>
                                            <tbody className="table-body">
                                                {editFormData.items.map((item, index) => (
                                                    <tr key={index}>
                                                        <td className="font-medium text-ink-900">{item.name}</td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={item.quantity}
                                                                onChange={(e) => handleUpdateItemQuantity(index, e.target.value)}
                                                                className="input-field px-2 py-1.5 text-right tabular-nums"
                                                                aria-label={`Cantidad de ${item.name}`}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={item.price || 0}
                                                                onChange={(e) => handleUpdateItemPrice(index, e.target.value)}
                                                                className="input-field px-2 py-1.5 text-right tabular-nums"
                                                                disabled={editFormData.type === 'entry' || editFormData.type === 'exit'}
                                                                aria-label={`Precio de ${item.name}`}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={item.cost || 0}
                                                                onChange={(e) => handleUpdateItemCost(index, e.target.value)}
                                                                className="input-field px-2 py-1.5 text-right tabular-nums"
                                                                disabled={editFormData.type === 'sale'}
                                                                aria-label={`Costo de ${item.name}`}
                                                            />
                                                        </td>
                                                        <td className="text-right font-semibold text-ink-900 tabular-nums">
                                                            {formatCurrency((editFormData.type === 'entry' || editFormData.type === 'exit' ? item.cost : item.price) * item.quantity)}
                                                        </td>
                                                        <td className="text-center">
                                                            <button
                                                                onClick={() => handleRemoveItem(index)}
                                                                className="btn-icon h-9 w-9 text-danger-600 hover:text-danger-700 hover:bg-danger-50 transition-colors"
                                                                title="Eliminar producto"
                                                                aria-label={`Eliminar ${item.name}`}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Total */}
                            <div className="surface-muted p-4">
                                <div className="flex justify-between items-center gap-4">
                                    <span className="text-lg font-bold text-ink-900">Total</span>
                                    <span className="text-2xl font-bold text-ink-900 tabular-nums">
                                        {formatCurrency(editFormData.type === 'entry' || editFormData.type === 'exit'
                                            ? editFormData.items.reduce((acc, item) => acc + (Number(item.cost || 0) * Number(item.quantity)), 0)
                                            : editFormData.items.reduce((acc, item) => acc + (Number(item.price || 0) * Number(item.quantity)), 0)
                                        )}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="divider bg-ink-50/70 px-6 py-4 flex flex-col sm:flex-row sm:justify-end gap-3">
                            <button
                                onClick={handleCloseEditModal}
                                className="btn-secondary flex-1 sm:flex-none"
                                disabled={savingEdit}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={savingEdit}
                                className="btn-primary flex-1 sm:flex-none"
                            >
                                {savingEdit ? (
                                    <>
                                        <RefreshCw className="animate-spin h-4 w-4" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="h-4 w-4" />
                                        Actualizar Transacción
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={!!transactionToDelete}
                title="Eliminar transacción"
                message={transactionToDelete
                    ? `¿Estás seguro de eliminar esta ${transactionToDelete.type === 'sale' ? 'venta' : transactionToDelete.type === 'entry' ? 'entrada' : 'salida'}?\n\nEsto revertirá los cambios de inventario.`
                    : ""}
                confirmLabel="Sí, eliminar"
                loading={!!deleting}
                onConfirm={confirmDelete}
                onCancel={() => !deleting && setTransactionToDelete(null)}
            />
        </div>
    );
}
