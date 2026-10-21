import { useState, useEffect, useMemo, useRef } from "react";
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, Loader, X } from "lucide-react";
import { getProducts, adjustStock } from "../lib/db";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ReceiptPrinter from "../components/ReceiptPrinter";

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

    if (loading) return <div className="flex h-full items-center justify-center">Cargando productos...</div>;

    // Cart Content Component (reused in both desktop sidebar and mobile modal)
    const CartContent = ({ isMobile = false }) => (
        <div className={`flex flex-col h-full ${isMobile ? '' : 'bg-white shadow-xl border-l border-gray-200'}`}>
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800 flex items-center">
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    Venta Actual
                </h2>
                {isMobile && (
                    <button
                        onClick={() => setIsCartOpen(false)}
                        className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <ShoppingCart className="h-12 w-12 mb-2 opacity-50" />
                        <p>Carrito vacío</p>
                    </div>
                ) : (
                    cart.map((item) => (
                        <div key={item.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium text-gray-900 truncate" title={item.name}>{item.name}</h4>
                                <p className="text-sm text-gray-500">${Number(item.price).toFixed(2)} c/u</p>
                            </div>
                            <div className="flex items-center space-x-1 sm:space-x-2 ml-2">
                                <button
                                    onClick={() => updateQty(item.id, -1)}
                                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded touch-manipulation"
                                >
                                    <Minus className="h-4 w-4" />
                                </button>
                                <input
                                    type="number"
                                    min="1"
                                    max={products.find(p => p.id === item.id)?.stock || 999}
                                    value={item.qty}
                                    onChange={(e) => setManualQty(item.id, e.target.value)}
                                    className="w-14 text-center border border-gray-300 rounded px-1 py-1 text-sm font-medium"
                                />
                                <button
                                    onClick={() => updateQty(item.id, 1)}
                                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded touch-manipulation"
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => removeFromCart(item.id)}
                                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded ml-1 touch-manipulation"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-3">
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Referencia / Comentario (Opcional)</label>
                    <input
                        type="text"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="ej. Cliente Juan, Mesa 5..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>

                <div className="flex justify-between items-center">
                    <span className="text-base font-medium text-gray-700">Subtotal</span>
                    <span className="text-xl font-bold text-gray-900">${cartTotal.toFixed(2)}</span>
                </div>

                <button
                    onClick={handleCheckout}
                    disabled={cart.length === 0 || processing}
                    className={`w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white touch-manipulation ${cart.length === 0 || processing
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                        }`}
                >
                    {processing ? (
                        <>
                            <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                            Procesando...
                        </>
                    ) : (
                        <>
                            <CreditCard className="-ml-1 mr-3 h-5 w-5" />
                            Cobrar
                        </>
                    )}
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-7rem)] md:h-[calc(100vh-4rem)] -m-4 sm:-m-6 md:-m-8">
            <ReceiptPrinter ref={printerRef} />

            {/* Product Grid Area */}
            <div className="flex-1 flex flex-col p-4 bg-gray-100 overflow-hidden">
                {/* Search Bar */}
                <div className="mb-4 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-base"
                        placeholder="Buscar por nombre o SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Product Grid */}
                <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 content-start pb-20 lg:pb-0">
                    {filteredProducts.map((product) => (
                        <button
                            key={product.id}
                            onClick={() => addToCart(product)}
                            className="flex flex-col bg-white rounded-lg shadow hover:shadow-md transition-shadow p-3 text-left border border-transparent hover:border-blue-300 focus:outline-none active:scale-95 touch-manipulation"
                        >
                            <div className="w-full h-24 sm:h-32 bg-gray-200 rounded-md mb-2 flex items-center justify-center overflow-hidden">
                                {product.image ? (
                                    <img src={product.image} alt={product.name} className="object-cover h-full w-full" />
                                ) : (
                                    <span className="text-gray-400 text-2xl sm:text-3xl font-bold">{product.name.charAt(0)}</span>
                                )}
                            </div>
                            <h3 className="font-semibold text-gray-900 truncate w-full text-sm sm:text-base" title={product.name}>{product.name}</h3>
                            <div className="flex justify-between items-center mt-auto pt-2">
                                <span className="text-blue-600 font-bold text-sm sm:text-base">${Number(product.price).toFixed(2)}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${product.stock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {product.stock}
                                </span>
                            </div>
                        </button>
                    ))}
                    {filteredProducts.length === 0 && (
                        <div className="col-span-full text-center py-10 text-gray-500">
                            No se encontraron productos.
                        </div>
                    )}
                </div>
            </div>

            {/* Desktop Cart Sidebar */}
            <div className="hidden lg:flex lg:w-96">
                <CartContent />
            </div>

            {/* Mobile Cart Button */}
            <button
                onClick={() => setIsCartOpen(true)}
                className="lg:hidden fixed bottom-4 right-4 z-30 bg-blue-600 text-white px-5 py-4 rounded-full shadow-lg flex items-center space-x-2 active:scale-95 touch-manipulation"
            >
                <ShoppingCart className="h-6 w-6" />
                {cartItemCount > 0 && (
                    <span className="bg-white text-blue-600 rounded-full px-2 py-0.5 text-sm font-bold min-w-[24px] text-center">
                        {cartItemCount}
                    </span>
                )}
            </button>

            {/* Mobile Cart Modal */}
            {isCartOpen && (
                <div className="lg:hidden fixed inset-0 z-50" onClick={() => setIsCartOpen(false)}>
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black bg-opacity-50" />

                    {/* Cart Panel */}
                    <div
                        className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-xl max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drag Handle */}
                        <div className="flex justify-center py-2">
                            <div className="w-12 h-1 bg-gray-300 rounded-full" />
                        </div>
                        <CartContent isMobile={true} />
                    </div>
                </div>
            )}
        </div>
    );
}
