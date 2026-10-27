import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
    Search, Plus, Minus, ArrowDownLeft, ArrowUpRight, Printer, Trash2, Package,
    CheckCircle2, RotateCcw, AlertTriangle, X, CalendarDays, FileText, ArrowRightLeft,
    ShoppingCart, Sparkles, FileDown,
} from "lucide-react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../firebase.config";
import {
    getProducts, adjustStock, getNextCorrelativo, isReferenceTaken,
    normalizeReference, formatReferenceLabel, isCorrelativeType,
} from "../lib/db";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { useRole } from "../hooks/useRole";
import { useCompany } from "../hooks/useCompany";
import { buildReceiptHtml, printHtmlDocument, openHtmlDocument, getSucursal } from "../lib/receipt";
import {
    reasonsFor, partyLabelFor, partyPlaceholderFor, knownSucursales,
} from "../lib/movements";
import { PageHeader, EmptyState, ListSkeleton, PrintModal, Chip } from "../components/ui";

/** Fecha de hoy en formato ISO, construida en la zona horaria local. */
const todayStr = () => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
};

const REFERENCE_MAX_LENGTH = 8;
const DRAFT_KEY_PREFIX = "churreria:movimiento:borrador";
const DRAFT_VERSION = 1;
const OTHER_SUCURSAL = "__otra__";

const money = (value) =>
    "$" + Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const emptyDraft = () => ({
    type: "entry",
    reason: "",
    party: "",
    sucursal: "",
    sucursalOther: "",
    notes: "",
    date: todayStr(),
    items: [],
});

/** Clave privada por usuario: dos sesiones no deben heredarse el borrador. */
const draftKey = (uid) => `${DRAFT_KEY_PREFIX}:${uid || "anon"}`;

/** Lee el borrador guardado. Nunca rompe la pantalla por un JSON corrupto. */
const readDraft = (uid) => {
    try {
        const raw = localStorage.getItem(draftKey(uid));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== DRAFT_VERSION) return null;
        return { ...emptyDraft(), ...parsed.data };
    } catch {
        return null;
    }
};

export default function StockAdjustment() {
    const { user } = useAuth();

    // El borrador se lee una sola vez, al montar. `useRef(readDraft())` evaluaria
    // el argumento en cada render y golpearia localStorage sin necesidad.
    const draftRef = useRef(null);
    if (draftRef.current === null) draftRef.current = readDraft(user?.uid) || false;
    const draft = draftRef.current || null;

    const [products, setProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [transactions, setTransactions] = useState([]);

    const [type, setType] = useState(draft?.type || "entry");
    const [reason, setReason] = useState(draft?.reason || "");
    const [party, setParty] = useState(draft?.party || "");
    const [sucursal, setSucursal] = useState(draft?.sucursal || "");
    const [sucursalOther, setSucursalOther] = useState(draft?.sucursalOther || "");
    const [notes, setNotes] = useState(draft?.notes || "");
    const [selectedDate, setSelectedDate] = useState(draft?.date || todayStr());
    const [items, setItems] = useState(draft?.items || []);

    const [searchTerm, setSearchTerm] = useState("");
    const [highlight, setHighlight] = useState(0);
    const [processing, setProcessing] = useState(false);
    const [confirmNegative, setConfirmNegative] = useState(false);
    const [receipt, setReceipt] = useState(null);

    // Correlativo
    const [reference, setReference] = useState("");
    const [referenceAuto, setReferenceAuto] = useState(true);
    const [seriesReadable, setSeriesReadable] = useState(true);
    const [suggested, setSuggested] = useState("");
    const [lastSeries, setLastSeries] = useState(0);
    const [checkingRef, setCheckingRef] = useState(false);
    const [refTaken, setRefTaken] = useState(false);

    const { addToast } = useToast();
    const { isAdmin } = useRole();
    const company = useCompany();
    const printerRef = useRef();
    const searchRef = useRef();

    // --- Datos -------------------------------------------------------------
    useEffect(() => {
        const unsub = getProducts((data) => {
            setProducts(data);
            setLoadingProducts(false);
        });
        return () => unsub();
    }, []);

    // Los datos guardados en el borrador son una instantánea: se sincronizan
    // contra el catálogo actual para no mostrar advertencias de stock viejas.
    useEffect(() => {
        if (!products.length) return;
        setItems((prev) => prev.map((item) => {
            const product = products.find((p) => p.id === item.productId);
            return product
                ? {
                    ...item,
                    name: product.name || item.name,
                    sku: product.sku || "",
                    price: Number(product.price || 0),
                    cost: Number(product.cost || 0),
                    currentStock: Number(product.stock || 0),
                }
                : item;
        }));
    }, [products]);

    // Movimientos recientes: solo para conocer sucursales ya usadas.
    useEffect(() => {
        const q = query(collection(db, "transactions"), orderBy("timestamp", "desc"), limit(200));
        const unsub = onSnapshot(q, (snap) => {
            setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }, () => { /* sin permiso: el select queda con la opción libre */ });
        return () => unsub();
    }, []);

    // --- Correlativo -------------------------------------------------------
    useEffect(() => {
        let active = true;
        const fetchCorrelativo = async () => {
            try {
                const { reference: next, last } = await getNextCorrelativo(type);
                if (!active) return;
                setSeriesReadable(true);
                setSuggested(next);
                setLastSeries(last);
                if (referenceAuto) setReference(next);
            } catch {
                if (!active) return;
                setSeriesReadable(false);
                setReferenceAuto(false);
                setSuggested("");
                setLastSeries(0);
            }
        };
        fetchCorrelativo();
        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type, selectedDate]);

    useEffect(() => {
        if (referenceAuto || !isCorrelativeType(type)) {
            setRefTaken(false);
            return;
        }
        const normalized = normalizeReference(reference);
        if (!normalized || normalized === suggested) {
            setRefTaken(false);
            return;
        }
        let active = true;
        setCheckingRef(true);
        isReferenceTaken(type, normalized)
            .then((taken) => { if (active) setRefTaken(taken); })
            .catch(() => { if (active) setRefTaken(false); })
            .finally(() => { if (active) setCheckingRef(false); });
        return () => { active = false; };
    }, [reference, referenceAuto, suggested, type]);

    // --- Borrador ----------------------------------------------------------
    useEffect(() => {
        const handle = setTimeout(() => {
            try {
                const data = { type, reason, party, sucursal, sucursalOther, notes, date: selectedDate, items };
                localStorage.setItem(draftKey(user?.uid), JSON.stringify({ version: DRAFT_VERSION, data }));
            } catch { /* almacenamiento lleno o bloqueado: se ignora */ }
        }, 400);
        return () => clearTimeout(handle);
    }, [user?.uid, type, reason, party, sucursal, sucursalOther, notes, selectedDate, items]);

    const clearDraft = () => {
        try { localStorage.removeItem(draftKey(user?.uid)); } catch { /* noop */ }
    };

    // --- Derivados ---------------------------------------------------------
    const isEntry = type === "entry";
    const reasons = reasonsFor(type);
    const partyLabel = partyLabelFor(type);

    const sucursales = useMemo(() => knownSucursales(transactions, getSucursal), [transactions]);
    const sucursalFinal = sucursal === OTHER_SUCURSAL ? sucursalOther.trim() : sucursal;

    const filteredProducts = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return products.slice(0, 8);
        return products
            .filter((p) => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)))
            .slice(0, 8);
    }, [products, searchTerm]);

    useEffect(() => { setHighlight(0); }, [searchTerm]);

    const totals = useMemo(() => {
        const units = items.reduce((a, i) => a + Number(i.quantity || 0), 0);
        const value = items.reduce((a, i) => a + Number(i.cost || 0) * Number(i.quantity || 0), 0);
        return { units, value, lines: items.length };
    }, [items]);

    /** Líneas cuya cantidad excede la existencia actual (solo salidas). */
    const shortfalls = useMemo(() => {
        if (isEntry) return [];
        return items.filter((i) => Number(i.quantity) > Number(i.currentStock ?? 0));
    }, [items, isEntry]);

    const hasShortfall = shortfalls.length > 0;

    // --- Acciones ----------------------------------------------------------
    const addProduct = useCallback((product) => {
        if (!product) return;
        setItems((prev) => {
            const existing = prev.find((i) => i.productId === product.id);
            if (existing) {
                // Ya está en el carrito: se suma en lugar de bloquear.
                return prev.map((i) =>
                    i.productId === product.id
                        ? { ...i, quantity: Number(i.quantity) + 1 }
                        : i
                );
            }
            return [
                ...prev,
                {
                    productId: product.id,
                    name: product.name,
                    sku: product.sku || "",
                    quantity: 1,
                    price: Number(product.price || 0),
                    cost: Number(product.cost || 0),
                    currentStock: Number(product.stock || 0),
                },
            ];
        });
        setSearchTerm("");
        searchRef.current?.focus();
    }, []);

    const setQuantity = (productId, value) => {
        const qty = Math.max(0, parseInt(value, 10) || 0);
        setItems((prev) =>
            prev.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i))
        );
    };

    const stepQuantity = (productId, delta) => {
        setItems((prev) =>
            prev.map((i) =>
                i.productId === productId
                    ? { ...i, quantity: Math.max(0, Number(i.quantity) + delta) }
                    : i
            )
        );
    };

    const removeItem = (productId) => {
        setItems((prev) => prev.filter((i) => i.productId !== productId));
    };

    const changeType = (next) => {
        if (next === type) return;
        setType(next);
        setReason("");
        setReferenceAuto(true);
        setRefTaken(false);
        setConfirmNegative(false);
    };

    const restoreAutoReference = async () => {
        setReferenceAuto(true);
        setRefTaken(false);
        try {
            const { reference: next, last } = await getNextCorrelativo(type);
            setSuggested(next);
            setLastSeries(last);
            setReference(next);
        } catch {
            setReferenceAuto(false);
            setSeriesReadable(false);
        }
    };

    const resetForm = () => {
        setItems([]);
        setReason("");
        setParty("");
        setSucursal("");
        setSucursalOther("");
        setNotes("");
        setSelectedDate(todayStr());
        setReference("");
        setReferenceAuto(true);
        setRefTaken(false);
        setConfirmNegative(false);
        setSearchTerm("");
        clearDraft();
    };

    const submit = async (force = false) => {
        if (!isAdmin) {
            addToast("Solo los administradores pueden realizar ajustes de inventario.", "error");
            return;
        }
        const clean = items.filter((i) => Number(i.quantity) > 0);
        if (clean.length === 0) {
            addToast("Agrega al menos un producto con cantidad mayor a cero.", "error");
            return;
        }
        if (!reason) {
            addToast("Selecciona el motivo del movimiento.", "error");
            return;
        }
        if (!isEntry && !sucursalFinal) {
            addToast("Indica la sucursal o el destino de la salida.", "error");
            return;
        }
        const autoReference = referenceAuto && seriesReadable;
        const manualReference = autoReference ? "" : normalizeReference(reference);
        if (!autoReference && !manualReference) {
            addToast("Ingresa el número de folio o vuelve al modo automático.", "error");
            return;
        }
        if (refTaken) {
            addToast(`El folio ${formatReferenceLabel(type, manualReference)} ya está usado.`, "error");
            return;
        }
        // Salida que deja stock negativo: se pide confirmación explícita una vez.
        if (!isEntry && hasShortfall && !force) {
            setConfirmNegative(true);
            return;
        }

        setProcessing(true);
        try {
            const transactionDate = selectedDate === todayStr()
                ? new Date()
                : new Date(selectedDate + "T12:00:00");

            const { reference: assignedReference } = await adjustStock(clean, type, user.uid, {
                notes,
                reference: manualReference || null,
                customDate: transactionDate,
                sucursal: sucursalFinal,
                createdBy: user.email,
                reason,
                party,
                allowNegative: force,
            });

            const html = buildReceiptHtml({
                items: clean,
                type,
                total: 0,
                reference: assignedReference,
                notes,
                sucursal: sucursalFinal,
                reason,
                party,
                timestamp: transactionDate,
                createdBy: user.email,
            }, company);

            // Ya no se abre una ventana sola: el comprobante se muestra y el
            // usuario decide si imprime.
            setReceipt({ html, reference: assignedReference });

            const typeText = isEntry ? "Entrada" : "Salida";
            addToast(
                assignedReference
                    ? `¡${typeText} ${formatReferenceLabel(type, assignedReference)} registrada!`
                    : `¡${typeText} registrada!`
            );
            resetForm();
        } catch (error) {
            const message = error?.code === "insufficient-stock"
                ? error.message
                : "Error: " + error.message;
            addToast(message, "error");
        } finally {
            setProcessing(false);
            setConfirmNegative(false);
        }
    };

    const printReceipt = () => {
        if (!receipt) return;
        if (!printHtmlDocument(receipt.html, printerRef.current)) {
            addToast("Permite las ventanas emergentes para imprimir", "error");
        }
    };

    const downloadReceiptPdf = () => {
        if (!receipt) return;
        if (!openHtmlDocument(receipt.html)) {
            addToast("Permite las ventanas emergentes para descargar el PDF", "error");
            return;
        }
        addToast("Selecciona «Guardar como PDF» en el visor de impresión");
    };

    const onSearchKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addProduct(filteredProducts[highlight]);
        } else if (e.key === "Escape") {
            setSearchTerm("");
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, filteredProducts.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
        }
    };

    const lastSeriesLabel = lastSeries > 0 ? String(lastSeries).padStart(4, "0") : "";
    const accent = isEntry ? "emerald" : "exit";
    const submitClass = isEntry ? "btn-success" : "btn-warning";

    return (
        <div>
            <iframe ref={printerRef} title="Impresión" aria-hidden="true"
                style={{ position: "absolute", width: 0, height: 0, border: 0, visibility: "hidden" }} />

            <PageHeader
                title="Nuevo movimiento"
                sub={isEntry ? "Mercancía que entra al almacén" : "Mercancía que sale del almacén"}
                icon={ArrowRightLeft}
                accent={accent}
            />

            {/* Tipo: control segmentado, siempre visible */}
            <div className="grid grid-cols-2 gap-2 mb-3" role="tablist" aria-label="Tipo de movimiento">
                <button
                    role="tab"
                    aria-selected={isEntry}
                    onClick={() => changeType("entry")}
                    className={`rounded-2xl min-h-[56px] px-3 font-extrabold text-sm flex items-center justify-center gap-2 transition-all border-2
                        ${isEntry
                            ? "bg-emerald-800 text-white border-emerald-800 shadow-[0_8px_20px_-10px_rgba(6,95,70,0.7)]"
                            : "bg-white text-ink-2 border-line-strong hover:border-emerald-600 hover:text-emerald-800"}`}
                >
                    <ArrowDownLeft className="h-5 w-5" strokeWidth={2.4} /> Entrada
                </button>
                <button
                    role="tab"
                    aria-selected={!isEntry}
                    onClick={() => changeType("exit")}
                    className={`rounded-2xl min-h-[56px] px-3 font-extrabold text-sm flex items-center justify-center gap-2 transition-all border-2
                        ${!isEntry
                            ? "bg-amber-700 text-white border-amber-700 shadow-[0_8px_20px_-10px_rgba(180,83,9,0.7)]"
                            : "bg-white text-ink-2 border-line-strong hover:border-amber-600 hover:text-amber-800"}`}
                >
                    <ArrowUpRight className="h-5 w-5" strokeWidth={2.4} /> Salida
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                {/* Columna izquierda: captura */}
                <div className="lg:col-span-3 space-y-3">
                    {/* Motivo */}
                    <div className="card !p-4">
                        <label className="label flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5" /> Motivo <span className="text-rose-600">*</span>
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {reasons.map((r) => (
                                <Chip key={r} accent={accent} active={reason === r} onClick={() => setReason(r)}>
                                    {r}
                                </Chip>
                            ))}
                        </div>
                    </div>

                    {/* Proveedor / Destino */}
                    <div className="card !p-4">
                        <label className="label" htmlFor="mov-party">{partyLabel}</label>
                        <input
                            id="mov-party"
                            type="text"
                            className="input"
                            placeholder={partyPlaceholderFor(type)}
                            value={party}
                            onChange={(e) => setParty(e.target.value)}
                        />
                    </div>

                    {/* Buscador */}
                    <div className="card !p-4">
                        <label className="label" htmlFor="mov-search">Agregar producto</label>
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-3 pointer-events-none" />
                            <input
                                id="mov-search"
                                ref={searchRef}
                                type="search"
                                placeholder="Nombre o código... (Enter agrega el primero)"
                                className="input !pl-11"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={onSearchKeyDown}
                            />
                        </div>

                        {loadingProducts ? (
                            <div className="mt-3"><ListSkeleton rows={3} /></div>
                        ) : filteredProducts.length > 0 ? (
                            <ul className="mt-2 space-y-0.5">
                                {filteredProducts.map((p, idx) => {
                                    const inCart = items.find((i) => i.productId === p.id);
                                    return (
                                        <li key={p.id}>
                                            <button
                                                type="button"
                                                onClick={() => addProduct(p)}
                                                onMouseEnter={() => setHighlight(idx)}
                                                className={`w-full min-h-[44px] text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-colors
                                                    ${idx === highlight ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-paper"}`}
                                            >
                                                <span className="flex-1 min-w-0">
                                                    <span className="block font-bold text-ink text-sm truncate">{p.name}</span>
                                                    <span className="block text-xs text-ink-3">
                                                        Stock: {p.stock}{p.sku ? ` · ${p.sku}` : ""}
                                                    </span>
                                                </span>
                                                {inCart ? (
                                                    <span className="badge-muted shrink-0 tnum">×{inCart.quantity}</span>
                                                ) : (
                                                    <span className="h-8 w-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                                                        <Plus className="h-4 w-4" strokeWidth={2.6} />
                                                    </span>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="text-center text-sm text-ink-3 py-4">
                                {searchTerm ? "Sin resultados" : "Escribe para buscar productos"}
                            </p>
                        )}
                    </div>

                    {/* Carrito */}
                    <div className="card !p-4">
                        <div className="flex items-center justify-between mb-2">
                            <p className="label !mb-0 flex items-center gap-1.5">
                                <ShoppingCart className="h-3.5 w-3.5" /> Carrito
                                {items.length > 0 && <span className="badge-muted tnum">{items.length}</span>}
                            </p>
                            {items.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setItems([])}
                                    className="text-xs font-bold text-ink-3 hover:text-rose-700 transition-colors"
                                >
                                    Vaciar
                                </button>
                            )}
                        </div>

                        {items.length === 0 ? (
                            <EmptyState accent={accent} icon={Package} title="Sin partidas" hint="Busca un producto arriba para agregarlo." />
                        ) : (
                            <ul className="divide-y divide-line">
                                {items.map((item) => {
                                    const exceeds = !isEntry && Number(item.quantity) > Number(item.currentStock ?? 0);
                                    return (
                                        <li key={item.productId} className="py-2.5 flex items-center gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-ink truncate text-sm">{item.name}</p>
                                                <p className={`text-xs ${exceeds ? "text-rose-700 font-bold" : "text-ink-3"}`}>
                                                    {exceeds
                                                        ? `Excede el stock (${item.currentStock} disponibles)`
                                                        : `Stock: ${item.currentStock} · ${money(item.cost)} c/u`}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-0.5 bg-paper rounded-xl border border-line p-0.5 shrink-0">
                                                <button type="button" onClick={() => stepQuantity(item.productId, -1)}
                                                    className="hit-area h-8 w-8 flex items-center justify-center text-ink-2 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                                                    aria-label={`Menos ${item.name}`}>
                                                    <Minus className="h-3.5 w-3.5" strokeWidth={2.6} />
                                                </button>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={item.quantity}
                                                    onChange={(e) => setQuantity(item.productId, e.target.value)}
                                                    className={`w-12 h-8 text-center font-extrabold text-sm bg-transparent focus:outline-none tnum ${exceeds ? "text-rose-700" : "text-ink"}`}
                                                    aria-label={`Cantidad de ${item.name}`}
                                                />
                                                <button type="button" onClick={() => stepQuantity(item.productId, 1)}
                                                    className="hit-area h-8 w-8 flex items-center justify-center text-ink-2 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                                                    aria-label={`Más ${item.name}`}>
                                                    <Plus className="h-3.5 w-3.5" strokeWidth={2.6} />
                                                </button>
                                            </div>

                                            <span className="w-20 text-right font-extrabold text-sm text-ink shrink-0 tnum">
                                                {money(Number(item.cost || 0) * Number(item.quantity || 0))}
                                            </span>

                                            <button type="button" onClick={() => removeItem(item.productId)}
                                                aria-label={`Quitar ${item.name}`}
                                                className="btn-icon !text-rose-600 hover:!bg-rose-50 shrink-0">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Columna derecha: resumen y datos del comprobante */}
                <div className="lg:col-span-2 space-y-3">
                    {/* Resumen destacado */}
                    <div className="relative rounded-2xl bg-ink text-white p-4 shadow-pop overflow-hidden">
                        {/* Acento superior: sin blur, así no sobresale del recorte. */}
                        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-brand-400 to-amber-400" aria-hidden="true" />
                        <div className="relative">
                            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/75">Resumen</p>
                            <div className="mt-3 grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">Partidas</p>
                                    <p className="text-xl font-extrabold tnum">{totals.lines}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">Unidades</p>
                                    <p className="text-xl font-extrabold tnum">{totals.units}</p>
                                </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-white/20 flex items-end justify-between gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-wide text-white/70">Valor a costo</span>
                                <span className="text-2xl font-extrabold text-brand-300 tnum">{money(totals.value)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="card !p-4 space-y-3">
                        <div>
                            <label className="label" htmlFor="mov-date">
                                <CalendarDays className="inline h-3.5 w-3.5 mr-1" />Fecha <span className="text-rose-600">*</span>
                            </label>
                            <input id="mov-date" type="date" className="input" value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)} />
                        </div>

                        <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                                <label className="label !mb-0" htmlFor="mov-ref">
                                    Folio ({isEntry ? "ENT" : "SAL"})
                                </label>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${!seriesReadable
                                    ? "bg-paper-deep text-ink-2"
                                    : referenceAuto
                                        ? "bg-brand-100 text-brand-700"
                                        : "bg-amber-100 text-amber-800"}`}>
                                    {!seriesReadable ? "Manual" : referenceAuto ? "Automático" : "Manual"}
                                </span>
                            </div>
                            <input
                                id="mov-ref"
                                type="text"
                                inputMode="numeric"
                                autoComplete="off"
                                maxLength={REFERENCE_MAX_LENGTH}
                                placeholder={suggested || "0001"}
                                className={`input font-mono tracking-wider tnum ${refTaken ? "!border-rose-500 !ring-2 !ring-rose-200" : ""}`}
                                value={reference}
                                onChange={(e) => { setReference(e.target.value); setReferenceAuto(false); }}
                                aria-invalid={refTaken}
                            />
                            <div className="mt-1 flex items-center justify-between gap-2">
                                <p className={`text-[11px] leading-tight ${refTaken ? "text-rose-700 font-bold" : "text-ink-3"}`}>
                                    {refTaken
                                        ? `Folio ${formatReferenceLabel(type, normalizeReference(reference))} ya usado`
                                        : checkingRef
                                            ? "Verificando folio..."
                                            : !seriesReadable
                                                ? "Escribe el folio que sigue en el talonario"
                                                : lastSeriesLabel
                                                    ? `Último ${formatReferenceLabel(type, lastSeriesLabel)}`
                                                    : "Primer movimiento"}
                                </p>
                                {!referenceAuto && seriesReadable && (
                                    <button type="button" onClick={restoreAutoReference}
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-700 hover:underline shrink-0 min-h-[32px]">
                                        <RotateCcw className="h-3 w-3" /> Automático
                                    </button>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="label" htmlFor="mov-suc">
                                Sucursal {isEntry ? "(receptora)" : "destino"} {!isEntry && <span className="text-rose-600">*</span>}
                            </label>
                            <select
                                id="mov-suc"
                                className="select"
                                value={sucursal}
                                onChange={(e) => setSucursal(e.target.value)}
                            >
                                <option value="">— Sin especificar —</option>
                                {sucursales.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                                <option value={OTHER_SUCURSAL}>Otra…</option>
                            </select>
                            {sucursal === OTHER_SUCURSAL && (
                                <input
                                    type="text"
                                    className="input mt-2"
                                    placeholder="Nombre de la sucursal"
                                    value={sucursalOther}
                                    onChange={(e) => setSucursalOther(e.target.value)}
                                    aria-label="Nombre de la sucursal"
                                />
                            )}
                        </div>

                        <div>
                            <label className="label" htmlFor="mov-notes">
                                <FileText className="inline h-3.5 w-3.5 mr-1" />Notas (opcional)
                            </label>
                            <textarea
                                id="mov-notes"
                                rows={2}
                                className="input resize-none"
                                placeholder="Comentarios del movimiento..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    {hasShortfall && (
                        <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 flex gap-2">
                            <AlertTriangle className="h-5 w-5 text-rose-700 shrink-0 mt-0.5" />
                            <div className="text-xs text-rose-900">
                                <p className="font-bold">{shortfalls.length} partida(s) exceden el stock.</p>
                                <p className="mt-0.5">Se pedirá confirmación antes de registrar.</p>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => submit(false)}
                        disabled={processing || items.length === 0}
                        className={`${submitClass} w-full !text-base min-h-[52px]`}
                    >
                        {processing ? (
                            <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : isEntry ? (
                            <ArrowDownLeft className="h-5 w-5" strokeWidth={2.4} />
                        ) : (
                            <ArrowUpRight className="h-5 w-5" strokeWidth={2.4} />
                        )}
                        {processing ? "Guardando..." : `Registrar ${isEntry ? "entrada" : "salida"}`}
                    </button>
                </div>
            </div>

            {/* Confirmación de stock excedido */}
            {confirmNegative && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 isolate" role="dialog" aria-modal="true">
                    <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm animate-fade-in" onClick={() => setConfirmNegative(false)} aria-hidden="true" />
                    <div className="relative z-10 bg-white w-full max-w-md rounded-2xl shadow-pop p-5 animate-scale-in">
                        <div className="flex items-start gap-3">
                            <span className="p-2.5 rounded-xl bg-rose-100 shrink-0">
                                <AlertTriangle className="h-6 w-6 text-rose-700" />
                            </span>
                            <div className="min-w-0">
                                <h2 className="font-extrabold text-ink">Stock insuficiente</h2>
                                <p className="text-sm text-ink-2 mt-1">
                                    Estas partidas dejarán existencias negativas:
                                </p>
                                <ul className="mt-2 space-y-1 text-sm">
                                    {shortfalls.map((s) => (
                                        <li key={s.productId} className="text-ink-2">
                                            <b className="text-ink">{s.name}</b>: {s.currentStock} disponibles, {s.quantity} solicitadas
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => setConfirmNegative(false)} className="btn-ghost flex-1">
                                Corregir
                            </button>
                            <button onClick={() => submit(true)} disabled={processing} className="btn-danger flex-1">
                                Registrar de todos modos
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Comprobante tras guardar */}
            <PrintModal
                open={!!receipt}
                onClose={() => setReceipt(null)}
                title={receipt?.reference ? `Comprobante ${receipt.reference}` : "Comprobante"}
            >
                <div className="space-y-3">
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                        <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0" />
                        <p className="text-sm text-emerald-900 font-bold">Movimiento registrado correctamente.</p>
                    </div>
                    <iframe
                        title="Vista previa del comprobante"
                        srcDoc={receipt?.html || ""}
                        className="w-full rounded-xl border border-line bg-white"
                        style={{ height: "46vh" }}
                    />
                    <div className="flex flex-col-reverse sm:flex-row gap-2">
                        <button onClick={() => setReceipt(null)} className="btn-ghost flex-1">
                            <X className="h-4 w-4" /> Cerrar
                        </button>
                        <button onClick={downloadReceiptPdf} className="btn-soft flex-1">
                            <FileDown className="h-4 w-4" /> Descargar PDF
                        </button>
                        <button onClick={printReceipt} className="btn-primary flex-1">
                            <Printer className="h-4 w-4" /> Imprimir
                        </button>
                    </div>
                </div>
            </PrintModal>
        </div>
    );
}
