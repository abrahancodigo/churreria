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
        <div className="surface-muted p-1.5 grid grid-cols-2 gap-1.5">
            <button
                type="button"
                onClick={() => handleTypeChange('entry')}
                aria-pressed={isEntry}
                className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-semibold text-sm transition-all touch-manipulation ${isEntry
                    ? 'bg-surface text-primary-700 shadow-card border border-primary-200'
                    : 'text-ink-500 hover:text-ink-800 hover:bg-ink-100/60 border border-transparent'
                    }`}
            >
                <ArrowDownToLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                Entrada
            </button>
            <button
                type="button"
                onClick={() => handleTypeChange('exit')}
                aria-pressed={!isEntry}
                className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-semibold text-sm transition-all touch-manipulation ${!isEntry
                    ? 'bg-surface text-danger-700 shadow-card border border-danger-200'
                    : 'text-ink-500 hover:text-ink-800 hover:bg-ink-100/60 border border-transparent'
                    }`}
            >
                <ArrowUpFromLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                Salida
            </button>
        </div>
    );

    const productPickerJSX = (
        <section className="surface p-4 sm:p-5">
            <label htmlFor="product-search" className="section-title block mb-3">
                Agregar productos
            </label>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" aria-hidden="true" />
                <input
                    id="product-search"
                    type="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    placeholder="Buscar por nombre o SKU..."
                    className="input-field pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Selected product capture card */}
            {selectedProduct && (
                <div className={`mt-3 rounded-2xl border p-4 ${alreadyAdded
                    ? 'border-warning-200 bg-warning-50'
                    : 'border-primary-200 bg-primary-50'
                    }`}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                            <p className="font-semibold text-ink-900 truncate">{selectedProduct.name}</p>
                            <p className="text-xs text-ink-500">
                                {selectedProduct.sku ? `SKU ${selectedProduct.sku} · ` : ''}
                                Stock actual {Number(selectedProduct.stock || 0)}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSelectedProduct(null)}
                            className="touch-target -my-2 -mr-2 text-ink-500 hover:text-ink-700 hover:bg-ink-100 rounded-lg shrink-0 transition-colors"
                            aria-label="Quitar selección"
                        >
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>

                    {alreadyAdded ? (
                        <div className="flex items-start gap-2 flex-wrap">
                            <span className="badge-warning shrink-0">Ya en la lista</span>
                            <p className="text-sm text-warning-700">
                                Este producto ya está en la lista. Quítalo para cambiar la cantidad.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="touch-target border border-ink-200 rounded-xl bg-surface active:bg-ink-100 hover:bg-ink-50 hover:border-ink-300 touch-manipulation transition-all"
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
                                    className="input-field flex-1 min-w-0 text-center text-lg font-semibold"
                                />
                                <button
                                    type="button"
                                    onClick={() => setQuantity(quantity + 1)}
                                    className="touch-target border border-ink-200 rounded-xl bg-surface active:bg-ink-100 hover:bg-ink-50 hover:border-ink-300 touch-manipulation transition-all"
                                    aria-label="Aumentar cantidad"
                                >
                                    <Plus size={18} aria-hidden="true" />
                                </button>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                                <span className="text-ink-500">Stock resultante</span>
                                <span className="flex items-center gap-2">
                                    {resultingStock < 0 && (
                                        <span className="badge-danger">Stock insuficiente</span>
                                    )}
                                    <span className={`font-bold text-base tabular-nums ${resultingStock < 0
                                        ? 'text-danger-700'
                                        : isEntry ? 'text-success-700' : 'text-danger-700'
                                        }`}>
                                        {resultingStock}
                                    </span>
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={handleAddItem}
                                className="btn-primary mt-3 w-full"
                            >
                                Agregar a la lista
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Results list */}
            {!selectedProduct && (
                <div className="mt-3 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-ink-200/70 divide-y divide-ink-100 custom-scrollbar">
                    {filteredProducts.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">
                                <Package className="h-6 w-6 text-ink-400" aria-hidden="true" />
                            </div>
                            <p className="text-sm font-medium text-ink-700">No se encontraron productos</p>
                        </div>
                    ) : (
                        filteredProducts.map(product => (
                            <button
                                key={product.id}
                                type="button"
                                onClick={() => handleSelectProduct(product)}
                                className="w-full text-left p-3 hover:bg-ink-50 active:bg-ink-100 flex justify-between items-center gap-3 touch-manipulation transition-colors"
                            >
                                <span className="min-w-0">
                                    <span className="block font-medium text-ink-900 truncate">{product.name}</span>
                                    <span className="block text-xs text-ink-500">
                                        {product.sku ? `SKU ${product.sku} · ` : ''}Stock {Number(product.stock || 0)}
                                    </span>
                                </span>
                                <Plus className="h-4 w-4 text-primary-600 shrink-0" aria-hidden="true" />
                            </button>
                        ))
                    )}
                </div>
            )}
        </section>
    );

    const itemsListJSX = (
        <section className="table-shell flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-ink-200/70 shrink-0">
                <h2 className="section-title">
                    Lista de {isEntry ? 'entrada' : 'salida'}
                    <span className="ml-2 text-sm font-normal text-ink-500">
                        {adjustmentItems.length} {adjustmentItems.length === 1 ? 'artículo' : 'artículos'} · {totalUnits} pzas
                    </span>
                </h2>
                {adjustmentItems.length > 0 && (
                    <button
                        type="button"
                        onClick={handleClearItems}
                        className="btn-ghost text-danger-600 hover:bg-danger-50 hover:text-danger-700"
                    >
                        Vaciar
                    </button>
                )}
            </div>

            <div className="table-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain">
                {adjustmentItems.length === 0 ? (
                    <div className="empty-state h-full">
                        <div className="empty-icon">
                            <Package className="h-6 w-6 text-ink-400" aria-hidden="true" />
                        </div>
                        <p className="text-sm font-medium text-ink-700">Aún no hay productos en esta lista</p>
                        <p className="text-xs text-ink-500 mt-1">Búscalos arriba y agrégalos</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-ink-100">
                        {adjustmentItems.map((item, idx) => {
                            const before = Number(item.currentStock || 0);
                            const after = before + (isEntry ? Number(item.quantity) : -Number(item.quantity));
                            return (
                                <li key={item.productId} className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-ink-50/80 transition-colors">
                                    <div className="min-w-0">
                                        <p className="font-medium text-ink-900 truncate">{item.name}</p>
                                        <p className="text-xs text-ink-500 mt-0.5">
                                            {item.quantity} pzas ·{' '}
                                            <span className={after < 0 ? 'text-danger-700 font-semibold tabular-nums' : 'tabular-nums'}>
                                                {before} → {after}
                                            </span>
                                            {after < 0 && (
                                                <span className="badge-danger ml-1.5 align-middle">Stock insuficiente</span>
                                            )}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveItem(idx)}
                                        className="touch-target text-danger-600 bg-danger-50 active:bg-danger-100 hover:bg-danger-100 rounded-xl touch-manipulation shrink-0 transition-colors"
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
        <section className="surface overflow-hidden">
            <button
                type="button"
                onClick={() => setDetailsOpen(next => !next)}
                aria-expanded={detailsOpen}
                aria-controls="movement-details"
                className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 text-left touch-manipulation hover:bg-ink-50/80 transition-colors"
            >
                <span className="min-w-0">
                    <span className="block section-title">Datos del movimiento</span>
                    <span className="block text-xs text-ink-500 truncate">
                        Ref. {reference || '—'} · {selectedDate}
                        {!isEntry && ` · ${sucursal || 'sin sucursal'}`}
                    </span>
                </span>
                {detailsOpen
                    ? <ChevronUp className="h-4 w-4 text-ink-400 shrink-0" aria-hidden="true" />
                    : <ChevronDown className="h-4 w-4 text-ink-400 shrink-0" aria-hidden="true" />}
            </button>

            {detailsOpen && (
                <div id="movement-details" className="px-4 sm:px-5 pb-5 space-y-4 border-t border-ink-200/70 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="mov-date" className="input-label">Fecha</label>
                            <input
                                id="mov-date"
                                type="date"
                                max={todayISO()}
                                className="input-field"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="mov-ref" className="input-label">
                                No. Referencia
                            </label>
                            <input
                                id="mov-ref"
                                type="text"
                                autoComplete="off"
                                placeholder="ej. FAC-1234"
                                className="input-field"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                            />
                        </div>
                    </div>

                    {!isEntry && (
                        <div>
                            <label htmlFor="mov-sucursal" className="input-label">
                                Sucursal destino <span className="text-danger-600">*</span>
                            </label>
                            {/* datalist keeps free-text behaviour while surfacing names
                                already used, so typos don't split the catalog. */}
                            <input
                                id="mov-sucursal"
                                type="text"
                                autoComplete="off"
                                list="sucursales-usadas"
                                placeholder="ej. Sucursal Centro"
                                className="input-field"
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
                        <label htmlFor="mov-notes" className="input-label">
                            Notas <span className="text-ink-400 font-normal normal-case tracking-normal">(opcional)</span>
                        </label>
                        <input
                            id="mov-notes"
                            type="text"
                            autoComplete="off"
                            placeholder="Comentarios adicionales..."
                            className="input-field"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                </div>
            )}
        </section>
    );

    const actionBarJSX = (
        <div className="sticky bottom-0 mt-4 pt-3 pb-safe bg-surface/95 backdrop-blur-sm border-t border-ink-200/70">
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <button
                    type="button"
                    onClick={() => handleSubmit(false)}
                    disabled={processing || adjustmentItems.length === 0 || !isAdmin}
                    className="btn-secondary py-3"
                >
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Sólo guardar
                </button>
                <button
                    type="button"
                    onClick={() => handleSubmit(true)}
                    disabled={processing || adjustmentItems.length === 0 || !isAdmin}
                    className={`btn-primary py-3 ${isEntry ? '' : 'btn-danger'}`}
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
        <div className="max-w-6xl mx-auto pb-4 space-y-6">
            <ReceiptPrinter ref={printerRef} />

            {/* Header */}
            <header className="page-header">
                <div>
                    <h1 className="page-title">Movimientos de inventario</h1>
                    <p className="page-subtitle">
                        {isEntry
                            ? 'Registra mercancía que llega al almacén.'
                            : 'Registra mercancía que sale hacia una sucursal.'}
                    </p>
                </div>
            </header>

            {typeToggleJSX}

            {/* Post-save confirmation */}
            {lastSaved && (
                <div className="rounded-2xl border border-success-200 bg-success-50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <p className="font-semibold text-success-700">
                            {lastSaved.type === 'entry' ? 'Entrada' : 'Salida'} {lastSaved.reference} registrada
                        </p>
                        <p className="text-sm text-success-700">
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
                            className="btn-secondary"
                        >
                            Imprimir
                        </button>
                        <button
                            type="button"
                            onClick={() => setLastSaved(null)}
                            className="btn-primary"
                        >
                            Otro movimiento
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
