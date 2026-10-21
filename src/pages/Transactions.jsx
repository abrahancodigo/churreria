import { useState, useEffect } from "react";
import { db } from "../firebase.config";
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc } from "firebase/firestore";
import { format } from "date-fns";
import { Search, Trash2, Eye, X, Printer, RefreshCw, FileDown, Edit2 } from "lucide-react";
import { deleteTransaction, editTransaction, getProducts } from "../lib/db";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useRole } from "../hooks/useRole";
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
    const [loadingPrices, setLoadingPrices] = useState(false);
    const [companyInfo, setCompanyInfo] = useState({ name: "", logoUrl: "" });
    const [savingEdit, setSavingEdit] = useState(false);
    const { addToast } = useToast();
    const { user } = useAuth();
    const { isAdmin } = useRole();

    // Fetch company info for logo
    useEffect(() => {
        const fetchCompanyInfo = async () => {
            try {
                const docRef = doc(db, "settings", "company");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setCompanyInfo(docSnap.data());
                }
            } catch (error) {
                console.error("Error fetching company info:", error);
            }
        };
        fetchCompanyInfo();
    }, []);

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
        const confirmMsg = `¿Estás seguro de eliminar esta ${tx.type === 'sale' ? 'venta' : tx.type === 'entry' ? 'entrada' : 'salida'}?\n\nEsto revertirá los cambios de inventario.`;

        if (!window.confirm(confirmMsg)) return;

        setDeleting(tx.id);
        try {
            await deleteTransaction(tx.id, tx);
            addToast("Transacción eliminada y stock revertido correctamente.");
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
        if (type === 'sale') return 'bg-green-100 text-green-800';
        if (type === 'entry') return 'bg-blue-100 text-blue-800';
        return 'bg-yellow-100 text-yellow-800';
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
        <div>
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

            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Historial de Transacciones</h1>

            <div className="mb-4 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-base"
                        placeholder="Buscar por ID, producto, referencia, sucursal, notas..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={exportToExcel}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors font-medium touch-manipulation"
                    title="Exportar a Excel"
                >
                    <FileDown className="h-5 w-5" />
                    <span className="hidden sm:inline">Exportar</span>
                </button>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white shadow overflow-hidden sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referencia</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sucursal</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Productos</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredTransactions.map((tx) => (
                            <tr key={tx.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {tx.timestamp?.toDate ? format(tx.timestamp.toDate(), 'dd/MM/yyyy HH:mm') : '--'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeBadgeClass(tx.type)}`}>
                                        {getTypeLabel(tx.type)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                                    {tx.reference || '--'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    {getSucursal(tx) || '--'}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    <div className="max-w-xs truncate">
                                        {tx.items?.length || 0} producto(s)
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                                    ${getUpdatedTotal(tx).toFixed(2)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <button
                                        onClick={() => handleViewTransaction(tx)}
                                        className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                                        title="Ver Detalles"
                                    >
                                        <Eye className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleEdit(tx)}
                                        disabled={!isAdmin}
                                        className={`inline-flex items-center ${isAdmin ? 'text-indigo-600 hover:text-indigo-900' : 'text-gray-300 cursor-not-allowed'}`}
                                        title={!isAdmin ? "Solo administradores" : "Editar Transacción"}
                                    >
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(tx)}
                                        disabled={deleting === tx.id}
                                        className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                                        title="Eliminar Transacción"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredTransactions.length === 0 && (
                            <tr>
                                <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                                    No se encontraron transacciones.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {filteredTransactions.map((tx) => (
                    <div key={tx.id} className="bg-white rounded-lg shadow p-4 border border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getTypeBadgeClass(tx.type)}`}>
                                    {getTypeLabel(tx.type)}
                                </span>
                            </div>
                            <span className="text-sm text-gray-500">
                                {tx.timestamp?.toDate ? format(tx.timestamp.toDate(), 'dd/MM HH:mm') : '--'}
                            </span>
                        </div>

                        {tx.reference && (
                            <p className="text-sm font-medium text-blue-600 mb-1 truncate">{tx.reference}</p>
                        )}

                        {getSucursal(tx) && (
                            <p className="text-sm text-gray-600 mb-1">📍 {getSucursal(tx)}</p>
                        )}

                        <div className="flex justify-between items-center mt-3">
                            <div>
                                <p className="text-lg font-bold text-gray-900">${getUpdatedTotal(tx).toFixed(2)}</p>
                                <p className="text-xs text-gray-500">{tx.items?.length || 0} producto(s)</p>
                            </div>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => handleViewTransaction(tx)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-md touch-manipulation"
                                    title="Ver Detalles"
                                >
                                    <Eye className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={() => handleEdit(tx)}
                                    disabled={!isAdmin}
                                    className={`p-2 rounded-md touch-manipulation ${isAdmin ? 'text-indigo-600 hover:bg-indigo-50' : 'text-gray-300 cursor-not-allowed'}`}
                                    title={!isAdmin ? "Solo administradores" : "Editar"}
                                >
                                    <Edit2 className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={() => handleDelete(tx)}
                                    disabled={deleting === tx.id}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50 touch-manipulation"
                                    title="Eliminar"
                                >
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                {filteredTransactions.length === 0 && (
                    <div className="text-center py-10 text-gray-500">
                        No se encontraron transacciones.
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {viewingTransaction && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
                    <div className="bg-white w-full sm:rounded-lg shadow-xl sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-lg">
                        {/* Mobile drag handle */}
                        <div className="sm:hidden flex justify-center py-2">
                            <div className="w-12 h-1 bg-gray-300 rounded-full" />
                        </div>

                        <div className="flex justify-between items-center p-4 sm:p-6 border-b no-print">
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                                Detalles de {getTypeLabel(viewingTransaction.type)}
                            </h2>
                            <button
                                onClick={() => setViewingTransaction(null)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 space-y-4 print-content">
                            <div className="print-header hidden print:flex">
                                {companyInfo.logoUrl && (
                                    <img src={companyInfo.logoUrl} alt="Logo" className="print-logo" />
                                )}
                                <div className="print-header-text">
                                    <h1>{companyInfo.name || 'Mi Empresa'}</h1>
                                    <h2>DETALLE DE {getTypeLabel(viewingTransaction.type).toUpperCase()}</h2>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500">Referencia / Factura</label>
                                    <p className="mt-1 text-base sm:text-lg font-semibold text-blue-600">
                                        {viewingTransaction.reference || 'Sin referencia'}
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500">Fecha y Hora</label>
                                    <p className="mt-1 text-base sm:text-lg">
                                        {viewingTransaction.timestamp?.toDate ?
                                            format(viewingTransaction.timestamp.toDate(), 'dd/MM/yyyy HH:mm:ss') : '--'}
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500">Tipo</label>
                                    <p className="mt-1">
                                        <span className={`px-3 py-1 inline-flex text-sm font-semibold rounded-full ${getTypeBadgeClass(viewingTransaction.type)}`}>
                                            {getTypeLabel(viewingTransaction.type)}
                                        </span>
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500">
                                        {(viewingTransaction.type === 'entry' || viewingTransaction.type === 'exit') ? 'Costo Total (Actual)' : 'Total'}
                                    </label>
                                    <p className="mt-1 text-lg font-bold text-gray-900">
                                        ${(viewingTransaction.type === 'entry' || viewingTransaction.type === 'exit')
                                            ? enrichedItems.reduce((acc, item) => acc + ((item.currentCost !== null ? item.currentCost : Number(item.cost || 0)) * Number(item.quantity)), 0).toFixed(2)
                                            : enrichedItems.reduce((acc, item) => acc + ((item.currentPrice !== null ? item.currentPrice : Number(item.price || 0)) * Number(item.quantity)), 0).toFixed(2)
                                        }
                                    </p>
                                    {(viewingTransaction.type === 'entry' || viewingTransaction.type === 'exit') && (
                                        <p className="text-xs text-gray-400">
                                            Costo original: ${viewingTransaction.items?.reduce((acc, item) => acc + (Number(item.cost || 0) * Number(item.quantity)), 0).toFixed(2)}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {viewingTransaction.notes && (
                                <div className="bg-gray-50 p-3 rounded-md">
                                    <label className="block text-sm font-medium text-gray-500">Notas / Sucursal</label>
                                    <p className="mt-1 text-gray-700">{viewingTransaction.notes}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-500 mb-2">
                                    Productos {(viewingTransaction.type === 'entry' || viewingTransaction.type === 'exit') ? '(Costos Actualizados)' : '(Precios Actualizados)'}
                                </label>
                                <div className="border rounded-lg overflow-hidden">
                                    {/* Desktop Table */}
                                    <table className="hidden sm:table min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                                    {(viewingTransaction.type === 'entry' || viewingTransaction.type === 'exit') ? 'Costo Unit.' : 'Precio Unit.'}
                                                </th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {enrichedItems.map((item, idx) => {
                                                const isMovement = viewingTransaction.type === 'entry' || viewingTransaction.type === 'exit';
                                                const unitValue = isMovement
                                                    ? (item.currentCost !== null ? item.currentCost : Number(item.cost || 0))
                                                    : (item.currentPrice !== null ? item.currentPrice : Number(item.price || 0));
                                                const valueChanged = isMovement ? item.costChanged : item.priceChanged;
                                                const originalValue = isMovement ? Number(item.cost || 0) : Number(item.price || 0);

                                                return (
                                                    <tr key={idx}>
                                                        <td className="px-4 py-2 text-sm text-gray-900">{item.name}</td>
                                                        <td className="px-4 py-2 text-sm text-right text-gray-700">{item.quantity}</td>
                                                        <td className="px-4 py-2 text-sm text-right">
                                                            <span className={valueChanged ? (isMovement ? 'text-orange-600 font-semibold' : 'text-green-600 font-semibold') : 'text-gray-700'}>
                                                                ${unitValue.toFixed(2)}
                                                            </span>
                                                            {valueChanged && (
                                                                <span className="text-xs text-gray-400 line-through ml-1">
                                                                    ${originalValue.toFixed(2)}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">
                                                            ${(unitValue * Number(item.quantity)).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>

                                    {/* Mobile List */}
                                    <div className="sm:hidden divide-y divide-gray-200">
                                        {enrichedItems.map((item, idx) => {
                                            const isMovement = viewingTransaction.type === 'entry' || viewingTransaction.type === 'exit';
                                            const unitValue = isMovement
                                                ? (item.currentCost !== null ? item.currentCost : Number(item.cost || 0))
                                                : (item.currentPrice !== null ? item.currentPrice : Number(item.price || 0));
                                            const valueChanged = isMovement ? item.costChanged : item.priceChanged;
                                            const originalValue = isMovement ? Number(item.cost || 0) : Number(item.price || 0);

                                            return (
                                                <div key={idx} className="p-3">
                                                    <div className="flex justify-between items-start">
                                                        <p className="font-medium text-gray-900">{item.name}</p>
                                                        <span className="font-bold text-gray-900">
                                                            ${(unitValue * Number(item.quantity)).toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-gray-500 mt-1">
                                                        {item.quantity} x
                                                        <span className={valueChanged ? (isMovement ? 'text-orange-600 font-semibold' : 'text-green-600 font-semibold') : ''}>
                                                            ${unitValue.toFixed(2)}
                                                        </span>
                                                        {valueChanged && (
                                                            <span className="text-xs text-gray-400 line-through ml-1">
                                                                (antes: ${originalValue.toFixed(2)})
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

                            <div className="pt-4 border-t">
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                                    <span className="text-sm text-gray-500">ID de Transacción:</span>
                                    <span className="text-xs font-mono text-gray-400 truncate">{viewingTransaction.id}</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 sm:p-6 border-t bg-gray-50 flex flex-col sm:flex-row gap-3 no-print">
                            <button
                                onClick={handlePrint}
                                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center touch-manipulation"
                            >
                                <Printer className="h-4 w-4 mr-2" />
                                Imprimir
                            </button>
                            <button
                                onClick={() => setViewingTransaction(null)}
                                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 touch-manipulation"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Transaction Modal */}
            {editingTransaction && editFormData && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
                    <div className="bg-white w-full sm:rounded-lg shadow-xl sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-lg">
                        {/* Mobile drag handle */}
                        <div className="sm:hidden flex justify-center py-2">
                            <div className="w-12 h-1 bg-gray-300 rounded-full" />
                        </div>

                        <div className="flex justify-between items-center p-4 sm:p-6 border-b sticky top-0 bg-white z-10">
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                                Editar {getTypeLabel(editFormData.type)}
                            </h2>
                            <button
                                onClick={handleCloseEditModal}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 space-y-6">
                            {/* Información básica */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Movimiento</label>
                                    <select
                                        value={editFormData.type}
                                        onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        disabled={editFormData.type === 'sale'}
                                    >
                                        <option value="entry">Entrada</option>
                                        <option value="exit">Salida</option>
                                        {editFormData.type === 'sale' && <option value="sale">Venta</option>}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                                    <input
                                        type="date"
                                        value={editFormData.date}
                                        onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                                    <input
                                        type="time"
                                        value={editFormData.time}
                                        onChange={(e) => setEditFormData({ ...editFormData, time: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Referencia *</label>
                                    <input
                                        type="text"
                                        value={editFormData.reference}
                                        onChange={(e) => setEditFormData({ ...editFormData, reference: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="ej. FAC-1234"
                                    />
                                </div>
                            </div>

                            {/* Sucursal para salidas */}
                            {editFormData.type === 'exit' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal Destino *</label>
                                    <input
                                        type="text"
                                        value={editFormData.sucursal || ''}
                                        onChange={(e) => setEditFormData({ ...editFormData, sucursal: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="ej. Sucursal Centro"
                                    />
                                </div>
                            )}

                            {/* Notas */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                                <textarea
                                    value={editFormData.notes || ''}
                                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    rows="2"
                                    placeholder="Comentarios adicionales..."
                                />
                            </div>

                            {/* Items */}
                            <div>
                                <label className="block text-sm font-bold text-gray-900 mb-2">Productos</label>
                                <div className="border rounded-md overflow-hidden">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Cantidad</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-28">Precio</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-28">Costo</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">Total</th>
                                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase w-16">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {editFormData.items.map((item, index) => (
                                                <tr key={index}>
                                                    <td className="px-4 py-3 text-sm text-gray-900">{item.name}</td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={item.quantity}
                                                            onChange={(e) => handleUpdateItemQuantity(index, e.target.value)}
                                                            className="w-full text-right px-2 py-1 border rounded text-sm"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={item.price || 0}
                                                            onChange={(e) => handleUpdateItemPrice(index, e.target.value)}
                                                            className="w-full text-right px-2 py-1 border rounded text-sm"
                                                            disabled={editFormData.type === 'entry' || editFormData.type === 'exit'}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={item.cost || 0}
                                                            onChange={(e) => handleUpdateItemCost(index, e.target.value)}
                                                            className="w-full text-right px-2 py-1 border rounded text-sm"
                                                            disabled={editFormData.type === 'sale'}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-sm font-medium">
                                                        ${((editFormData.type === 'entry' || editFormData.type === 'exit' ? item.cost : item.price) * item.quantity).toFixed(2)}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => handleRemoveItem(index)}
                                                            className="text-red-500 hover:text-red-700 p-1"
                                                            title="Eliminar producto"
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

                            {/* Total */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-bold text-gray-900">Total</span>
                                    <span className="text-2xl font-black text-gray-900">
                                        ${(editFormData.type === 'entry' || editFormData.type === 'exit'
                                            ? editFormData.items.reduce((acc, item) => acc + (Number(item.cost || 0) * Number(item.quantity)), 0)
                                            : editFormData.items.reduce((acc, item) => acc + (Number(item.price || 0) * Number(item.quantity)), 0)
                                        ).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 sm:p-6 border-t bg-gray-50 flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={handleCloseEditModal}
                                className="flex-1 px-4 py-3 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 font-medium touch-manipulation"
                                disabled={savingEdit}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={savingEdit}
                                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium flex items-center justify-center touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {savingEdit ? (
                                    <>
                                        <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Actualizar Transacción
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
