import { useState, useEffect, useRef, useMemo } from "react";
import { Search, Plus, Minus, ArrowDownToLine, ArrowUpFromLine, Loader, Printer, Trash2, Package, X, Save, ChevronDown, ChevronUp } from "lucide-react";
import { getProducts, adjustStock, getNextCorrelativo, getSucursalesUsadas } from "../lib/db";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useRole } from "../hooks/useRole";
import ReceiptPrinter from "../components/ReceiptPrinter";

const todayISO = () => new Date().toISOString().split('T')[0];

export default function StockAdjustment() {
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [type, setType] = useState("entry");
    const [reference, setReference] = useState("");
    const [notes, setNotes] = useState("");
    const [sucursal, setSucursal] = useState("");
    const [sucursalesUsadas, setSucursalesUsadas] = useState([]);
    const [selectedDate, setSelectedDate] = useState(todayISO);
    const [processing, setProcessing] = useState(false);
    const [adjustmentItems, setAdjustmentItems] = useState([]);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);

    const { user } = useAuth();
    const { addToast } = useToast();
    const { isAdmin } = useRole();
    const printerRef = useRef();

    const isEntry = type === 'entry';

    useEffect(() => {
        const unsubscribe = getProducts((data) => setProducts(data));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        getSucursalesUsadas().then(setSucursalesUsadas);
    }, []);

    // Suggest the next reference number whenever the movement type changes.
    // The reference stays editable so the user can override it with a supplier
    // invoice number.
    useEffect(() => {
        let cancelled = false;
        getNextCorrelativo().then((next) => {
            if (!cancelled && next) setReference(next);
        });
        return () => { cancelled = true; };
    }, [type]);

    const filteredProducts = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return products.slice(0, 50);
        return products
            .filter(p =>
                p.name.toLowerCase().includes(term) ||
                (p.sku && p.sku.toLowerCase().includes(term))
            )
            .slice(0, 50);
    }, [products, searchTerm]);

    const alreadyAdded = selectedProduct
        ? adjustmentItems.some(i => i.productId === selectedProduct.id)
        : false;

    // Preview of the resulting stock for the product being captured
    const resultingStock = selectedProduct
        ? Number(selectedProduct.stock || 0) + (isEntry ? Number(quantity) : -Number(quantity))
        : null;

    const totalUnits = adjustmentItems.reduce((acc, i) => acc + Number(i.quantity), 0);

    const handleSelectProduct = (product) => {
        setSelectedProduct(product);
        setSearchTerm("");
        setQuantity(1);
    };

    const handleTypeChange = (nextType) => {
        if (nextType === type) return;
        setType(nextType);
        setSelectedProduct(null);
        // Items captured for one movement type should never carry over silently
        if (adjustmentItems.length > 0) {
            setAdjustmentItems([]);
            addToast(
                `Lista vaciada al cambiar a ${nextType === 'entry' ? 'entrada' : 'salida'}.`,
                "info"
            );
        }
    };

    const handleAddItem = () => {
        if (!isAdmin) {
            addToast("Solo los administradores pueden realizar ajustes de inventario.", "error");
            return;
        }
        if (!selectedProduct) return;

        if (adjustmentItems.some(i => i.productId === selectedProduct.id)) {
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

    const handleClearItems = () => {
        setAdjustmentItems([]);
        setSelectedProduct(null);
    };

    const handleSubmit = async (shouldPrint) => {
        if (!isAdmin) {
            addToast("Solo los administradores pueden realizar ajustes de inventario.", "error");
            return;
        }
        if (adjustmentItems.length === 0) {
            return addToast("La lista está vacía.", "error");
        }
        if (!reference.trim()) {
            return addToast("Ingresa un número de referencia.", "error");
        }
        if (!isEntry && !sucursal.trim()) {
            return addToast("Ingresa la sucursal de destino.", "error");
        }
        if (selectedDate > todayISO()) {
            return addToast("La fecha no puede ser futura.", "error");
        }

        const cleanSucursal = sucursal.trim();

        setProcessing(true);
        try {
            const fullNotes = !isEntry && cleanSucursal
                ? `Sucursal: ${cleanSucursal}${notes ? ` | ${notes}` : ''}`
                : notes;

            const transactionDate = selectedDate === todayISO()
                ? new Date()
                : new Date(selectedDate + 'T12:00:00');

            await adjustStock(
                adjustmentItems,
                type,
                user.uid,
                fullNotes,
                reference.trim(),
                transactionDate,
                (!isEntry && cleanSucursal) ? cleanSucursal : null
            );

            if (shouldPrint && printerRef.current) {
                printerRef.current.print({
                    items: adjustmentItems,
                    total: 0,
                    type: type.toUpperCase(),
                    date: transactionDate,
                    id: reference.trim(),
                    notes: fullNotes,
                    user: user.email
                });
            }

            setLastSaved({
                type,
                reference: reference.trim(),
                items: adjustmentItems,
                units: adjustmentItems.reduce((acc, i) => acc + Number(i.quantity), 0),
                sucursal: cleanSucursal
            });

            addToast(
                `${isEntry ? 'Entrada' : 'Salida'} ${reference.trim()} registrada.`,
                "success"
            );

            setAdjustmentItems([]);
            setSelectedProduct(null);
            setNotes("");
            // Keep sucursal and date so consecutive movements to the same
            // destination don't require retyping them.
            getNextCorrelativo().then((next) => { if (next) setReference(next); });
        } catch (error) {
            addToast("Error: " + error.message, "error");
        } finally {
            setProcessing(false);
        }
    };

    // Form fields JSX - defined as variable to avoid recreation
    // --- Sub-renders -----------------------------------------------------

    const typeToggleJSX = (
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-xl">
            <button
                type="button"
                onClick={() => handleTypeChange('entry')}
                aria-pressed={isEntry}
                className={`flex items-center justify-center gap-2 py-3 px-3 rounded-lg font-semibold text-sm transition-colors touch-manipulation ${isEntry
                    ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200'
                    : 'text-slate-500 hover:text-slate-800'
                    }`}
            >
                <ArrowDownToLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                Entrada
            </button>
            <button
                type="button"
                onClick={() => handleTypeChange('exit')}
                aria-pressed={!isEntry}
                className={`flex items-center justify-center gap-2 py-3 px-3 rounded-lg font-semibold text-sm transition-colors touch-manipulation ${!isEntry
                    ? 'bg-white text-rose-700 shadow-sm ring-1 ring-rose-200'
                    : 'text-slate-500 hover:text-slate-800'
                    }`}
            >
                <ArrowUpFromLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                Salida
            </button>
        </div>
    );

    const productPickerJSX = (
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5">
            <label htmlFor="product-search" className="block text-sm font-semibold text-slate-700 mb-2">
                Agregar productos
            </label>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" aria-hidden="true" />
                <input
                    id="product-search"
                    type="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    placeholder="Buscar por nombre o SKU..."
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg text-base focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Selected product capture card */}
            {selectedProduct && (
                <div className={`mt-3 rounded-lg border p-4 ${alreadyAdded
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-sky-200 bg-sky-50'
                    }`}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{selectedProduct.name}</p>
                            <p className="text-xs text-slate-500">
                                {selectedProduct.sku ? `SKU ${selectedProduct.sku} · ` : ''}
                                Stock actual {Number(selectedProduct.stock || 0)}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSelectedProduct(null)}
                            className="touch-target -my-2 -mr-2 text-slate-500 hover:text-slate-700 rounded-lg shrink-0"
                            aria-label="Quitar selección"
                        >
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>

                    {alreadyAdded ? (
                        <p className="text-sm text-amber-800">
                            Este producto ya está en la lista. Quítalo para cambiar la cantidad.
                        </p>
                    ) : (
                        <>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="touch-target border border-slate-300 rounded-lg bg-white active:bg-slate-200 hover:bg-slate-100 touch-manipulation"
                                    aria-label="Reducir cantidad"
                                >
                                    <Minus size={18} aria-hidden="true" />
                                </button>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    min="1"
                                    value={quantity}
                                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                    aria-label="Cantidad"
                                    className="flex-1 min-w-0 border border-slate-300 text-center rounded-lg py-2 text-lg font-semibold"
                                />
                                <button
                                    type="button"
                                    onClick={() => setQuantity(quantity + 1)}
                                    className="touch-target border border-slate-300 rounded-lg bg-white active:bg-slate-200 hover:bg-slate-100 touch-manipulation"
                                    aria-label="Aumentar cantidad"
                                >
                                    <Plus size={18} aria-hidden="true" />
                                </button>
                            </div>

                            <div className="mt-3 flex items-center justify-between text-sm">
                                <span className="text-slate-500">Stock resultante</span>
                                <span className={`font-bold text-base ${resultingStock < 0
                                    ? 'text-rose-600'
                                    : isEntry ? 'text-emerald-600' : 'text-rose-600'
                                    }`}>
                                    {resultingStock}
                                    {resultingStock < 0 && ' · stock insuficiente'}
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={handleAddItem}
                                className="mt-3 w-full py-3 bg-sky-600 text-white rounded-lg font-semibold hover:bg-sky-700 active:bg-sky-800 touch-manipulation"
                            >
                                Agregar a la lista
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Results list */}
            {!selectedProduct && (
                <div className="mt-3 max-h-72 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 divide-y divide-slate-100">
                    {filteredProducts.length === 0 ? (
                        <p className="p-4 text-center text-sm text-slate-500">
                            No se encontraron productos
                        </p>
                    ) : (
                        filteredProducts.map(product => (
                            <button
                                key={product.id}
                                type="button"
                                onClick={() => handleSelectProduct(product)}
                                className="w-full text-left p-3 hover:bg-slate-50 active:bg-slate-100 flex justify-between items-center gap-3 touch-manipulation"
                            >
                                <span className="min-w-0">
                                    <span className="block font-medium text-slate-900 truncate">{product.name}</span>
                                    <span className="block text-xs text-slate-500">
                                        {product.sku ? `SKU ${product.sku} · ` : ''}Stock {Number(product.stock || 0)}
                                    </span>
                                </span>
                                <Plus className="h-5 w-5 text-sky-600 shrink-0" aria-hidden="true" />
                            </button>
                        ))
                    )}
                </div>
            )}
        </section>
    );

    const itemsListJSX = (
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
                <h2 className="font-semibold text-slate-900">
                    Lista de {isEntry ? 'entrada' : 'salida'}
                    <span className="ml-2 text-sm font-normal text-slate-500">
                        {adjustmentItems.length} {adjustmentItems.length === 1 ? 'artículo' : 'artículos'} · {totalUnits} pzas
                    </span>
                </h2>
                {adjustmentItems.length > 0 && (
                    <button
                        type="button"
                        onClick={handleClearItems}
                        className="text-sm text-slate-500 hover:text-rose-600 px-2 py-1 rounded touch-manipulation"
                    >
                        Vaciar
                    </button>
                )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                {adjustmentItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10 px-4 text-center">
                        <Package size={40} className="mb-2 opacity-30" aria-hidden="true" />
                        <p className="text-sm">Aún no hay productos en esta lista</p>
                        <p className="text-xs mt-1">Búscalos arriba y agrégalos</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {adjustmentItems.map((item, idx) => {
                            const before = Number(item.currentStock || 0);
                            const after = before + (isEntry ? Number(item.quantity) : -Number(item.quantity));
                            return (
                                <li key={item.productId} className="p-3 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-medium text-slate-900 truncate">{item.name}</p>
                                        <p className="text-xs text-slate-500">
                                            {item.quantity} pzas ·{' '}
                                            <span className={after < 0 ? 'text-rose-600 font-semibold' : ''}>
                                                {before} → {after}
                                            </span>
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveItem(idx)}
                                        className="touch-target text-rose-600 bg-rose-50 active:bg-rose-200 hover:bg-rose-100 rounded-lg touch-manipulation shrink-0"
                                        aria-label={`Quitar ${item.name} de la lista`}
                                    >
                                        <Trash2 size={18} aria-hidden="true" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </section>
    );


    const detailsJSX = (
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <button
                type="button"
                onClick={() => setDetailsOpen(next => !next)}
                aria-expanded={detailsOpen}
                aria-controls="movement-details"
                className="w-full flex items-center justify-between px-4 py-3 text-left touch-manipulation hover:bg-slate-50"
            >
                <span className="min-w-0">
                    <span className="block font-semibold text-slate-900">Datos del movimiento</span>
                    <span className="block text-xs text-slate-500 truncate">
                        Ref. {reference || '—'} · {selectedDate}
                        {!isEntry && ` · ${sucursal || 'sin sucursal'}`}
                    </span>
                </span>
                {detailsOpen
                    ? <ChevronUp className="h-5 w-5 text-slate-400 shrink-0" aria-hidden="true" />
                    : <ChevronDown className="h-5 w-5 text-slate-400 shrink-0" aria-hidden="true" />}
            </button>

            {detailsOpen && (
                <div id="movement-details" className="px-4 pb-4 space-y-3 border-t border-slate-200 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="mov-date" className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                            <input
                                id="mov-date"
                                type="date"
                                max={todayISO()}
                                className="w-full border border-slate-300 rounded-lg p-3 text-base"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="mov-ref" className="block text-sm font-medium text-slate-700 mb-1">
                                No. Referencia
                            </label>
                            <input
                                id="mov-ref"
                                type="text"
                                autoComplete="off"
                                placeholder="ej. FAC-1234"
                                className="w-full border border-slate-300 rounded-lg p-3 text-base"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                            />
                        </div>
                    </div>

                    {!isEntry && (
                        <div>
                            <label htmlFor="mov-sucursal" className="block text-sm font-medium text-slate-700 mb-1">
                                Sucursal destino <span className="text-rose-500">*</span>
                            </label>
                            {/* datalist keeps free-text behaviour while surfacing names
                                already used, so typos don't split the catalog. */}
                            <input
                                id="mov-sucursal"
                                type="text"
                                autoComplete="off"
                                list="sucursales-usadas"
                                placeholder="ej. Sucursal Centro"
                                className="w-full border border-slate-300 rounded-lg p-3 text-base"
                                value={sucursal}
                                onChange={(e) => setSucursal(e.target.value)}
                            />
                            <datalist id="sucursales-usadas">
                                {sucursalesUsadas.map(name => (
                                    <option key={name} value={name} />
                                ))}
                            </datalist>
                        </div>
                    )}

                    <div>
                        <label htmlFor="mov-notes" className="block text-sm font-medium text-slate-700 mb-1">
                            Notas <span className="text-slate-400 font-normal">(opcional)</span>
                        </label>
                        <input
                            id="mov-notes"
                            type="text"
                            autoComplete="off"
                            placeholder="Comentarios adicionales..."
                            className="w-full border border-slate-300 rounded-lg p-3 text-base"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                </div>
            )}
        </section>
    );

    const actionBarJSX = (
        <div className="sticky bottom-0 mt-4 pt-3 pb-safe bg-slate-50/95 backdrop-blur border-t border-slate-200">
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <button
                    type="button"
                    onClick={() => handleSubmit(false)}
                    disabled={processing || adjustmentItems.length === 0 || !isAdmin}
                    className="py-3 px-5 rounded-lg font-semibold border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 touch-manipulation flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Sólo guardar
                </button>
                <button
                    type="button"
                    onClick={() => handleSubmit(true)}
                    disabled={processing || adjustmentItems.length === 0 || !isAdmin}
                    className={`py-3 px-6 rounded-lg text-white font-semibold touch-manipulation flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${isEntry
                        ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                        : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                        }`}
                >
                    {processing
                        ? <Loader className="h-4 w-4 animate-spin" aria-hidden="true" />
                        : <Printer className="h-4 w-4" aria-hidden="true" />}
                    {processing
                        ? 'Guardando...'
                        : `Registrar ${isEntry ? 'entrada' : 'salida'} e imprimir`}
                </button>
            </div>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto pb-4">
            <ReceiptPrinter ref={printerRef} />

            {/* Header */}
            <header className="mb-5">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Movimientos de inventario</h1>
                <p className="text-sm text-slate-500 mt-1">
                    {isEntry
                        ? 'Registra mercancía que llega al almacén.'
                        : 'Registra mercancía que sale hacia una sucursal.'}
                </p>
            </header>

            <div className="mb-4">
                {typeToggleJSX}
            </div>

            {/* Post-save confirmation */}
            {lastSaved && (
                <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <p className="font-semibold text-emerald-900">
                            {lastSaved.type === 'entry' ? 'Entrada' : 'Salida'} {lastSaved.reference} registrada
                        </p>
                        <p className="text-sm text-emerald-700">
                            {lastSaved.items.length} {lastSaved.items.length === 1 ? 'artículo' : 'artículos'} · {lastSaved.units} pzas
                            {lastSaved.sucursal && ` · ${lastSaved.sucursal}`}
                        </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => {
                                printerRef.current?.print({
                                    items: lastSaved.items,
                                    total: 0,
                                    type: lastSaved.type.toUpperCase(),
                                    date: new Date(),
                                    id: lastSaved.reference,
                                    notes: lastSaved.sucursal ? `Sucursal: ${lastSaved.sucursal}` : '',
                                    user: user.email
                                });
                            }}
                            className="py-2 px-4 rounded-lg border border-emerald-300 text-emerald-800 font-medium hover:bg-emerald-100 touch-manipulation"
                        >
                            Imprimir
                        </button>
                        <button
                            type="button"
                            onClick={() => setLastSaved(null)}
                            className="py-2 px-4 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 touch-manipulation"
                        >
                            Otro movimiento
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                    {productPickerJSX}
                    {detailsJSX}
                </div>
                <div className="flex flex-col">
                    {itemsListJSX}
                </div>
            </div>

            {actionBarJSX}
        </div>
    );
}
