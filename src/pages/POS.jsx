import { useState, useEffect, useMemo, useRef } from "react";
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, Loader, X, PackageX, Flame } from "lucide-react";
import { getProducts, adjustStock } from "../lib/db";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ReceiptPrinter from "../components/ReceiptPrinter";
import { formatCurrency } from "../lib/formatters";

export default function POS() {
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [reference, setReference] = useState("");
    const [isCartOpen, setIsCartOpen] = useState(false);
    const printerRef = useRef();

    const { user } = useAuth();
    const { addToast } = useToast();

    useEffect(() => {
        const unsubscribe = getProducts((data) => {
            setProducts(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const filteredProducts = useMemo(() => {
        return products.filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [products, searchTerm]);

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                if (existing.qty + 1 > product.stock) {
                    addToast(`Stock insuficiente. Solo quedan ${product.stock}.`, "error");
                    return prev;
                }
                return prev.map(item =>
                    item.id === product.id ? { ...item, qty: item.qty + 1 } : item
                );
            }
            if (product.stock < 1) {
                addToast("¡Sin Stock!", "error");
                return prev;
            }
            return [...prev, { ...product, qty: 1 }];
        });
    };

    const updateQty = (productId, delta) => {
        setCart(prev => prev.map(item => {
            if (item.id === productId) {
                const product = products.find(p => p.id === productId);
                const newQty = item.qty + delta;

                if (newQty > product.stock) {
                    addToast(`Stock máximo alcanzado (${product.stock})`, "error");
                    return item;
                }
                return { ...item, qty: Math.max(1, newQty) };
            }
            return item;
        }));
    };

    const setManualQty = (productId, value) => {
        const qty = parseInt(value) || 1;
        setCart(prev => prev.map(item => {
            if (item.id === productId) {
                const product = products.find(p => p.id === productId);
                if (qty > product.stock) {
                    addToast(`Stock máximo: ${product.stock}`, "error");
                    return { ...item, qty: product.stock };
                }
                return { ...item, qty: Math.max(1, qty) };
            }
            return item;
        }));
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.id !== productId));
    };

    const cartTotal = useMemo(() => {
        return cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    }, [cart]);

    const cartItemCount = useMemo(() => {
        return cart.reduce((acc, item) => acc + item.qty, 0);
    }, [cart]);

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        setProcessing(true);

        const total = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

        const transactionData = {
            items: cart.map(item => ({
                productId: item.id,
                name: item.name,
                quantity: item.qty,
                price: Number(item.price),
                cost: Number(item.cost || 0)
            })),
            total: total
        };

        try {
            await adjustStock(transactionData.items, 'sale', user.uid, reference || "Venta POS", reference);

            if (printerRef.current) {
                printerRef.current.print(transactionData);
            }

            addToast("¡Venta completada con éxito!");
            setCart([]);
            setReference("");
            setIsCartOpen(false);
        } catch (error) {
            addToast("Error en venta: " + error.message, "error");
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center text-sm text-ink-500">
                <span className="h-5 w-5 border-2 border-ink-300 border-t-ink-700 rounded-full animate-spin mr-3" />
                Cargando productos...
            </div>
        );
    }

    // Cart Content Component (reused in both desktop sidebar and mobile modal)
    const CartContent = ({ isMobile = false }) => (
        <div className={`flex flex-col h-full min-h-0 ${isMobile ? '' : 'surface'}`}>
            <div className="shrink-0 px-4 sm:px-5 h-14 border-b border-ink-200/70 flex items-center justify-between">
                <h2 className="section-title flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-ink-400" />
                    Venta actual
                    {cartItemCount > 0 && (
                        <span className="badge-primary tabular-nums">{cartItemCount}</span>
                    )}
                </h2>
                {isMobile && (
                    <button
                        onClick={() => setIsCartOpen(false)}
                        className="touch-target -my-2 -mr-2 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100"
                        aria-label="Cerrar carrito"
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 overscroll-contain custom-scrollbar">
                {cart.length === 0 ? (
                    <div className="empty-state h-full">
                        <div className="empty-icon">
                            <ShoppingCart className="h-6 w-6 text-ink-400" />
                        </div>
                        <p className="text-sm font-medium text-ink-700">Carrito vacío</p>
                        <p className="text-xs text-ink-500 mt-1">Toca un producto para agregarlo.</p>
                    </div>
                ) : (
                    cart.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-ink-200/70 bg-ink-50/70">
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium text-ink-900 truncate" title={item.name}>{item.name}</h4>
                                <p className="text-xs text-ink-500 tabular-nums mt-0.5">{formatCurrency(item.price)} c/u</p>
                            </div>
                            <div className="flex items-center gap-1 ml-2 shrink-0">
                                <button
                                    onClick={() => updateQty(item.id, -1)}
                                    className="touch-target rounded-lg text-ink-500 hover:text-ink-900 hover:bg-ink-100 active:bg-ink-200 touch-manipulation"
                                    aria-label={`Quitar una unidad de ${item.name}`}
                                >
                                    <Minus className="h-4 w-4" />
                                </button>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    min="1"
                                    max={products.find(p => p.id === item.id)?.stock || 999}
                                    value={item.qty}
                                    onChange={(e) => setManualQty(item.id, e.target.value)}
                                    aria-label={`Cantidad de ${item.name}`}
                                    className="w-12 shrink-0 text-center rounded-lg border border-ink-200 bg-elevated px-1 py-1.5 text-sm font-semibold text-ink-900 tabular-nums focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                                />
                                <button
                                    onClick={() => updateQty(item.id, 1)}
                                    className="touch-target rounded-lg text-ink-500 hover:text-ink-900 hover:bg-ink-100 active:bg-ink-200 touch-manipulation"
                                    aria-label={`Añadir una unidad de ${item.name}`}
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => removeFromCart(item.id)}
                                    className="touch-target rounded-lg text-danger-500 hover:text-danger-700 hover:bg-danger-50 active:bg-danger-100 touch-manipulation"
                                    aria-label={`Eliminar ${item.name} del carrito`}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="shrink-0 p-4 border-t border-ink-200/70 space-y-3 pb-safe">
                <div>
                    <label htmlFor="pos-reference" className="input-label">Referencia o comentario (opcional)</label>
                    <input
                        id="pos-reference"
                        type="text"
                        autoComplete="off"
                        enterKeyHint="done"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="ej. Cliente Juan, Mesa 5..."
                        className="input-field"
                    />
                </div>

                <div className="bg-ink-100/70 rounded-2xl p-4">
                    <div className="flex justify-between items-baseline">
                        <span className="text-sm font-medium text-ink-600">Subtotal</span>
                        <span className="text-xl font-bold text-ink-900 tabular-nums">{formatCurrency(cartTotal)}</span>
                    </div>
                </div>

                <button
                    onClick={handleCheckout}
                    disabled={cart.length === 0 || processing}
                    className="btn-primary w-full py-3.5 text-base"
                >
                    {processing ? (
                        <>
                            <Loader className="animate-spin h-5 w-5" />
                            Procesando...
                        </>
                    ) : (
                        <>
                            <CreditCard className="h-5 w-5" />
                            Cobrar
                        </>
                    )}
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex h-full min-h-0 flex-col lg:flex-row">
            <ReceiptPrinter ref={printerRef} />

            {/* Product Grid Area */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-6 lg:p-7">
                <div className="mb-4 flex shrink-0 items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-700">Venta rápida</p>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">Punto de venta</h1>
                        <p className="mt-1 text-sm text-ink-500">Elige los productos para agregar a la venta.</p>
                    </div>
                    <span className="hidden rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-ink-500 shadow-xs sm:inline-flex">
                        {products.length} productos
                    </span>
                </div>

                {/* Search Bar */}
                <div className="relative mb-4 shrink-0">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-ink-400" />
                    </div>
                    <input
                        type="search"
                        autoComplete="off"
                        enterKeyHint="search"
                        aria-label="Buscar producto por nombre o SKU"
                        className="input-field pl-9"
                        placeholder="Buscar por nombre o SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Product Grid */}
                <div className="custom-scrollbar grid min-h-0 flex-1 content-start grid-cols-2 gap-3 overflow-y-auto pb-20 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 lg:pb-0">
                    {filteredProducts.map((product) => (
                        <button
                            key={product.id}
                            onClick={() => addToCart(product)}
                            className="surface group flex flex-col p-3 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-card-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 active:scale-[0.98] touch-manipulation disabled:cursor-not-allowed disabled:opacity-55"
                            disabled={product.stock < 1}
                        >
                            <div className="mb-3 flex h-20 w-full items-center justify-center overflow-hidden rounded-xl bg-primary-50 sm:h-28">
                                {product.image ? (
                                    <img src={product.image} alt={product.name} className="object-cover h-full w-full" />
                                ) : (
                                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-primary-500 shadow-xs transition-transform group-hover:scale-105">
                                        <Flame className="h-5 w-5" aria-hidden="true" />
                                    </span>
                                )}
                            </div>
                            <h3 className="w-full truncate text-sm font-semibold leading-snug text-ink-900" title={product.name}>{product.name}</h3>
                            <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
                                <span className="text-sm font-bold text-ink-900 tabular-nums sm:text-base">
                                    {formatCurrency(product.price)}
                                </span>
                                <span className={`tabular-nums ${product.stock > 0 ? "badge-success" : "badge-danger"}`}>
                                    {product.stock > 0 ? `${product.stock} disp.` : "Agotado"}
                                </span>
                            </div>
                        </button>
                    ))}
                    {filteredProducts.length === 0 && (
                        <div className="col-span-full empty-state">
                            <div className="empty-icon">
                                <PackageX className="h-6 w-6 text-ink-400" />
                            </div>
                            <p className="text-sm font-medium text-ink-700">Sin resultados</p>
                            <p className="text-xs text-ink-500 mt-1">No se encontraron productos con "{searchTerm}".</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Desktop Cart Sidebar */}
            <div className="hidden shrink-0 p-4 lg:flex lg:w-[22rem] xl:w-[25rem] xl:p-5">
                <CartContent />
            </div>

            {/* Mobile Cart Button */}
            <button
                onClick={() => setIsCartOpen(true)}
                className="lg:hidden fixed bottom-safe right-4 z-30 flex items-center gap-2 rounded-2xl bg-brand-gradient-soft px-4 py-3.5 text-white shadow-glow transition-transform active:scale-95 touch-manipulation"
                aria-label={`Abrir carrito, ${cartItemCount} artículos`}
            >
                <ShoppingCart className="h-5 w-5" />
                <span className="text-sm font-semibold tabular-nums">Ver venta</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold tabular-nums">{cartItemCount}</span>
            </button>

            {/* Mobile Cart Modal */}
            {isCartOpen && (
                <div className="lg:hidden fixed inset-0 z-50" onClick={() => setIsCartOpen(false)}>
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-scrim/60 animate-fade-in" />

                    {/* Cart Panel */}
                    <div
                        className="absolute inset-x-0 bottom-0 flex max-h-[90dvh] animate-slide-up flex-col overflow-hidden rounded-t-3xl border-t border-ink-200/80 bg-surface shadow-panel"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Carrito de venta"
                    >
                        {/* Drag Handle */}
                        <div className="flex justify-center py-2 shrink-0">
                            <div className="w-10 h-1 bg-ink-300 rounded-full" />
                        </div>
                        <CartContent isMobile={true} />
                    </div>
                </div>
            )}
        </div>
    );
}
