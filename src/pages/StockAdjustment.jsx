import { useState, useEffect, useMemo, useRef } from "react";
import { Search, Plus, Minus, Trash2, ArrowDownToLine, ArrowUpFromLine, Loader, Printer, Package, PackageX, X, Save, Store, Check } from "lucide-react";
import { getProducts } from "../services/productService";
import { adjustStock, getNextCorrelativo, getSucursalesUsadas } from "../services/movementService";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useRole } from "../hooks/useRole";
import ReceiptPrinter from "../components/ReceiptPrinter";

const todayISO = () => new Date().toISOString().split('T')[0];

export default function StockAdjustment() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [type, setType] = useState("entry");
    const [reference, setReference] = useState("");
    const [notes, setNotes] = useState("");
    const [sucursal, setSucursal] = useState("");
    const [sucursalesUsadas, setSucursalesUsadas] = useState([]);
    const [selectedDate, setSelectedDate] = useState(todayISO);
    const [processing, setProcessing] = useState(false);
    const [adjustmentItems, setAdjustmentItems] = useState([]);
    const [lastSaved, setLastSaved] = useState(null);

    const { user } = useAuth();
    const { addToast } = useToast();
    const { isAdmin } = useRole();
    const printerRef = useRef();

    const isEntry = type === 'entry';

    useEffect(() => {
        const unsubscribe = getProducts((data) => {
            setProducts(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        getSucursalesUsadas().then(setSucursalesUsadas);
    }, []);

    useEffect(() => {
        let cancelled = false;
        getNextCorrelativo().then((next) => {
            if (!cancelled && next) setReference(next);
        });
        return () => { cancelled = true; };
    }, [type]);

    const filteredProducts = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return products.slice(0, 60);
        return products
            .filter(p =>
                p.name.toLowerCase().includes(term) ||
                (p.sku && p.sku.toLowerCase().includes(term))
            )
            .slice(0, 60);
    }, [products, searchTerm]);

    const totalUnits = adjustmentItems.reduce((acc, i) => acc + Number(i.quantity), 0);

    const stockBadge = (stock) => {
        if (stock > 50) return "badge-success";
        if (stock > 10) return "badge-warning";
        return "badge-danger";
    };

    const handleTypeChange = (nextType) => {
        if (nextType === type) return;
        setType(nextType);
        if (adjustmentItems.length > 0) {
            setAdjustmentItems([]);
            addToast(
                `Lista vaciada al cambiar a ${nextType === 'entry' ? 'entrada' : 'salida'}.`,
                "info"
            );
        }
    };

    const handleAddItem = (product) => {
        if (!isAdmin) {
            addToast("Solo los administradores pueden realizar ajustes de inventario.", "error");
            return;
        }
        const stock = Number(product.stock || 0);
        const existing = adjustmentItems.find(i => i.productId === product.id);
        if (existing) {
            if (!isEntry && existing.quantity + 1 > stock) {
                addToast(`Stock máximo alcanzado (${stock})`, "error");
                return;
            }
            setAdjustmentItems(prev => prev.map(i =>
                i.productId === product.id ? { ...i, quantity: Number(i.quantity) + 1 } : i
            ));
            return;
        }
        if (!isEntry && stock < 1) {
            addToast("¡Sin Stock!", "error");
            return;
        }
        setAdjustmentItems(prev => [...prev, {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            quantity: 1,
            price: Number(product.price),
            cost: Number(product.cost || 0),
            currentStock: product.stock
        }]);
    };

    const updateItemQty = (productId, delta) => {
        setAdjustmentItems(prev => prev.map(item => {
            if (item.productId !== productId) return item;
            const product = products.find(p => p.id === productId);
            const stock = Number(product?.stock ?? item.currentStock ?? 0);
            const next = Number(item.quantity) + delta;
            if (next < 1) return item;
            if (!isEntry && next > stock) {
                addToast(`Stock máximo alcanzado (${stock})`, "error");
                return item;
            }
            return { ...item, quantity: next };
        }));
    };

    const setItemQty = (productId, value) => {
        const qty = parseInt(value) || 1;
        setAdjustmentItems(prev => prev.map(item => {
            if (item.productId !== productId) return item;
            const product = products.find(p => p.id === productId);
            const stock = Number(product?.stock ?? item.currentStock ?? 0);
            if (!isEntry && qty > stock) {
                addToast(`Stock máximo: ${stock}`, "error");
                return { ...item, quantity: stock };
            }
            return { ...item, quantity: Math.max(1, qty) };
        }));
    };

    const handleRemoveItem = (index) => {
        setAdjustmentItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (shouldPrint) => {
        if (!isAdmin) {
            addToast("Solo los administradores pueden realizar ajustes de inventario.", "error");
            return;
        }
        if (!user) {
            addToast("Inicia sesión de nuevo.", "error");
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
            setNotes("");
            getNextCorrelativo().then((next) => { if (next) setReference(next); });
        } catch (error) {
            addToast("Error: " + error.message, "error");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="space-y-4 sm:space-y-5 pb-4">
            <ReceiptPrinter ref={printerRef} />

            <header className="page-header">
                <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary-700">Almacén</p>
                    <h1 className="page-title">Movimientos</h1>
                    <p className="page-subtitle">
                        {isEntry
                            ? 'Mercancía que llega al almacén.'
                            : 'Mercancía que sale hacia una sucursal.'}
                    </p>
                </div>
                {adjustmentItems.length > 0 && (
                    <span className="badge-primary tabular-nums self-start sm:self-auto !px-3 !py-1.5 !text-xs">
                        {adjustmentItems.length} {adjustmentItems.length === 1 ? 'artículo' : 'artículos'} · {totalUnits} pzas
                    </span>
                )}
            </header>

            {lastSaved && (
                <div className="rounded-2xl border border-success-200 bg-success-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3 animate-scale-in">
                    <span className="stat-icon bg-success-100 text-success-700 shrink-0">
                        <Check className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-success-700">
                            {lastSaved.type === 'entry' ? 'Entrada' : 'Salida'} {lastSaved.reference} registrada
                        </p>
                        <p className="text-sm text-success-700 tabular-nums">
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
                                    user: user?.email
                                });
                            }}
                            className="btn-secondary"
                        >
                            <Printer className="h-4 w-4" aria-hidden="true" />
                            Imprimir
                        </button>
                        <button
                            type="button"
                            onClick={() => setLastSaved(null)}
                            className="btn-primary"
                        >
                            Nuevo
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-3" role="group" aria-label="Tipo de movimiento">
                <button
                    type="button"
                    onClick={() => handleTypeChange('entry')}
                    aria-pressed={isEntry}
                    className={`flex items-center gap-3 rounded-2xl border p-3.5 sm:p-4 text-left transition-all touch-manipulation ${isEntry
                        ? 'border-success-300 bg-success-50 shadow-card'
                        : 'border-ink-200/70 bg-surface hover:border-success-200 hover:bg-success-50/50'
                        }`}
                >
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isEntry ? 'bg-success-100 text-success-700' : 'bg-ink-100 text-ink-500'}`}>
                        <ArrowDownToLine className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                        <span className={`block text-sm font-bold ${isEntry ? 'text-success-800' : 'text-ink-700'}`}>Entrada</span>
                        <span className="block text-xs text-ink-500 truncate">llega al almacén</span>
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => handleTypeChange('exit')}
                    aria-pressed={!isEntry}
                    className={`flex items-center gap-3 rounded-2xl border p-3.5 sm:p-4 text-left transition-all touch-manipulation ${!isEntry
                        ? 'border-warning-300 bg-warning-50 shadow-card'
                        : 'border-ink-200/70 bg-surface hover:border-warning-200 hover:bg-warning-50/50'
                        }`}
                >
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${!isEntry ? 'bg-warning-100 text-warning-700' : 'bg-ink-100 text-ink-500'}`}>
                        <ArrowUpFromLine className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                        <span className={`block text-sm font-bold ${!isEntry ? 'text-warning-800' : 'text-ink-700'}`}>Salida</span>
                        <span className="block text-xs text-ink-500 truncate">hacia sucursal</span>
                    </span>
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 sm:gap-5 lg:items-start">
                <section className="surface flex-1 min-w-0 flex flex-col overflow-hidden" aria-label="Catálogo de productos">
                    <div className="p-4 sm:p-5 pb-3">
                        <div className="flex items-end justify-between gap-3 mb-3">
                            <div>
                                <h2 className="section-title">Toca para agregar</h2>
                                <p className="text-xs text-ink-500 mt-0.5">{products.length} productos</p>
                            </div>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" aria-hidden="true" />
                            <input
                                type="search"
                                autoComplete="off"
                                enterKeyHint="search"
                                aria-label="Buscar producto por nombre o SKU"
                                placeholder="Buscar por nombre o SKU..."
                                className="input-field pl-9 pr-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 btn-icon h-8 w-8 rounded-lg"
                                    aria-label="Limpiar búsqueda"
                                >
                                    <X className="h-4 w-4" aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="px-4 sm:px-5 pb-4 sm:pb-5 min-h-0">
                        {loading ? (
                            <div className="flex items-center justify-center py-14 text-sm text-ink-500">
                                <span className="h-5 w-5 border-2 border-ink-300 border-t-ink-700 rounded-full animate-spin mr-3" />
                                Cargando productos...
                            </div>
                        ) : filteredProducts.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">
                                    <PackageX className="h-6 w-6 text-ink-400" aria-hidden="true" />
                                </div>
                                <p className="text-sm font-medium text-ink-700">Sin resultados</p>
                                <p className="text-xs text-ink-500 mt-1">No hay productos que coincidan con "{searchTerm}".</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[420px] lg:max-h-[560px] overflow-y-auto custom-scrollbar pr-0.5">
                                {filteredProducts.map((product) => {
                                    const stock = Number(product.stock || 0);
                                    const disabled = !isEntry && stock < 1;
                                    const inList = adjustmentItems.some(i => i.productId === product.id);
                                    return (
                                        <button
                                            key={product.id}
                                            type="button"
                                            onClick={() => handleAddItem(product)}
                                            disabled={disabled}
                                            className={`group flex flex-col p-3 rounded-2xl border text-left transition-all touch-manipulation active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 ${inList
                                                ? isEntry ? 'border-success-300 bg-success-50' : 'border-warning-300 bg-warning-50'
                                                : 'border-ink-200/70 bg-ink-50/50 hover:border-primary-300 hover:bg-surface hover:shadow-card'
                                                }`}
                                        >
                                            <span className="flex items-center justify-between gap-2 mb-2">
                                                <span className={`tabular-nums inline-flex items-baseline gap-1 ${stockBadge(stock)} !px-2 !py-1`}>
                                                    <span className="text-base font-extrabold leading-none">{stock}</span>
                                                    <span className="text-[9px] font-bold uppercase tracking-wider opacity-75 leading-none">
                                                        {stock === 1 ? 'unidad' : 'unidades'}
                                                    </span>
                                                </span>
                                                <Plus className="h-4 w-4 text-ink-300 group-hover:text-primary-600 shrink-0 transition-colors" aria-hidden="true" />
                                            </span>
                                            <span className="w-full truncate text-sm font-semibold leading-snug text-ink-900" title={product.name}>{product.name}</span>
                                            <span className="mt-0.5 truncate text-[11px] text-ink-500 tabular-nums">
                                                {product.sku ? `SKU ${product.sku}` : 'Sin SKU'}
                                            </span>
                                            {inList && (
                                                <span className={`mt-2 text-[11px] font-semibold ${isEntry ? 'text-success-700' : 'text-warning-700'}`}>
                                                    En la lista · toca para +1
                                                </span>
                                            )}
                                            {disabled && (
                                                <span className="mt-2 text-[11px] font-semibold text-danger-600">Agotado</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>

                <section className="surface w-full lg:w-[24rem] shrink-0 flex flex-col overflow-hidden lg:sticky lg:top-0" aria-label="Movimiento actual">
                    <div className="flex items-center justify-between gap-3 px-4 sm:px-5 h-14 border-b border-ink-200/70 shrink-0">
                        <h2 className="section-title flex items-center gap-2">
                            {isEntry
                                ? <ArrowDownToLine className="h-4 w-4 text-success-600" aria-hidden="true" />
                                : <ArrowUpFromLine className="h-4 w-4 text-warning-600" aria-hidden="true" />}
                            {isEntry ? 'Entrada' : 'Salida'} actual
                            {totalUnits > 0 && (
                                <span className={isEntry ? "badge-success tabular-nums" : "badge-warning tabular-nums"}>{totalUnits}</span>
                            )}
                        </h2>
                        {adjustmentItems.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setAdjustmentItems([])}
                                className="btn-ghost text-danger-600 hover:bg-danger-50 hover:text-danger-700 !px-2.5"
                            >
                                Vaciar
                            </button>
                        )}
                    </div>

                    <div className="p-4 sm:p-5 space-y-3.5 border-b border-ink-200/70 shrink-0">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="mov-ref" className="input-label">No. Referencia</label>
                                <input
                                    id="mov-ref"
                                    type="text"
                                    autoComplete="off"
                                    placeholder="ej. 0007"
                                    className="input-field tabular-nums"
                                    value={reference}
                                    onChange={(e) => setReference(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="mov-date" className="input-label">Fecha</label>
                                <input
                                    id="mov-date"
                                    type="date"
                                    max={todayISO()}
                                    className="input-field tabular-nums"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                />
                            </div>
                        </div>

                        {!isEntry && (
                            <div>
                                <label htmlFor="mov-sucursal" className="input-label">
                                    <span className="inline-flex items-center gap-1"><Store className="h-3.5 w-3.5" aria-hidden="true" /> Sucursal destino <span className="text-danger-600">*</span></span>
                                </label>
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
                                Notas <span className="text-ink-400 font-normal">(opcional)</span>
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

                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-2 lg:max-h-[380px]">
                        {adjustmentItems.length === 0 ? (
                            <div className="empty-state py-10">
                                <div className="empty-icon">
                                    <Package className="h-6 w-6 text-ink-400" aria-hidden="true" />
                                </div>
                                <p className="text-sm font-medium text-ink-700">Lista vacía</p>
                                <p className="text-xs text-ink-500 mt-1">Toca un producto para agregarlo.</p>
                            </div>
                        ) : (
                            adjustmentItems.map((item, idx) => {
                                const before = Number(item.currentStock || 0);
                                const after = before + (isEntry ? Number(item.quantity) : -Number(item.quantity));
                                const negative = after < 0;
                                return (
                                    <div key={item.productId} className="rounded-2xl border border-ink-200/70 bg-ink-50/60 p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-ink-900 truncate" title={item.name}>{item.name}</p>
                                                <p className="text-xs text-ink-500 tabular-nums mt-0.5">
                                                    {item.sku ? `SKU ${item.sku} · ` : ''}{before} → <span className={negative ? 'text-danger-700 font-bold' : 'font-semibold text-ink-800'}>{after}</span> {negative && <span className="badge-danger ml-1 align-middle">sin stock</span>}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(idx)}
                                                className="touch-target rounded-lg text-danger-600 hover:bg-danger-50 active:bg-danger-100 shrink-0 transition-colors"
                                                aria-label={`Quitar ${item.name} de la lista`}
                                            >
                                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                            </button>
                                        </div>
                                        <div className="mt-2.5 flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => updateItemQty(item.productId, -1)}
                                                className="touch-target rounded-xl border border-ink-200 bg-surface hover:bg-ink-100 active:bg-ink-200 transition-colors"
                                                aria-label={`Quitar una unidad de ${item.name}`}
                                            >
                                                <Minus className="h-4 w-4" aria-hidden="true" />
                                            </button>
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => setItemQty(item.productId, e.target.value)}
                                                aria-label={`Cantidad de ${item.name}`}
                                                className="w-full min-w-0 text-center rounded-xl border border-ink-200 bg-elevated px-2 py-2 text-base font-bold text-ink-900 tabular-nums focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => updateItemQty(item.productId, 1)}
                                                className="touch-target rounded-xl border border-ink-200 bg-surface hover:bg-ink-100 active:bg-ink-200 transition-colors"
                                                aria-label={`Añadir una unidad de ${item.name}`}
                                            >
                                                <Plus className="h-4 w-4" aria-hidden="true" />
                                            </button>
                                            <span className="text-xs text-ink-500 tabular-nums shrink-0 w-14 text-right">pzas</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="shrink-0 p-4 border-t border-ink-200/70 space-y-3 pb-safe bg-surface">
                        <div className="bg-ink-100/70 rounded-2xl px-4 py-3 flex justify-between items-baseline gap-3">
                            <span className="text-sm font-medium text-ink-600">
                                {adjustmentItems.length} {adjustmentItems.length === 1 ? 'artículo' : 'artículos'}
                            </span>
                            <span className="text-xl font-extrabold text-ink-900 tabular-nums">{totalUnits} <span className="text-xs font-semibold text-ink-500">pzas</span></span>
                        </div>
                        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-2">
                            <button
                                type="button"
                                onClick={() => handleSubmit(false)}
                                disabled={processing || adjustmentItems.length === 0 || !isAdmin}
                                className="btn-secondary flex-1 py-3"
                            >
                                <Save className="h-4 w-4" aria-hidden="true" />
                                Guardar
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSubmit(true)}
                                disabled={processing || adjustmentItems.length === 0 || !isAdmin}
                                className={`${isEntry ? 'btn-primary' : 'btn-danger'} flex-1 py-3`}
                            >
                                {processing
                                    ? <Loader className="h-4 w-4 animate-spin" aria-hidden="true" />
                                    : <Printer className="h-4 w-4" aria-hidden="true" />}
                                {processing ? 'Guardando...' : 'Registrar e imprimir'}
                            </button>
                        </div>
                        {!isAdmin && (
                            <p className="text-xs text-center text-ink-500">Solo los administradores pueden registrar movimientos.</p>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
