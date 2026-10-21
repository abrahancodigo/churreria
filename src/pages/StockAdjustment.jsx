import { useState, useEffect, useRef } from "react";
import { Search, Plus, Minus, ArrowRightLeft, Loader, Printer, Trash2, Package, X, ShoppingCart } from "lucide-react";
import { getProducts, adjustStock, getNextCorrelativo } from "../lib/db";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useRole } from "../hooks/useRole";
import ReceiptPrinter from "../components/ReceiptPrinter";

export default function StockAdjustment() {
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [type, setType] = useState("entry");
    const [reference, setReference] = useState("");
    const [notes, setNotes] = useState("");
    const [sucursal, setSucursal] = useState("");
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [processing, setProcessing] = useState(false);
    const [adjustmentItems, setAdjustmentItems] = useState([]);
    const [isListOpen, setIsListOpen] = useState(false);

    const { user } = useAuth();
    const { addToast } = useToast();
    const { isAdmin } = useRole();
    const printerRef = useRef();

    useEffect(() => {
        const unsubscribe = getProducts((data) => setProducts(data));
        return () => unsubscribe();
    }, []);

    // Effect to auto-suggest reference for exits based on sucursal
    // Solo auto-sugerir si el usuario NO ha escrito nada en el campo referencia
    useEffect(() => {
        const fetchCorrelativo = async () => {
            if (type === 'exit' && sucursal && !reference) {
                // Solo sugerir correlativo si el campo está vacío
                const nextRef = await getNextCorrelativo(sucursal, 'exit');
                if (nextRef) {
                    setReference(nextRef);
                }
            } else if (type === 'entry') {
                setReference("");
            }
        };
        fetchCorrelativo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type, sucursal]);

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleSelectProduct = (product) => {
        setSelectedProduct(product);
        setSearchTerm("");
        setQuantity(1);
    };

    const handleAddItem = () => {
        if (!isAdmin) {
            addToast("Solo los administradores pueden realizar ajustes de inventario.", "error");
            return;
        }
        if (!selectedProduct) return;

        const existing = adjustmentItems.find(i => i.productId === selectedProduct.id);
        if (existing) {
            addToast("El producto ya está en la lista.", "error");
            return;
        }

        setAdjustmentItems([...adjustmentItems, {
            productId: selectedProduct.id,
            name: selectedProduct.name,
            sku: selectedProduct.sku,
            quantity: Number(quantity),
            price: Number(selectedProduct.price),
            cost: Number(selectedProduct.cost || 0),
            currentStock: selectedProduct.stock
        }]);

        setSelectedProduct(null);
        setQuantity(1);
    };

    const handleRemoveItem = (index) => {
        const newItems = [...adjustmentItems];
        newItems.splice(index, 1);
        setAdjustmentItems(newItems);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isAdmin) {
            addToast("Solo los administradores pueden realizar ajustes de inventario.", "error");
            return;
        }
        if (adjustmentItems.length === 0) {
            return addToast("La lista está vacía.", "error");
        }
        if (!reference) {
            return addToast("Ingresa un número de referencia.", "error");
        }
        if (type === 'exit' && !sucursal) {
            return addToast("Ingresa la sucursal de destino.", "error");
        }

        setProcessing(true);
        try {
            const fullNotes = type === 'exit' && sucursal
                ? `Sucursal: ${sucursal}${notes ? ` | ${notes}` : ''}`
                : notes;

            const todayStr = new Date().toISOString().split('T')[0];
            const transactionDate = selectedDate === todayStr ? new Date() : new Date(selectedDate + 'T12:00:00');

            await adjustStock(adjustmentItems, type, user.uid, fullNotes, reference, transactionDate, sucursal);

            if (printerRef.current) {
                printerRef.current.print({
                    items: adjustmentItems,
                    total: 0,
                    type: type.toUpperCase(),
                    date: transactionDate,
                    id: reference,
                    notes: fullNotes,
                    user: user.email
                });
            }

            addToast(`¡Movimiento de ${type === 'entry' ? 'entrada' : 'salida'} registrado!`);
            setAdjustmentItems([]);
            setReference("");
            setNotes("");
            setSucursal("");
            setSelectedDate(new Date().toISOString().split('T')[0]);
            setIsListOpen(false);
        } catch (error) {
            addToast("Error: " + error.message, "error");
        } finally {
            setProcessing(false);
        }
    };

    // Form fields JSX - defined as variable to avoid recreation
    const formFieldsJSX = (
        <div className="border-t pt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                        <input
                            type="date"
                            className="w-full border rounded-md p-3 text-base"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">No. Referencia *</label>
                        <input
                            type="text"
                            placeholder="ej. FAC-1234"
                            className="w-full border rounded-md p-3 text-base"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                        />
                    </div>
                </div>

                {type === 'exit' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal Destino *</label>
                        <input
                            type="text"
                            placeholder="ej. Sucursal Centro, Sucursal Norte..."
                            className="w-full border rounded-md p-3 text-base"
                            value={sucursal}
                            onChange={(e) => setSucursal(e.target.value)}
                        />
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notas (Opcional)</label>
                    <input
                        type="text"
                        placeholder="Comentarios adicionales..."
                        className="w-full border rounded-md p-3 text-base"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </div>
            </div>

            <button
                onClick={handleSubmit}
                disabled={processing || adjustmentItems.length === 0}
                className={`w-full py-3 px-4 rounded-md text-white font-bold text-lg shadow-sm flex justify-center items-center touch-manipulation ${type === 'entry' ? 'bg-green-600 hover:bg-green-700 active:bg-green-800' : 'bg-red-600 hover:bg-red-700 active:bg-red-800'} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                {processing ? <Loader className="animate-spin" /> : <Printer className="mr-2" />}
                CONFIRMAR Y GUARDAR
            </button>
        </div>
    );

    // Items list JSX
    const itemsListJSX = (
        <div className="flex-1 overflow-y-auto border rounded-md mb-4">
            {adjustmentItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                    <Package size={48} className="mb-2 opacity-20" />
                    <p>No hay productos en la lista</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-200">
                    {adjustmentItems.map((item, idx) => (
                        <div key={item.productId} className="p-3 flex justify-between items-center">
                            <div>
                                <p className="font-medium text-gray-900">{item.name}</p>
                                <p className="text-sm text-gray-500">Cantidad: {item.quantity}</p>
                            </div>
                            <button
                                onClick={() => handleRemoveItem(idx)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-md touch-manipulation"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto">
            <ReceiptPrinter ref={printerRef} />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
                    <ArrowRightLeft className="mr-2 h-5 w-5 sm:h-6 sm:w-6" /> Movimientos
                </h1>
                <div className="flex bg-gray-100 p-1 rounded-lg self-start sm:self-auto">
                    <button
                        onClick={() => setType('entry')}
                        className={`px-4 py-2 rounded-md font-medium text-sm transition-colors touch-manipulation ${type === 'entry' ? 'bg-white text-green-700 shadow' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                        ENTRADA
                    </button>
                    <button
                        onClick={() => setType('exit')}
                        className={`px-4 py-2 rounded-md font-medium text-sm transition-colors touch-manipulation ${type === 'exit' ? 'bg-white text-red-700 shadow' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                        SALIDA
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Product Selection */}
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow flex flex-col min-h-[400px] lg:h-[600px]">
                    <h2 className="text-lg font-medium mb-4">1. Buscar Producto</h2>
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o SKU..."
                            className="w-full pl-10 pr-4 py-3 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-base"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto border rounded-md divide-y mb-4 max-h-[250px] lg:max-h-none">
                        {filteredProducts.map(product => (
                            <div
                                key={product.id}
                                onClick={() => handleSelectProduct(product)}
                                className={`p-3 cursor-pointer hover:bg-gray-50 flex justify-between items-center touch-manipulation ${selectedProduct?.id === product.id ? 'bg-blue-50 ring-2 ring-blue-500 ring-inset' : ''}`}
                            >
                                <div>
                                    <div className="font-medium">{product.name}</div>
                                    <div className="text-xs text-gray-500">Stock: {product.stock}</div>
                                </div>
                                <Plus className="h-4 w-4 text-blue-500" />
                            </div>
                        ))}
                        {filteredProducts.length === 0 && (
                            <div className="p-4 text-center text-gray-500">
                                No se encontraron productos
                            </div>
                        )}
                    </div>

                    {selectedProduct && (
                        <div className="p-4 bg-gray-50 rounded-md border border-blue-100">
                            <div className="font-bold text-gray-900 mb-2">{selectedProduct.name}</div>
                            <div className="flex items-center mb-3">
                                <label className="text-sm mr-3">Cantidad:</label>
                                <button
                                    type="button"
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="p-2 border rounded bg-white hover:bg-gray-100 touch-manipulation"
                                >
                                    <Minus size={16} />
                                </button>
                                <input
                                    type="number"
                                    min="1"
                                    value={quantity}
                                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-16 border mx-2 text-center rounded p-2 text-base"
                                />
                                <button
                                    type="button"
                                    onClick={() => setQuantity(quantity + 1)}
                                    className="p-2 border rounded bg-white hover:bg-gray-100 touch-manipulation"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                            <button
                                onClick={handleAddItem}
                                className="w-full py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 active:bg-blue-800 touch-manipulation"
                            >
                                Agregar a la Lista
                            </button>
                        </div>
                    )}
                </div>

                {/* Desktop List View - Inline JSX */}
                <div className="hidden lg:flex lg:col-span-2 lg:h-[600px]">
                    <div className="flex flex-col h-full w-full bg-white p-6 rounded-lg shadow">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-medium">
                                Lista de {type === 'entry' ? 'Entrada' : 'Salida'}
                            </h2>
                            <span className="text-sm text-gray-500">{adjustmentItems.length} items</span>
                        </div>
                        {itemsListJSX}
                        {formFieldsJSX}
                    </div>
                </div>
            </div>

            {/* Mobile List Button */}
            <button
                onClick={() => setIsListOpen(true)}
                className="lg:hidden fixed bottom-4 right-4 z-30 bg-blue-600 text-white px-5 py-4 rounded-full shadow-lg flex items-center space-x-2 active:scale-95 touch-manipulation"
            >
                <ShoppingCart className="h-6 w-6" />
                {adjustmentItems.length > 0 && (
                    <span className="bg-white text-blue-600 rounded-full px-2 py-0.5 text-sm font-bold min-w-[24px] text-center">
                        {adjustmentItems.length}
                    </span>
                )}
            </button>

            {/* Mobile List Modal - Inline JSX */}
            {isListOpen && (
                <div className="lg:hidden fixed inset-0 z-50" onClick={() => setIsListOpen(false)}>
                    <div className="absolute inset-0 bg-black bg-opacity-50" />
                    <div
                        className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-xl max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-center py-2">
                            <div className="w-12 h-1 bg-gray-300 rounded-full" />
                        </div>
                        <div className="p-4 flex-1 overflow-hidden flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-medium">
                                    Lista de {type === 'entry' ? 'Entrada' : 'Salida'}
                                </h2>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-500">{adjustmentItems.length} items</span>
                                    <button
                                        onClick={() => setIsListOpen(false)}
                                        className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                            {itemsListJSX}
                            {formFieldsJSX}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
