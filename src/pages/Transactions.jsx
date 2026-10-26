import { useState, useEffect, useMemo, useRef } from "react";
import { db } from "../firebase.config";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { format } from "date-fns";
import { Search, Trash2, Eye, Printer, FileDown, Pencil, Receipt, History, Store } from "lucide-react";
import { deleteTransaction, editTransaction, getProducts, isReferenceTaken, normalizeReference, formatReferenceLabel, isCorrelativeType } from "../lib/db";
import { buildReceiptHtml, printHtmlDocument, openHtmlDocument, getSucursal } from "../lib/receipt";
import { reasonsFor, partyLabelFor, partyPlaceholderFor } from "../lib/movements";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { useRole } from "../hooks/useRole";
import { useCompany } from "../hooks/useCompany";
import { PageHeader, EmptyState, ListSkeleton, Sheet, PrintModal, TypeBadge, IconButton, Segmented } from "../components/ui";
import { typeLabel } from "../components/TypeBadge";

const money = (value) => "$" + Number(value || 0).toFixed(2);

const TYPE_OPTIONS = [
    { value: "all", label: "Todos" },
    { value: "sale", label: "Ventas" },
    { value: "entry", label: "Entradas" },
    { value: "exit", label: "Salidas" },
];

export default function Transactions() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [deleting, setDeleting] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [reclaimReference, setReclaimReference] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [editFormData, setEditFormData] = useState(null);
    const [viewingTransaction, setViewingTransaction] = useState(null);
    const [enrichedItems, setEnrichedItems] = useState([]);
    const [printingTransaction, setPrintingTransaction] = useState(null);
    const [savingEdit, setSavingEdit] = useState(false);
    const { addToast } = useToast();
    const { user } = useAuth();
    const { isAdmin } = useRole();
    const company = useCompany();

    useEffect(() => {
        const unsub = getProducts((data) => setProducts(data));
        return () => unsub();
    }, []);

    useEffect(() => {
        const q = query(collection(db, "transactions"), orderBy("timestamp", "desc"), limit(50));
        const unsub = onSnapshot(q, (snapshot) => {
            setTransactions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const enrichItems = (tx) => {
        if (!tx?.items) return [];
        return tx.items.map((item) => {
            const p = products.find((x) => x.id === item.productId);
            return {
                ...item,
                currentPrice: p ? Number(p.price) : null,
                currentCost: p ? Number(p.cost || 0) : null,
                priceChanged: p ? Number(p.price) !== Number(item.price) : false,
                costChanged: p ? Number(p.cost || 0) !== Number(item.cost || 0) : false,
            };
        });
    };

    const getUpdatedTotal = (tx) => {
        if (!tx?.items || products.length === 0) return Number(tx?.total || 0);
        const isMovement = tx.type === "entry" || tx.type === "exit";
        return tx.items.reduce((acc, item) => {
            const p = products.find((x) => x.id === item.productId);
            const unit = isMovement ? Number(p?.cost ?? item.cost ?? 0) : Number(p?.price ?? item.price ?? 0);
            return acc + unit * Number(item.quantity);
        }, 0);
    };

    const handleViewTransaction = (tx) => {
        setViewingTransaction(tx);
        setEnrichedItems(enrichItems(tx));
    };

    const handlePrintTransaction = (tx) => {
        setPrintingTransaction(tx);
    };

    const closePrintModal = () => setPrintingTransaction(null);
    const printFrameRef = useRef(null);

    const doPrint = () => {
        if (!printingTransaction) return;
        const html = buildReceiptHtml(printingTransaction, company);
        if (!printHtmlDocument(html, printFrameRef.current)) {
            addToast("Permite las ventanas emergentes para imprimir", "error");
        }
    };

    /**
     * Descargar PDF: abre el comprobante en una pestaña para que el usuario lo
     * guarde desde el visor del navegador (no hay escritor de PDF en cliente).
     */
    const handleDownloadPdf = (tx) => {
        if (!openHtmlDocument(buildReceiptHtml(tx, company))) {
            addToast("Permite las ventanas emergentes para descargar el PDF", "error");
            return;
        }
        addToast("Selecciona «Guardar como PDF» en el visor de impresión");
    };

    const filteredTransactions = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        return transactions
            .filter((t) => (typeFilter === "all" ? true : t.type === typeFilter))
            .filter((t) => {
                if (!q) return true;
                return (
                    t.id.toLowerCase().includes(q) ||
                    t.type.toLowerCase().includes(q) ||
                    (t.reference && t.reference.toLowerCase().includes(q)) ||
                    (t.sucursal && t.sucursal.toLowerCase().includes(q)) ||
                    (t.reason && t.reason.toLowerCase().includes(q)) ||
                    (t.notes && t.notes.toLowerCase().includes(q)) ||
                    (t.items && t.items.some((i) =>
                        (i.name && i.name.toLowerCase().includes(q)) ||
                        (i.productId && i.productId.toLowerCase().includes(q)))) ||
                    String(t.total || 0).includes(q)
                );
            })
            .sort((a, b) => {
                const ta = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
                const tb = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
                return tb - ta;
            });
    }, [transactions, searchTerm, typeFilter]);

    const openDeleteDialog = (tx) => {
        if (!isAdmin) {
            addToast("Solo los administradores pueden eliminar transacciones.", "error");
            return;
        }
        setDeleteTarget(tx);
        setReclaimReference(false);
    };

    const closeDeleteDialog = () => {
        if (deleting) return;
        setDeleteTarget(null);
        setReclaimReference(false);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(deleteTarget.id);
        try {
            await deleteTransaction(deleteTarget.id, deleteTarget, { reclaimReference });
            addToast(reclaimReference
                ? "Transacción eliminada, stock revertido y folio devuelto."
                : "Transacción eliminada y stock revertido.");
            setDeleteTarget(null);
            setReclaimReference(false);
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
        setEditFormData({
            ...tx,
            items: tx.items.map((i) => ({ ...i })),
            date: tx.timestamp?.toDate ? format(tx.timestamp.toDate(), "yyyy-MM-dd") : new Date().toISOString().split("T")[0],
            time: tx.timestamp?.toDate ? format(tx.timestamp.toDate(), "HH:mm") : "12:00",
        });
        setEditingTransaction(tx);
    };

    const handleSaveEdit = async () => {
        if (!isAdmin) return;
        const isMovement = editFormData.type === "entry" || editFormData.type === "exit";
        const manualReference = normalizeReference(editFormData.reference);
        if (isMovement && !manualReference) {
            return addToast("El folio es obligatorio en entradas y salidas.", "error");
        }
        if (!editFormData.items?.length) return addToast("Debe tener al menos un producto.", "error");
        if (editFormData.type === "exit" && !editFormData.sucursal?.trim()) {
            return addToast("Ingresa la sucursal de destino.", "error");
        }
        setSavingEdit(true);
        try {
            const timestamp = new Date(`${editFormData.date}T${editFormData.time || "12:00"}`);
            const total = editFormData.items.reduce((acc, item) => {
                const unit = isMovement ? Number(item.cost || 0) : Number(item.price || 0);
                return acc + unit * Number(item.quantity);
            }, 0);

            // Solo hace falta verificar el folio si cambió (o cambió de serie).
            const referenceChanged = manualReference !== normalizeReference(editingTransaction.reference)
                || editFormData.type !== editingTransaction.type;
            if (isMovement && referenceChanged && await isReferenceTaken(editFormData.type, manualReference, editingTransaction.id)) {
                addToast(`El folio ${formatReferenceLabel(editFormData.type, manualReference)} ya está usado en esa serie.`, "error");
                setSavingEdit(false);
                return;
            }

            await editTransaction(
                editingTransaction.id,
                { type: editingTransaction.type, items: editingTransaction.items, reference: editingTransaction.reference },
                {
                    ...editFormData,
                    reference: manualReference,
                    sucursal: editFormData.type === "exit" ? editFormData.sucursal || "" : "",
                    reason: editFormData.reason || "",
                    party: editFormData.party || "",
                    total,
                    timestamp,
                    editedBy: user?.email || "admin"
                }
            );
            addToast("Transacción actualizada.");
            setEditingTransaction(null);
            setEditFormData(null);
        } catch (error) {
            addToast("Error al actualizar: " + error.message, "error");
        } finally {
            setSavingEdit(false);
        }
    };

    /** Cambia el tipo del movimiento en el borrador. */
    const handleEditTypeChange = (newType) => {
        setEditFormData((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                type: newType,
                // Si la transacción no era una salida, no arrastra sucursal.
                sucursal: newType === "exit" ? prev.sucursal || "" : (prev.type === "exit" ? prev.sucursal : ""),
            };
        });
    };

    const updateItem = (index, patch) => {
        const items = [...editFormData.items];
        items[index] = { ...items[index], ...patch };
        setEditFormData({ ...editFormData, items });
    };

    const exportToExcel = async () => {
        const rows = filteredTransactions.map((tx) => ({
            Fecha: tx.timestamp?.toDate ? format(tx.timestamp.toDate(), "dd/MM/yyyy HH:mm:ss") : "",
            Tipo: typeLabel(tx.type),
            Referencia: tx.reference || "",
            Sucursal: getSucursal(tx) || "",
            Motivo: tx.reason || "",
            Productos: `${tx.items?.length || 0} producto(s)`,
            Total: getUpdatedTotal(tx),
            Notas: tx.notes || "",
        }));
        const { utils, writeFile } = await import("xlsx");
        const ws = utils.json_to_sheet(rows);
        ws["!cols"] = [{ wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 30 }];
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Historial");
        const file = `historial_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`;
        writeFile(wb, file);
        addToast(`Archivo exportado: ${file}`);
    };

    const rowActions = (tx) => (
        <div className="flex justify-end gap-0.5">
            <IconButton label="Ver detalle" icon={Eye} tone="brand" onClick={() => handleViewTransaction(tx)} />
            <IconButton label="Imprimir" icon={Printer} onClick={() => handlePrintTransaction(tx)} />
            {isAdmin && (
                <>
                    <IconButton label="Editar" icon={Pencil} onClick={() => handleEdit(tx)} />
                    <IconButton label="Eliminar" icon={Trash2} tone="danger" disabled={deleting === tx.id}
                        onClick={() => openDeleteDialog(tx)} />
                </>
            )}
        </div>
    );

    return (
        <div>
            {/* Iframe aislado de impresión (respaldo si el navegador bloquea pop-ups) */}
            <iframe ref={printFrameRef} title="Impresión" aria-hidden="true"
                style={{ position: "absolute", width: 0, height: 0, border: 0, visibility: "hidden" }} />

            <PageHeader
                title="Historial"
                sub={`Últimas ${transactions.length} transacciones`}
                icon={History}
                accent="entry"
                action={
                    filteredTransactions.length > 0 ? (
                        <button onClick={exportToExcel} className="btn-ghost !py-2.5">
                            <FileDown className="h-5 w-5" />
                            <span className="hidden sm:inline">Exportar</span>
                        </button>
                    ) : null
                }
            />

            <div className="card !p-3 mb-3 space-y-2.5">
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-3 pointer-events-none" />
                    <input type="search" className="input !pl-11"
                        placeholder="Buscar por producto, folio, sucursal, motivo..."
                        value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <Segmented options={TYPE_OPTIONS} value={typeFilter} onChange={setTypeFilter} accent="entry" />
            </div>

            {loading ? (
                <ListSkeleton rows={6} />
            ) : filteredTransactions.length === 0 ? (
                <EmptyState icon={Receipt} accent="entry" title="Sin transacciones"
                    hint={searchTerm || typeFilter !== "all" ? "Prueba con otro filtro." : "Las ventas y movimientos aparecerán aquí."} />
            ) : (
                <>
                    {/* Tabla en escritorio */}
                    <div className="hidden md:block card !p-0 overflow-hidden">
                        <div className="table-wrap">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th><th>Tipo</th><th>Folio</th><th>Motivo</th>
                                        <th>Sucursal</th><th className="!text-right">Total</th><th className="!text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTransactions.map((tx) => (
                                        <tr key={tx.id}>
                                            <td className="whitespace-nowrap text-ink-3 tnum">
                                                {tx.timestamp?.toDate ? format(tx.timestamp.toDate(), "dd/MM/yyyy HH:mm") : "--"}
                                            </td>
                                            <td><TypeBadge type={tx.type} /></td>
                                            <td className="font-extrabold text-brand-700 tnum">{tx.reference || "--"}</td>
                                            <td className="max-w-[180px] truncate">{tx.reason || "—"}</td>
                                            <td className="text-ink-3">{getSucursal(tx) || "--"}</td>
                                            <td className="!text-right font-extrabold !text-ink tnum">{money(getUpdatedTotal(tx))}</td>
                                            <td className="!text-right whitespace-nowrap">{rowActions(tx)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Tarjetas en móvil */}
                    <ul className="md:hidden space-y-2.5">
                        {filteredTransactions.map((tx) => (
                            <li key={tx.id} className="card !p-3.5">
                                <div className="flex items-center gap-2 mb-2">
                                    <TypeBadge type={tx.type} />
                                    <span className="ml-auto text-xs font-semibold text-ink-3 tnum">
                                        {tx.timestamp?.toDate ? format(tx.timestamp.toDate(), "dd/MM HH:mm") : "--"}
                                    </span>
                                </div>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        {tx.reference && <p className="text-sm font-extrabold text-brand-700 tnum">{tx.reference}</p>}
                                        {tx.reason && <p className="text-xs font-semibold text-ink-2 truncate">{tx.reason}</p>}
                                        {getSucursal(tx) && (
                                            <p className="text-xs text-ink-3 flex items-center gap-1 mt-0.5">
                                                <Store className="h-3 w-3" /> {getSucursal(tx)}
                                            </p>
                                        )}
                                    </div>
                                    <p className="text-lg font-extrabold text-ink tnum whitespace-nowrap">{money(getUpdatedTotal(tx))}</p>
                                </div>
                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-line">
                                    <p className="text-xs text-ink-3">{tx.items?.length || 0} producto(s)</p>
                                    {rowActions(tx)}
                                </div>
                            </li>
                        ))}
                    </ul>
                </>
            )}

            {/* Detalle */}
            <Sheet open={!!viewingTransaction} onClose={() => setViewingTransaction(null)}
                accent="entry" wide
                title={viewingTransaction ? `${typeLabel(viewingTransaction.type)} · ${viewingTransaction.reference || "s/ref"}` : ""}>
                {viewingTransaction && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-xl bg-paper border border-line p-3">
                                <p className="eyebrow">Fecha</p>
                                <p className="font-bold text-ink mt-0.5 tnum">
                                    {viewingTransaction.timestamp?.toDate ? format(viewingTransaction.timestamp.toDate(), "dd/MM/yyyy HH:mm") : "--"}
                                </p>
                            </div>
                            <div className="rounded-xl bg-paper border border-line p-3">
                                <p className="eyebrow">Total actual</p>
                                <p className="font-extrabold text-ink text-lg mt-0.5 tnum">{money(getUpdatedTotal(viewingTransaction))}</p>
                            </div>
                            {viewingTransaction.reason && (
                                <div className="rounded-xl bg-brand-50 border border-brand-200 p-3">
                                    <p className="eyebrow text-brand-700">Motivo</p>
                                    <p className="font-bold text-ink mt-0.5">{viewingTransaction.reason}</p>
                                </div>
                            )}
                            {viewingTransaction.party && (
                                <div className="rounded-xl bg-paper border border-line p-3">
                                    <p className="eyebrow">
                                        {viewingTransaction.type === "entry" ? "Proveedor" : "Destino"}
                                    </p>
                                    <p className="font-bold text-ink mt-0.5">{viewingTransaction.party}</p>
                                </div>
                            )}
                            {getSucursal(viewingTransaction) && (
                                <div className="rounded-xl bg-sky-50 border border-sky-200 p-3 col-span-2">
                                    <p className="eyebrow text-sky-700">Sucursal</p>
                                    <p className="font-bold text-ink mt-0.5">{getSucursal(viewingTransaction)}</p>
                                </div>
                            )}
                        </div>
                        <div className="table-wrap border border-line rounded-xl overflow-hidden">
                            <table className="table">
                                <thead><tr><th>Producto</th><th className="!text-center">Cant.</th><th className="!text-right">Unit.</th><th className="!text-right">Subtotal</th></tr></thead>
                                <tbody>
                                    {enrichedItems.map((item, i) => {
                                        const isMovement = viewingTransaction.type === "entry" || viewingTransaction.type === "exit";
                                        const unit = isMovement
                                            ? (item.currentCost ?? Number(item.cost || 0))
                                            : (item.currentPrice ?? Number(item.price || 0));
                                        const changed = isMovement ? item.costChanged : item.priceChanged;
                                        const original = isMovement ? Number(item.cost || 0) : Number(item.price || 0);
                                        return (
                                            <tr key={i}>
                                                <td className="font-bold !text-ink">
                                                    {item.name}
                                                    {changed && <span className="block text-[11px] font-medium text-ink-3 line-through tnum">antes {money(original)}</span>}
                                                </td>
                                                <td className="!text-center font-extrabold text-brand-700 tnum">×{item.quantity}</td>
                                                <td className="!text-right tnum">{money(unit)}</td>
                                                <td className="!text-right font-extrabold !text-ink tnum">{money(unit * Number(item.quantity))}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {viewingTransaction.notes && (
                            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5">
                                <p className="eyebrow text-amber-800 mb-1">Notas</p>
                                <p className="text-sm text-ink-2">{viewingTransaction.notes}</p>
                            </div>
                        )}
                        <div className="flex flex-col-reverse sm:flex-row gap-2.5">
                            <button onClick={() => setViewingTransaction(null)} className="btn-ghost flex-1">Cerrar</button>
                            <button onClick={() => handleDownloadPdf(viewingTransaction)} className="btn-soft flex-1">
                                <FileDown className="h-5 w-5" /> Descargar PDF
                            </button>
                            <button onClick={() => { setViewingTransaction(null); handlePrintTransaction(viewingTransaction); }} className="btn-primary flex-1">
                                <Printer className="h-5 w-5" /> Imprimir
                            </button>
                        </div>
                    </div>
                )}
            </Sheet>

            {/* Impresión */}
            <PrintModal open={!!printingTransaction} onClose={closePrintModal}
                title={printingTransaction ? `Imprimir ${typeLabel(printingTransaction.type)}` : ""}>
                {printingTransaction && (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-line bg-paper-deep p-2 sm:p-3">
                            <div className="mx-auto w-full max-w-[720px] overflow-hidden rounded-lg bg-white shadow-card"
                                style={{ aspectRatio: "210 / 297" }}>
                                <iframe
                                    title="Vista previa del documento"
                                    srcDoc={buildReceiptHtml(printingTransaction, company)}
                                    className="h-full w-full border-0"
                                    style={{ zoom: 0.6 }}
                                />
                            </div>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
                            <button onClick={closePrintModal} className="btn-ghost flex-1">Cancelar</button>
                            <button onClick={() => handleDownloadPdf(printingTransaction)} className="btn-soft flex-1">
                                <FileDown className="h-5 w-5" /> Descargar PDF
                            </button>
                            <button onClick={doPrint} className="btn-primary flex-1">
                                <Printer className="h-5 w-5" /> Imprimir
                            </button>
                        </div>
                    </div>
                )}
            </PrintModal>

            {/* Eliminar */}
            <Sheet open={!!deleteTarget} onClose={closeDeleteDialog} title="Eliminar movimiento">
                {deleteTarget && (
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 rounded-xl bg-rose-50 border border-rose-200 p-3.5">
                            <span className="h-10 w-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0">
                                <Trash2 className="h-5 w-5" />
                            </span>
                            <p className="text-sm text-ink-2">
                                Se eliminará la <strong className="text-ink">{typeLabel(deleteTarget.type).toLowerCase()}</strong>
                                {deleteTarget.reference ? ` ${formatReferenceLabel(deleteTarget.type, deleteTarget.reference)}` : ""} del{" "}
                                <strong className="text-ink">
                                    {deleteTarget.timestamp?.toDate ? format(deleteTarget.timestamp.toDate(), "dd/MM/yyyy HH:mm") : "--"}
                                </strong>{" "}
                                y se revertirá el stock de {deleteTarget.items?.length || 0} producto(s). Esta acción no se puede deshacer.
                            </p>
                        </div>

                        {isCorrelativeType(deleteTarget.type) && deleteTarget.reference && (
                            <label className="flex items-start gap-3 p-3 rounded-xl bg-paper border border-line cursor-pointer">
                                <input type="checkbox" className="mt-0.5 h-5 w-5 rounded accent-brand-600"
                                    checked={reclaimReference}
                                    onChange={(e) => setReclaimReference(e.target.checked)} />
                                <span className="text-sm">
                                    <span className="font-bold text-ink">Devolver el número al correlativo</span>
                                    <span className="block text-xs text-ink-3 mt-0.5">
                                        Solo se reutiliza si es el último de la serie. Si hay movimientos posteriores,
                                        el número queda libre pero la numeración continúa.
                                    </span>
                                </span>
                            </label>
                        )}

                        <div className="flex gap-2.5">
                            <button onClick={closeDeleteDialog} className="btn-ghost flex-1" disabled={!!deleting}>
                                Cancelar
                            </button>
                            <button onClick={confirmDelete} className="btn-danger flex-1" disabled={!!deleting}>
                                {deleting ? "Eliminando..." : "Eliminar"}
                            </button>
                        </div>
                    </div>
                )}
            </Sheet>

            {/* Edición */}
            <Sheet open={!!editingTransaction} onClose={() => { setEditingTransaction(null); setEditFormData(null); }}
                accent="brand" wide
                title={editFormData ? `Editar ${typeLabel(editFormData.type)}` : ""}>
                {editFormData && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="label">Tipo</label>
                                <select value={editFormData.type}
                                    onChange={(e) => handleEditTypeChange(e.target.value)}
                                    className="select" disabled={editingTransaction.type === "sale"}>
                                    <option value="entry">Entrada</option>
                                    <option value="exit">Salida</option>
                                    {editingTransaction.type === "sale" && <option value="sale">Venta</option>}
                                </select>
                                {editFormData.type !== editingTransaction.type && (
                                    <p className="text-[11px] text-amber-800 font-bold mt-1">
                                        Pasa a la serie de {editFormData.type === "entry" ? "entradas" : "salidas"}.
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="label">Folio *</label>
                                <input type="text" inputMode="numeric" autoComplete="off"
                                    value={editFormData.reference || ""}
                                    placeholder={isCorrelativeType(editFormData.type) ? "0001" : ""}
                                    onChange={(e) => setEditFormData({ ...editFormData, reference: e.target.value })}
                                    className="input font-mono tracking-wider" />
                            </div>
                            <div>
                                <label className="label">Fecha</label>
                                <input type="date" value={editFormData.date}
                                    onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                                    className="input" />
                            </div>
                            <div>
                                <label className="label">Hora</label>
                                <input type="time" value={editFormData.time}
                                    onChange={(e) => setEditFormData({ ...editFormData, time: e.target.value })}
                                    className="input" />
                            </div>
                        </div>
                        {editFormData.type === "exit" && (
                            <div>
                                <label className="label">Sucursal destino *</label>
                                <input type="text" value={editFormData.sucursal || ""}
                                    onChange={(e) => setEditFormData({ ...editFormData, sucursal: e.target.value })}
                                    className="input" />
                            </div>
                        )}
                        {(editFormData.type === "entry" || editFormData.type === "exit") && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="label">Motivo</label>
                                    <select value={editFormData.reason || ""}
                                        onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })}
                                        className="select">
                                        <option value="">— Sin especificar —</option>
                                        {reasonsFor(editFormData.type).map((r) => (
                                            <option key={r} value={r}>{r}</option>
                                        ))}
                                        {/* Motivos ya guardados que no están en el catálogo. */}
                                        {editFormData.reason && !reasonsFor(editFormData.type).includes(editFormData.reason) && (
                                            <option value={editFormData.reason}>{editFormData.reason}</option>
                                        )}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">{partyLabelFor(editFormData.type)}</label>
                                    <input type="text" value={editFormData.party || ""}
                                        placeholder={partyPlaceholderFor(editFormData.type)}
                                        onChange={(e) => setEditFormData({ ...editFormData, party: e.target.value })}
                                        className="input" />
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="label">Notas</label>
                            <textarea value={editFormData.notes || ""}
                                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                                className="input resize-none" rows="2" />
                        </div>
                        <div>
                            <p className="label">Productos</p>
                            <div className="border border-line rounded-xl overflow-hidden divide-y divide-line">
                                {editFormData.items.map((item, i) => {
                                    const isMovement = editFormData.type === "entry" || editFormData.type === "exit";
                                    return (
                                        <div key={i} className="p-3 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <p className="flex-1 font-bold text-sm text-ink truncate">{item.name}</p>
                                                <IconButton label={`Quitar ${item.name}`} icon={Trash2} tone="danger"
                                                    onClick={() => setEditFormData({ ...editFormData, items: editFormData.items.filter((_, j) => j !== i) })} />
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                    <label className="label !mb-0.5">Cant.</label>
                                                    <input type="number" min="1" value={item.quantity}
                                                        onChange={(e) => updateItem(i, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                                                        className="input !py-2 tnum" />
                                                </div>
                                                <div>
                                                    <label className="label !mb-0.5">Precio</label>
                                                    <input type="number" step="0.01" min="0" value={item.price || 0} disabled={isMovement}
                                                        onChange={(e) => updateItem(i, { price: Number(e.target.value) || 0 })}
                                                        className="input !py-2 disabled:bg-paper-deep tnum" />
                                                </div>
                                                <div>
                                                    <label className="label !mb-0.5">Costo</label>
                                                    <input type="number" step="0.01" min="0" value={item.cost || 0} disabled={editFormData.type === "sale"}
                                                        onChange={(e) => updateItem(i, { cost: Number(e.target.value) || 0 })}
                                                        className="input !py-2 disabled:bg-paper-deep tnum" />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex gap-2.5">
                            <button onClick={() => { setEditingTransaction(null); setEditFormData(null); }}
                                className="btn-ghost flex-1" disabled={savingEdit}>Cancelar</button>
                            <button onClick={handleSaveEdit} disabled={savingEdit} className="btn-primary flex-1">
                                {savingEdit ? "Guardando..." : "Guardar cambios"}
                            </button>
                        </div>
                    </div>
                )}
            </Sheet>
        </div>
    );
}
