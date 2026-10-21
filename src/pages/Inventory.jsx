import { useState, useEffect } from "react";
import { Plus, Edit, Trash, X, ImageIcon, Search, Package } from "lucide-react";
import { getProducts, addProduct, updateProduct, deleteProduct } from "../lib/db";
import { useToast } from "../context/ToastContext";
import { useRole } from "../hooks/useRole";

export default function Inventory() {
    const [products, setProducts] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [formData, setFormData] = useState({ name: "", sku: "", price: "", cost: "", stock: "" });
    const [viewingImage, setViewingImage] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
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

    useEffect(() => {
        const unsubscribe = getProducts((data) => setProducts(data));
        return () => unsubscribe();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
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
            addToast("Error al guardar: " + error.message, "error");
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
        if (!window.confirm(`¿Estás seguro de eliminar "${product.name}"?`)) return;

        try {
            await deleteProduct(product.id);
            addToast("Producto eliminado correctamente.");
        } catch (error) {
            addToast("Error al eliminar: " + error.message, "error");
        }
    };

    // Thumbnail component
    const ProductThumbnail = ({ product, size = "small" }) => {
        const sizeClasses = size === "small" ? "h-10 w-10" : "h-16 w-16";

        if (product.image) {
            return (
                <button
                    onClick={() => setViewingImage({ url: product.image, name: product.name })}
                    className={`${sizeClasses} rounded-md overflow-hidden border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex-shrink-0`}
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
            <div className={`${sizeClasses} rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0`}>
                <ImageIcon className="h-4 w-4 text-gray-400" />
            </div>
        );
    };

    return (
        <div>
            {/* Sticky Header - Título, Botón y Buscador */}
            <div className="sticky top-0 z-30 bg-gray-100 pb-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Inventario</h1>
                    <button
                        onClick={() => openModal()}
                        disabled={!isAdmin}
                        className="flex items-center justify-center px-4 py-3 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                        title={!isAdmin ? "Solo administradores" : ""}
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Nuevo Producto
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o SKU..."
                        className="w-full pl-10 pr-4 py-3 border rounded-lg bg-white leading-5 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-base"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white shadow overflow-hidden sm:rounded-lg mt-4">
                <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Imagen</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredProducts.map((product) => (
                                <tr key={product.id} className="bg-white hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <ProductThumbnail product={product} size="small" />
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{product.sku || "-"}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${Number(product.price).toFixed(2)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className={`inline-flex items-center px-3 py-2 rounded-lg font-bold text-lg ${product.stock > 50 ? 'bg-green-100 text-green-800 border-2 border-green-300' :
                                            product.stock > 10 ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300' :
                                                'bg-red-100 text-red-800 border-2 border-red-300'
                                            }`}>
                                            <Package className="h-4 w-4 mr-2" />
                                            {product.stock}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                        <button
                                            onClick={() => openModal(product)}
                                            disabled={!isAdmin}
                                            className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                                            title={!isAdmin ? "Solo administradores" : "Editar"}
                                        >
                                            <Edit className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(product)}
                                            disabled={!isAdmin}
                                            className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                                            title={!isAdmin ? "Solo administradores" : "Eliminar"}
                                        >
                                            <Trash className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {filteredProducts.map((product) => (
                    <div key={product.id} className="bg-white rounded-lg shadow p-4 border border-gray-100">
                        <div className="flex gap-3">
                            <ProductThumbnail product={product} size="large" />
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <h3 className="text-base font-semibold text-gray-900 truncate">{product.name}</h3>
                                    <div className={`ml-2 px-3 py-1.5 rounded-lg font-bold text-base flex items-center ${product.stock > 50 ? 'bg-green-100 text-green-800 border-2 border-green-300' :
                                        product.stock > 10 ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300' :
                                            'bg-red-100 text-red-800 border-2 border-red-300'
                                        }`}>
                                        <Package className="h-4 w-4 mr-1" />
                                        {product.stock}
                                    </div>
                                </div>
                                {product.sku && (
                                    <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                                )}
                                <p className="text-lg font-bold text-blue-600 mt-1">${Number(product.price).toFixed(2)}</p>
                            </div>
                        </div>
                        <div className="mt-3 flex justify-end space-x-2 border-t pt-3">
                            <button
                                onClick={() => openModal(product)}
                                disabled={!isAdmin}
                                className="px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-md disabled:opacity-50 touch-manipulation flex items-center"
                                title={!isAdmin ? "Solo administradores" : "Editar"}
                            >
                                <Edit className="w-4 h-4 mr-1" />
                                Editar
                            </button>
                            <button
                                onClick={() => handleDelete(product)}
                                disabled={!isAdmin}
                                className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50 touch-manipulation flex items-center"
                                title={!isAdmin ? "Solo administradores" : "Eliminar"}
                            >
                                <Trash className="w-4 h-4 mr-1" />
                                Eliminar
                            </button>
                        </div>
                    </div>
                ))}
                {products.length === 0 && (
                    <div className="text-center py-10 text-gray-500">
                        No hay productos en el inventario.
                    </div>
                )}
            </div>

            {/* Image Viewer Modal */}
            {viewingImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4"
                    onClick={() => setViewingImage(null)}
                >
                    <div className="relative max-w-4xl w-full max-h-[90vh]">
                        <button
                            onClick={() => setViewingImage(null)}
                            className="absolute -top-12 right-0 p-2 text-white hover:text-gray-300"
                        >
                            <X className="h-8 w-8" />
                        </button>
                        <img
                            src={viewingImage.url}
                            alt={viewingImage.name}
                            className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <p className="text-white text-center mt-3 text-lg font-medium">{viewingImage.name}</p>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-50 p-0 sm:p-4">
                    <div className="bg-white w-full sm:rounded-lg shadow-xl sm:w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-lg">
                        {/* Modal drag handle for mobile */}
                        <div className="sm:hidden flex justify-center py-2">
                            <div className="w-12 h-1 bg-gray-300 rounded-full" />
                        </div>
                        <div className="p-6">
                            <h2 className="text-xl font-bold mb-4">{editingProduct ? "Editar Producto" : "Nuevo Producto"}</h2>
                            <form onSubmit={handleSubmit}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Imagen</label>
                                        <div className="mt-1 flex items-center space-x-4">
                                            {formData.image && (
                                                <img src={formData.image} alt="Preview" className="h-16 w-16 object-cover rounded-md border" />
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => {
                                                            setFormData(prev => ({ ...prev, image: reader.result }));
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }}
                                                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Nombre (Requerido)</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-3 text-base"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Categoría</label>
                                        <select
                                            value={formData.category || "General"}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-3 text-base"
                                        >
                                            <option value="General">General</option>
                                            <option value="Food">Comida</option>
                                            <option value="Drinks">Bebidas</option>
                                            <option value="Desserts">Postres</option>
                                            <option value="Snacks">Snacks</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">SKU</label>
                                        <input
                                            type="text"
                                            value={formData.sku}
                                            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-3 text-base"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Precio</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={formData.price}
                                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-3 text-base"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Costo</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={formData.cost}
                                                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-3 text-base"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Stock</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={formData.stock}
                                                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-3 text-base"
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
                                                    className="mt-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium whitespace-nowrap"
                                                    title="Ajustar stock manualmente"
                                                >
                                                    Ajustar
                                                </button>
                                            )}
                                        </div>
                                        {editingProduct && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                💡 Puedes editar el stock directamente o usar el botón "Ajustar"
                                            </p>
                                        )}
                                        {!editingProduct && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Stock inicial para el nuevo producto
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="w-full sm:w-auto px-4 py-3 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 touch-manipulation"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="w-full sm:w-auto px-4 py-3 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 touch-manipulation"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
