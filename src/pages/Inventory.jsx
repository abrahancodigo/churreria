import { useState, useEffect, useMemo } from "react";
import { Plus, Pencil, Trash2, X, Search, Package, Image as ImageIcon, Percent } from "lucide-react";
import { getProducts, addProduct, updateProduct, deleteProduct } from "../lib/db";
import { useToast } from "../hooks/useToast";
import { useRole } from "../hooks/useRole";
import { PageHeader, EmptyState, ListSkeleton, Sheet, IconButton, StatCard } from "../components/ui";

const EMPTY_FORM = { name: "", sku: "", category: "General", price: "", cost: "", stock: "", image: "" };
const LOW_STOCK = 10;

const money = (value) =>
    "$" + Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Estado del stock: mismo criterio y colores en tabla y en tarjetas. */
function stockState(stock) {
    const n = Number(stock) || 0;
    if (n > 50) return { label: "En existencia", cls: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-700" };
    if (n > LOW_STOCK) return { label: "Bajo", cls: "bg-amber-100 text-amber-800", dot: "bg-amber-600" };
    return { label: "Crítico", cls: "bg-rose-100 text-rose-700", dot: "bg-rose-600" };
}

export default function Inventory() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [searchTerm, setSearchTerm] = useState("");
    const [viewingImage, setViewingImage] = useState(null);
    const { addToast } = useToast();
    const { isAdmin } = useRole();

    useEffect(() => {
        const unsubscribe = getProducts((data) => {
            setProducts(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const filteredProducts = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        const list = q
            ? products.filter(
                (p) => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q))
            )
            : [...products];
        return list.sort((a, b) => (a.sku || "").localeCompare(b.sku || "", undefined, { numeric: true, sensitivity: "base" }));
    }, [products, searchTerm]);

    const summary = useMemo(() => {
        const value = products.reduce((a, p) => a + Number(p.cost || 0) * Number(p.stock || 0), 0);
        const low = products.filter((p) => Number(p.stock) <= LOW_STOCK).length;
        const units = products.reduce((a, p) => a + Number(p.stock || 0), 0);
        return { value, low, units };
    }, [products]);

    const openModal = (product = null) => {
        if (!isAdmin) {
            addToast("Solo los administradores pueden agregar o editar productos.", "error");
            return;
        }
        if (product) {
            setEditingProduct(product);
            setFormData({ ...EMPTY_FORM, ...product });
        } else {
            setEditingProduct(null);
            setFormData(EMPTY_FORM);
        }
        setIsModalOpen(true);
    };

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
            setFormData(EMPTY_FORM);
        } catch (error) {
            addToast("Error al guardar: " + error.message, "error");
        }
    };

    const handleDelete = async (product) => {
        if (!isAdmin) {
            addToast("Solo los administradores pueden eliminar productos.", "error");
            return;
        }
        if (!window.confirm(`¿Eliminar "${product.name}"?`)) return;
        try {
            await deleteProduct(product.id);
            addToast("Producto eliminado correctamente.");
        } catch (error) {
            addToast("Error al eliminar: " + error.message, "error");
        }
    };

    return (
        <div>
            <PageHeader
                title="Inventario"
                sub={`${filteredProducts.length} de ${products.length} productos`}
                icon={Package}
                accent="sky"
                action={
                    isAdmin ? (
                        <button onClick={() => openModal()} className="btn-primary !py-2.5">
                            <Plus className="h-5 w-5" />
                            <span className="hidden sm:inline">Nuevo producto</span>
                            <span className="sm:hidden">Nuevo</span>
                        </button>
                    ) : null
                }
            />

            {!loading && products.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                    <StatCard
                        label="Valor a costo"
                        value={money(summary.value)}
                        icon={Package}
                        accent="emerald"
                        valueTone="text-emerald-800"
                    />
                    <StatCard
                        label="Unidades"
                        value={summary.units.toLocaleString("es-SV")}
                        icon={Percent}
                        accent="sky"
                        valueTone="text-sky-700"
                    />
                    <div className="block">
                        <StatCard
                            label="Stock crítico"
                            value={summary.low}
                            hint="≤ 10 unidades"
                            icon={Package}
                            accent="brand"
                            valueTone={summary.low > 0 ? "text-rose-700" : "text-ink"}
                        />
                    </div>
                </div>
            )}

            <div className="relative mb-3">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-3 pointer-events-none" />
                <input
                    type="search"
                    placeholder="Buscar por nombre o SKU..."
                    className="input !pl-11"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {loading ? (
                <ListSkeleton rows={6} />
            ) : filteredProducts.length === 0 ? (
                <EmptyState
                    icon={Package}
                    accent="sky"
                    title="Sin productos"
                    hint={searchTerm ? `Nada para “${searchTerm}”.` : "Agrega tu primer producto con el botón Nuevo."}
                    action={isAdmin && !searchTerm ? <button onClick={() => openModal()} className="btn-primary">Agregar producto</button> : null}
                />
            ) : (
                <>
                    {/* Tabla en escritorio */}
                    <div className="hidden md:block card !p-0 overflow-hidden">
                        <div className="table-wrap">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Producto</th>
                                        <th className="hidden lg:table-cell">SKU</th>
                                        <th className="!text-right">Precio</th>
                                        <th className="!text-right hidden lg:table-cell">Costo</th>
                                        <th className="!text-center">Stock</th>
                                        {isAdmin && <th className="!text-right">Acciones</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredProducts.map((p) => {
                                        const st = stockState(p.stock);
                                        return (
                                            <tr key={p.id}>
                                                <td>
                                                    <div className="flex items-center gap-3">
                                                        <Thumb product={p} onZoom={setViewingImage} />
                                                        <span className="font-bold !text-ink">{p.name}</span>
                                                    </div>
                                                </td>
                                                <td className="font-mono text-xs text-ink-3 hidden lg:table-cell">{p.sku || "—"}</td>
                                                <td className="!text-right font-extrabold !text-ink tnum">{money(p.price)}</td>
                                                <td className="!text-right text-ink-3 tnum hidden lg:table-cell">{money(p.cost)}</td>
                                                <td className="!text-center">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-extrabold text-base tnum ${st.cls}`}>
                                                        <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                                                        {p.stock}
                                                    </span>
                                                </td>
                                                {isAdmin && (
                                                    <td className="!text-right whitespace-nowrap">
                                                        <IconButton label={`Editar ${p.name}`} icon={Pencil} tone="brand" onClick={() => openModal(p)} />
                                                        <IconButton label={`Eliminar ${p.name}`} icon={Trash2} tone="danger" onClick={() => handleDelete(p)} />
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Tarjetas en móvil */}
                    <ul className="md:hidden space-y-2.5">
                        {filteredProducts.map((p) => {
                            const st = stockState(p.stock);
                            return (
                                <li key={p.id} className="card !p-3.5 flex gap-3">
                                    <Thumb product={p} large onZoom={setViewingImage} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-ink truncate">{p.name}</h3>
                                                {p.sku && <p className="text-xs font-mono text-ink-3">{p.sku}</p>}
                                            </div>
                                            <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-extrabold text-base tnum ${st.cls}`}>
                                                <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                                                {p.stock}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <div>
                                                <p className="text-base font-extrabold text-ink tnum">{money(p.price)}</p>
                                                <p className="text-[11px] font-semibold text-ink-3">Costo {money(p.cost)}</p>
                                            </div>
                                            {isAdmin && (
                                                <div className="flex gap-1">
                                                    <IconButton label={`Editar ${p.name}`} icon={Pencil} tone="brand" onClick={() => openModal(p)} />
                                                    <IconButton label={`Eliminar ${p.name}`} icon={Trash2} tone="danger" onClick={() => handleDelete(p)} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}

            {/* Visor de imagen */}
            {viewingImage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4" onClick={() => setViewingImage(null)} role="dialog" aria-modal="true">
                    <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setViewingImage(null)} aria-label="Cerrar imagen"
                            className="absolute -top-12 right-0 h-10 w-10 flex items-center justify-center rounded-xl text-white/85 hover:text-white hover:bg-white/10">
                            <X className="h-6 w-6" />
                        </button>
                        <img src={viewingImage.url} alt={viewingImage.name} className="w-full max-h-[80vh] object-contain rounded-2xl bg-white" />
                        <p className="text-white text-center mt-2 font-bold">{viewingImage.name}</p>
                    </div>
                </div>
            )}

            {/* Alta / edición */}
            <Sheet open={isModalOpen} onClose={() => setIsModalOpen(false)} accent="sky"
                title={editingProduct ? "Editar producto" : "Nuevo producto"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="label" htmlFor="inv-image">Imagen</label>
                        <div className="flex items-center gap-3">
                            {formData.image ? (
                                <img src={formData.image} alt="Vista previa" className="h-14 w-14 object-cover rounded-xl border border-line" />
                            ) : (
                                <span className="h-14 w-14 rounded-xl bg-paper border border-dashed border-line-strong flex items-center justify-center flex-shrink-0">
                                    <ImageIcon className="h-5 w-5 text-ink-3" />
                                </span>
                            )}
                            <input
                                id="inv-image" type="file" accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onloadend = () => setFormData((prev) => ({ ...prev, image: reader.result }));
                                    reader.readAsDataURL(file);
                                }}
                                className="block w-full text-sm text-ink-3 file:mr-3 file:min-h-[40px] file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="label" htmlFor="inv-name">Nombre *</label>
                        <input id="inv-name" type="text" required value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="input" placeholder="Ej. Churro clásico" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="label" htmlFor="inv-sku">SKU</label>
                            <input id="inv-sku" type="text" value={formData.sku || ""}
                                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                className="input font-mono" placeholder="001" />
                        </div>
                        <div>
                            <label className="label" htmlFor="inv-cat">Categoría</label>
                            <select id="inv-cat" value={formData.category || "General"}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="select">
                                <option>General</option><option>Comida</option><option>Bebidas</option>
                                <option>Postres</option><option>Snacks</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="label" htmlFor="inv-price">Precio</label>
                            <input id="inv-price" type="number" step="0.01" min="0" value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                className="input tnum" placeholder="0.00" />
                        </div>
                        <div>
                            <label className="label" htmlFor="inv-cost">Costo</label>
                            <input id="inv-cost" type="number" step="0.01" min="0" value={formData.cost}
                                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                                className="input tnum" placeholder="0.00" />
                        </div>
                        <div>
                            <label className="label" htmlFor="inv-stock">Stock</label>
                            <input id="inv-stock" type="number" min="0" value={formData.stock}
                                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                className="input tnum" placeholder="0" />
                        </div>
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="btn-ghost flex-1">Cancelar</button>
                        <button type="submit" className="btn-primary flex-1">
                            {editingProduct ? "Guardar cambios" : "Agregar producto"}
                        </button>
                    </div>
                </form>
            </Sheet>
        </div>
    );
}

function Thumb({ product, large, onZoom }) {
    const size = large ? "h-14 w-14" : "h-10 w-10";
    if (product.image) {
        return (
            <button
                onClick={() => onZoom({ url: product.image, name: product.name })}
                className={`${size} rounded-xl overflow-hidden border border-line hover:border-brand-500 ring-offset-2 flex-shrink-0`}
                aria-label={`Ver imagen de ${product.name}`}
            >
                <img src={product.image} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
            </button>
        );
    }
    return (
        <span className={`${size} rounded-xl bg-paper-deep flex items-center justify-center flex-shrink-0`}>
            <ImageIcon className="h-4 w-4 text-ink-3" />
        </span>
    );
}
