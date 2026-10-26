import { useState, useEffect } from "react";
import { Plus, Edit, Trash, X, ImageIcon, Search, Package, PackageX } from "lucide-react";
import { getProducts, addProduct, updateProduct, deleteProduct, friendlyDbError } from "../services/productService";
import { processImageFile } from "../lib/image";
import { formatCurrency } from "../lib/formatters";
import { useToast } from "../context/ToastContext";
import { useRole } from "../hooks/useRole";
import ConfirmDialog from "../components/ConfirmDialog";
import LoadingProgress from "../components/LoadingProgress";

export default function Inventory() {
    const [products, setProducts] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [formData, setFormData] = useState({ name: "", sku: "", price: "", cost: "", stock: "" });
    const [viewingImage, setViewingImage] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [productToDelete, setProductToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [imageUploading, setImageUploading] = useState(false);
    const { addToast } = useToast();
    const { isAdmin } = useRole();

    // Filter and sort products based on search term and SKU
    const filteredProducts = products
        .filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        .sort((a, b) => {
            // Sort by SKU (numeric if possible, otherwise string)
            const skuA = a.sku || "";
            const skuB = b.sku || "";

            // Try numeric comparison if both look like numbers
            const numA = parseInt(skuA);
            const numB = parseInt(skuB);

            if (!isNaN(numA) && !isNaN(numB) && String(numA) === skuA && String(numB) === skuB) {
                return numA - numB;
            }

            return skuA.localeCompare(skuB, undefined, { numeric: true, sensitivity: 'base' });
        });

    // isLoading sigue true mientras Firestore entregue solo caché; el primer
    // documento del servidor lo apaga y la barra completa al 100 %.
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const loadMessage = products.length === 0
        ? "Cargando inventario…"
        : `Cargando productos… (${products.length})`;

    useEffect(() => {
        const unsubscribe = getProducts(
            (data) => setProducts(data),
            {
                // Solo cuentan como "cargando" los datos que aún vienen del
                // servidor; si Firestore ya tiene caché local, se muestra al instante.
                onLoading: (fromCache) => setIsLoading(fromCache),
                onError: setLoadError,
            }
        );
        // Si en 15 s no llegó nada del servidor, no dejamos la barra colgada
        // para siempre (red caída, permisos, etc.).
        const timeout = setTimeout(() => setIsLoading(false), 15000);
        return () => {
            clearTimeout(timeout);
            unsubscribe();
        };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Mientras se comprime la imagen aún no está en formData.
        if (imageUploading) return;
        try {
            if (editingProduct) {
                await updateProduct(editingProduct.id, formData);
                addToast("Producto actualizado correctamente");
            } else {
                await addProduct(formData);
                addToast("Producto agregado correctamente");
            }
            setIsModalOpen(false);
            setEditingProduct(null);
            setFormData({ name: "", sku: "", price: "", cost: "", stock: "" });
        } catch (error) {
            console.error("[Inventory] No se pudo guardar el producto:", error);
            addToast(friendlyDbError(error, "No se pudo guardar el producto"), "error");
        }
    };

    /**
     * Lee la foto, la redimensiona y comprime en el navegador para que quepa
     * en el documento de Firestore (límite de 1 MB).
     */
    const handleImageChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImageUploading(true);
        try {
            const dataUrl = await processImageFile(file);
            setFormData(prev => ({ ...prev, image: dataUrl }));
        } catch (error) {
            addToast(error?.message || "Error al cargar la imagen", "error");
        } finally {
            setImageUploading(false);
            // Reinicia el input para poder volver a elegir el mismo archivo.
            e.target.value = "";
        }
    };

    const openModal = (product = null) => {
        if (!isAdmin) {
            addToast("Solo los administradores pueden agregar o editar productos.", "error");
            return;
        }
        if (product) {
            setEditingProduct(product);
            setFormData(product);
        } else {
            setEditingProduct(null);
            setFormData({ name: "", sku: "", price: "", cost: "", stock: "" });
        }
        setIsModalOpen(true);
    };

    const handleDelete = async (product) => {
        if (!isAdmin) {
            addToast("Solo los administradores pueden eliminar productos.", "error");
            return;
        }
        setProductToDelete(product);
    };

    const confirmDelete = async () => {
        if (!productToDelete) return;
        setDeleting(true);
        try {
            await deleteProduct(productToDelete.id);
            addToast("Producto eliminado correctamente.");
            setProductToDelete(null);
        } catch (error) {
            addToast("Error al eliminar: " + error.message, "error");
        } finally {
            setDeleting(false);
        }
    };

    const stockBadge = (stock) => {
        if (stock > 50) return "badge-success";
        if (stock > 10) return "badge-warning";
        return "badge-danger";
    };

    // Indicador de existencias con la cantidad y la unidad visibles a primera vista.
    const StockPill = ({ stock, size = "md" }) => {
        const value = Number(stock) || 0;
        const isLarge = size === "lg";

        return (
            <span
                className={`${stockBadge(value)} items-baseline ${isLarge ? "gap-2 px-4 py-2" : "gap-2 px-3 py-1.5"}`}
                title={`${value} ${value === 1 ? "unidad" : "unidades"} en existencia`}
            >
                <Package className={`${isLarge ? "h-4 w-4" : "h-3.5 w-3.5"} shrink-0 self-center`} />
                <span className={`font-extrabold tabular-nums leading-none ${isLarge ? "text-2xl" : "text-lg"}`}>
                    {value}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-75 leading-none">
                    {value === 1 ? "unidad" : "unidades"}
                </span>
            </span>
        );
    };

    // Thumbnail component
    const ProductThumbnail = ({ product, size = "small" }) => {
        const sizeClasses = size === "small" ? "h-10 w-10" : "h-16 w-16";

        if (product.image) {
            return (
                <button
                    onClick={() => setViewingImage({ url: product.image, name: product.name })}
                    className={`${sizeClasses} rounded-xl overflow-hidden border border-ink-200 hover:border-primary-400 transition-colors cursor-pointer flex-shrink-0`}
                    aria-label={`Ver imagen de ${product.name}`}
                >
                    <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-cover"
                    />
                </button>
            );
        }

        return (
            <div className={`${sizeClasses} rounded-xl bg-ink-100 flex items-center justify-center flex-shrink-0`}>
                <ImageIcon className="h-4 w-4 text-ink-400" />
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <header className="page-header">
                <div>
                    <h1 className="page-title">Inventario</h1>
                    <p className="page-subtitle">Productos, precios y existencias</p>
                </div>
                <button
                    onClick={() => openModal()}
                    disabled={!isAdmin}
                    className="btn-primary self-start sm:self-auto"
                    title={!isAdmin ? "Solo administradores" : ""}
                >
                    <Plus className="h-4 w-4" />
                    Nuevo producto
                </button>
            </header>

            <LoadingProgress
                isLoading={isLoading}
                label={
                    loadError
                        ? "No se pudieron cargar los productos"
                        : loadMessage
                }
            />

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" />
                <input
                    type="search"
                    placeholder="Buscar por nombre o SKU..."
                    aria-label="Buscar productos"
                    className="input-field pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block table-shell">
                <div className="table-scroll overflow-y-auto max-h-[calc(100dvh-260px)] custom-scrollbar">
                    <table className="min-w-full">
                        <thead className="table-head sticky top-0 z-10">
                            <tr>
                                <th>Imagen</th>
                                <th>Nombre</th>
                                <th>SKU</th>
                                <th className="text-right">Precio</th>
                                <th>Stock</th>
                                <th className="text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="table-body">
                            {filteredProducts.map((product) => (
                                <tr key={product.id}>
                                    <td>
                                        <ProductThumbnail product={product} size="small" />
                                    </td>
                                    <td className="whitespace-nowrap font-medium text-ink-900">{product.name}</td>
                                    <td className="whitespace-nowrap text-ink-500 tabular-nums">{product.sku || "-"}</td>
                                    <td className="whitespace-nowrap text-right font-semibold text-ink-900 tabular-nums">
                                        {formatCurrency(product.price)}
                                    </td>
                                    <td className="whitespace-nowrap">
                                        <StockPill stock={product.stock} />
                                    </td>
                                    <td className="whitespace-nowrap text-right">
                                        <div className="inline-flex items-center gap-1">
                                            <button
                                                onClick={() => openModal(product)}
                                                disabled={!isAdmin}
                                                className="btn-icon h-10 w-10 rounded-xl hover:text-primary-700 hover:bg-primary-50 disabled:opacity-40"
                                                title={!isAdmin ? "Solo administradores" : "Editar"}
                                                aria-label={`Editar ${product.name}`}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(product)}
                                                disabled={!isAdmin}
                                                className="btn-icon h-10 w-10 rounded-xl hover:text-danger-700 hover:bg-danger-50 disabled:opacity-40"
                                                title={!isAdmin ? "Solo administradores" : "Eliminar"}
                                                aria-label={`Eliminar ${product.name}`}
                                            >
                                                <Trash className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredProducts.length === 0 && (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <PackageX className="h-6 w-6 text-ink-500" />
                        </div>
                        <p className="text-sm font-medium text-ink-700">
                            {products.length === 0 ? "Inventario vacío" : "Sin resultados"}
                        </p>
                        <p className="text-xs text-ink-500 mt-1">
                            {products.length === 0
                                ? "Agrega tu primer producto para comenzar."
                                : `No hay productos que coincidan con "${searchTerm}".`}
                        </p>
                    </div>
                )}
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {filteredProducts.map((product) => (
                    <div key={product.id} className="surface p-5">
                        <div className="flex gap-3">
                            <ProductThumbnail product={product} size="large" />
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-2">
                                    <h3 className="text-sm font-semibold text-ink-900 truncate">{product.name}</h3>
                                    <StockPill stock={product.stock} size="lg" />
                                </div>
                                {product.sku && (
                                    <p className="text-xs text-ink-500 mt-0.5 tabular-nums">SKU: {product.sku}</p>
                                )}
                                <p className="text-base font-bold text-ink-900 mt-1 tabular-nums">
                                    {formatCurrency(product.price)}
                                </p>
                            </div>
                        </div>
                        <div className="divider mt-4 flex justify-end gap-2 pt-3">
                            <button
                                onClick={() => openModal(product)}
                                disabled={!isAdmin}
                                className="btn-ghost disabled:opacity-40"
                                title={!isAdmin ? "Solo administradores" : "Editar"}
                            >
                                <Edit className="h-4 w-4" />
                                Editar
                            </button>
                            <button
                                onClick={() => handleDelete(product)}
                                disabled={!isAdmin}
                                className="btn-ghost text-danger-600 hover:bg-danger-50 disabled:opacity-40"
                                title={!isAdmin ? "Solo administradores" : "Eliminar"}
                            >
                                <Trash className="h-4 w-4" />
                                Eliminar
                            </button>
                        </div>
                    </div>
                ))}
                {filteredProducts.length === 0 && (
                    <div className="surface empty-state">
                        <div className="empty-icon">
                            <PackageX className="h-6 w-6 text-ink-500" />
                        </div>
                        <p className="text-sm font-medium text-ink-700">
                            {products.length === 0 ? "Inventario vacío" : "Sin resultados"}
                        </p>
                        <p className="text-xs text-ink-500 mt-1">
                            {products.length === 0
                                ? "Agrega tu primer producto para comenzar."
                                : `No hay productos que coincidan con "${searchTerm}".`}
                        </p>
                    </div>
                )}
            </div>

            {/* Image Viewer Modal */}
            {viewingImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/85 p-4 animate-fade-in"
                    onClick={() => setViewingImage(null)}
                >
                    <div className="modal-panel relative w-full max-w-4xl max-h-[90dvh] overflow-y-auto p-4 animate-scale-in">
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <p className="text-sm font-medium text-ink-700 truncate">{viewingImage.name}</p>
                            <button
                                onClick={() => setViewingImage(null)}
                                className="btn-icon h-10 w-10 rounded-xl shrink-0"
                                aria-label="Cerrar"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <img
                            src={viewingImage.url}
                            alt={viewingImage.name}
                            className="w-full h-auto max-h-[75dvh] object-contain rounded-xl bg-ink-100"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-scrim/60 p-0 sm:p-4">
                    <div className="modal-panel w-full sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl pb-safe sm:pb-0 animate-slide-up sm:animate-scale-in">
                        {/* Modal drag handle for mobile */}
                        <div className="sm:hidden flex justify-center py-2">
                            <div className="w-10 h-1 bg-ink-300 rounded-full" />
                        </div>
                        <div className="p-6">
                            <h2 className="section-title mb-5">
                                {editingProduct ? "Editar producto" : "Nuevo producto"}
                            </h2>
                            <form onSubmit={handleSubmit}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="input-label">Imagen</label>
                                        <div className="mt-1 flex items-center gap-4">
                                            {imageUploading ? (
                                                <div className="h-16 w-16 shrink-0 rounded-xl border border-dashed border-ink-300 bg-ink-100 flex flex-col items-center justify-center gap-1.5">
                                                    <span className="h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                                                    <span className="text-[9px] text-ink-500">Procesando</span>
                                                </div>
                                            ) : formData.image && (
                                                <img src={formData.image} alt="Preview" className="h-16 w-16 object-cover rounded-xl border border-ink-200" />
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageChange}
                                                disabled={imageUploading}
                                                className="input-field block file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-ink-200 file:bg-ink-100 file:px-3.5 file:py-1.5 file:text-xs file:font-semibold file:text-ink-700 hover:file:bg-ink-200 hover:file:border-ink-300"
                                            />
                                        </div>
                                        <p className="input-hint">
                                            Se comprime automáticamente para cabir en el servidor. JPG, PNG o WebP.
                                        </p>
                                    </div>
                                    <div>
                                        <label htmlFor="prod-name" className="input-label">Nombre (requerido)</label>
                                        <input
                                            id="prod-name"
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="input-field"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="prod-category" className="input-label">Categoría</label>
                                        <select
                                            id="prod-category"
                                            value={formData.category || "General"}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            className="input-field"
                                        >
                                            <option value="General">General</option>
                                            <option value="Food">Comida</option>
                                            <option value="Drinks">Bebidas</option>
                                            <option value="Desserts">Postres</option>
                                            <option value="Snacks">Snacks</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="prod-sku" className="input-label">SKU</label>
                                        <input
                                            id="prod-sku"
                                            type="text"
                                            value={formData.sku}
                                            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                            className="input-field"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="prod-price" className="input-label">Precio</label>
                                            <input
                                                id="prod-price"
                                                type="number"
                                                step="0.01"
                                                value={formData.price}
                                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                                className="input-field"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="prod-cost" className="input-label">Costo</label>
                                            <input
                                                id="prod-cost"
                                                type="number"
                                                step="0.01"
                                                value={formData.cost}
                                                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                                                className="input-field"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="prod-stock" className="input-label">Stock (unidades)</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                id="prod-stock"
                                                type="number"
                                                value={formData.stock}
                                                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                                className="input-field"
                                                disabled={!editingProduct}
                                            />
                                            {editingProduct && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newStock = prompt(
                                                            `Stock actual: ${formData.stock}\n\nIngresa el nuevo stock para "${editingProduct.name}":`,
                                                            formData.stock
                                                        );
                                                        if (newStock !== null && !isNaN(parseInt(newStock))) {
                                                            setFormData({ ...formData, stock: parseInt(newStock) });
                                                            addToast(`Stock actualizado a ${newStock}`);
                                                        }
                                                    }}
                                                    className="btn-secondary shrink-0"
                                                    title="Ajustar stock manualmente"
                                                >
                                                    Ajustar
                                                </button>
                                            )}
                                        </div>
                                        <p className="input-hint">
                                            {editingProduct
                                                ? "Puedes editar el stock directamente o usar el botón Ajustar."
                                                : "Stock inicial para el nuevo producto."}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="btn-secondary w-full sm:w-auto"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={imageUploading}
                                        className="btn-primary w-full sm:w-auto"
                                    >
                                        {imageUploading ? "Procesando imagen…" : "Guardar"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={!!productToDelete}
                title="Eliminar producto"
                message={productToDelete ? `¿Estás seguro de eliminar "${productToDelete.name}"? Esta acción no se puede deshacer.` : ""}
                confirmLabel="Sí, eliminar"
                loading={deleting}
                onConfirm={confirmDelete}
                onCancel={() => !deleting && setProductToDelete(null)}
            />
        </div>
    );
}
