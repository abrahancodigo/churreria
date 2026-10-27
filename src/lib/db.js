import { db } from "../firebase.config";
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    getDoc,
    query,
    orderBy,
    onSnapshot,
    runTransaction,
    setDoc,
    writeBatch,
    limit,
    where
} from "firebase/firestore";

// Collection References
const productsRef = collection(db, "products");
const transactionsRef = collection(db, "transactions");

// --- Correlativos ---
// Cada tipo de movimiento lleva su propia serie continua: entradas 0001, 0002...
// y salidas 0001, 0002... por separado (el comprobante ya imprime ENT/SAL).
// `counters/global_movements` queda como legado: se lee para no perder el
// consecutivo actual y se sigue escribiendo sincronizado.

const SERIES_ID = "movement_series";
const LEGACY_COUNTER_ID = "global_movements";
const MOVEMENT_TYPES = ["entry", "exit"];
const REFERENCE_PAD = 4;

/** Tipos que llevan correlativo (las ventas no). */
export const isCorrelativeType = (type) => MOVEMENT_TYPES.includes(type);

/** Etiqueta del documento según el tipo. */
export const referencePrefix = (type) => (type === "entry" ? "ENT" : "SAL");

/** Folio completo para leyendas: "ENT-0007" / "SAL-0003". */
export const formatReferenceLabel = (type, reference) =>
    reference ? `${referencePrefix(type)}-${reference}` : "";

/** "7" -> "0007". Nunca trunca: 12345 se queda como 12345. */
export const normalizeReference = (value) => {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (!digits) return "";
    return digits.padStart(REFERENCE_PAD, "0");
};

/** Lee el folio como número (0 si no tiene dígitos). */
const referenceNumber = (value) => {
    const digits = String(value ?? "").replace(/\D/g, "");
    return digits ? parseInt(digits, 10) : 0;
};

/** ¿El folio ya está usado en esa serie? Ignora el propio documento al editar. */
export const isReferenceTaken = async (type, reference, excludeId = null) => {
    const normalized = normalizeReference(reference);
    if (!isCorrelativeType(type) || !normalized) return false;

    const snap = await getDocs(query(
        transactionsRef,
        where("type", "==", type),
        where("reference", "==", normalized),
        limit(2)
    ));
    return snap.docs.some((d) => d.id !== excludeId);
};

const seriesRef = () => doc(db, "counters", SERIES_ID);

const readSeries = async () => {
    const snap = await getDoc(seriesRef());
    const data = snap.exists() ? snap.data() : {};
    return {
        entry: Number(data.entry) || 0,
        exit: Number(data.exit) || 0
    };
};

/**
 * Si la serie de un tipo todavía no arrancó, la reconstruye desde el historial
 * (el folio más alto de ese tipo) para no repetir números. Se toma el máximo y
 * no el conteo para no chocar con folios escritos a mano con saltos.
 */
const ensureSeries = async (current) => {
    const next = { ...current };
    let bootstrapped = false;

    for (const type of MOVEMENT_TYPES) {
        if (current[type] > 0) continue;
        const snap = await getDocs(query(
            transactionsRef,
            where("type", "==", type),
            orderBy("reference", "desc"),
            limit(1)
        ));
        const highest = snap.empty ? 0 : referenceNumber(snap.docs[0].data().reference);
        if (highest > next[type]) next[type] = highest;
        if (!snap.empty) bootstrapped = true;
    }

    // Nunca por debajo del contador legado (global): evita repetir folios viejos.
    if (bootstrapped) {
        const legacySnap = await getDoc(doc(db, "counters", LEGACY_COUNTER_ID));
        const legacy = legacySnap.exists() ? Number(legacySnap.data().lastNumber) || 0 : 0;
        if (legacy > 0) {
            for (const type of MOVEMENT_TYPES) next[type] = Math.max(next[type], legacy);
        }
        await setDoc(seriesRef(), next, { merge: true });
    }
    return next;
};

const readSeriesNormalized = async () => ensureSeries(await readSeries());

/**
 * Siguiente folio automático de la serie (entrada o salida) más los últimos
 * números usados, para mostrarlos en la UI.
 */
export const getNextCorrelativo = async (type) => {
    if (!isCorrelativeType(type)) {
        return { reference: "", last: 0, next: 0, series: { entry: 0, exit: 0 } };
    }
    const series = await readSeriesNormalized();
    const last = series[type] || 0;
    return {
        reference: String(last + 1).padStart(REFERENCE_PAD, "0"),
        last,
        next: last + 1,
        series
    };
};

/** Últimos folios de cada serie (los muestra Configuración). */
export const getCorrelativeStatus = async () => {
    const series = await readSeriesNormalized();
    const pad = (n) => (n ? String(n).padStart(REFERENCE_PAD, "0") : "—");
    return {
        entry: series.entry,
        exit: series.exit,
        entryLabel: pad(series.entry),
        exitLabel: pad(series.exit)
    };
};

/** Fecha del movimiento (Timestamp de Firestore, Date o string). */
const movementTime = (tx) => {
    if (!tx) return 0;
    if (tx.timestamp?.toDate) return tx.timestamp.toDate().getTime();
    if (tx.timestamp instanceof Date) return tx.timestamp.getTime();
    if (tx.timestamp) {
        const parsed = new Date(tx.timestamp);
        if (!isNaN(parsed.getTime())) return parsed.getTime();
    }
    return 0;
};

/**
 * Orden "de correlativo": primero por la fecha del movimiento (la más antigua
 * es la 0001) y, si empatan, por la fecha de registro y el id, para que el
 * orden sea estable entre ejecuciones.
 */
const compareByDate = (a, b) => {
    const diff = movementTime(a) - movementTime(b);
    if (diff !== 0) return diff;
    const createdDiff = movementTime({ timestamp: a.createdAt }) - movementTime({ timestamp: b.createdAt });
    if (createdDiff !== 0) return createdDiff;
    return String(a.id).localeCompare(String(b.id));
};

export const sortByMovementDate = (transactions) => [...transactions].sort(compareByDate);

// --- Products ---

export const getProducts = (callback) => {
    // Note: We use orderBy name here, but we can also order by sku in the UI or here
    const q = query(productsRef, orderBy("name"));
    return onSnapshot(q, (snapshot) => {
        const products = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                // Ensure sku is treated as a string for sorting
                sku: data.sku ? String(data.sku) : ""
            };
        });
        callback(products);
    });
};

export const addProduct = async (productData) => {
    return await addDoc(productsRef, {
        ...productData,
        stock: Number(productData.stock) || 0,
        price: Number(productData.price) || 0,
        cost: Number(productData.cost) || 0,
        last_updated: new Date()
    });
};

export const updateProduct = async (id, data) => {
    const docRef = doc(db, "products", id);
    // Firestore rechaza valores `undefined`; solo enviamos los campos presentes.
    const payload = Object.fromEntries(
        Object.entries(data || {}).filter(([, value]) => value !== undefined)
    );
    if (payload.stock !== undefined) payload.stock = Number(payload.stock) || 0;
    if (payload.price !== undefined) payload.price = Number(payload.price) || 0;
    if (payload.cost !== undefined) payload.cost = Number(payload.cost) || 0;
    payload.last_updated = new Date();

    return await updateDoc(docRef, payload);
};

// --- Transactions & Stock Management ---

/**
 * Registra un movimiento y actualiza el stock.
 *
 * Firma por objeto de opciones (la preferida):
 *   adjustStock(items, type, userId, { notes, reference, customDate, sucursal,
 *                                       createdBy, reason, party, allowNegative })
 *
 * La firma posicional anterior se conserva como envoltorio para no romper
 * llamadas existentes.
 *
 * @param {Array} items [{ productId, quantity, price, cost, name, sku }]
 * @param {'entry'|'exit'|'sale'} type
 * @param {string} userId uid de quien registra
 * @param {object|string} options Objeto de opciones, o `notes` en la firma vieja.
 * @param {string|null} [legacyReference] Folio manual. `null`/"" = automático.
 * @param {Date|null} [legacyDate] Fecha del movimiento (por defecto ahora).
 * @param {string|null} [legacySucursal] Sucursal destino (salidas).
 * @param {string} [legacyCreatedBy] Email/nombre para el comprobante y la auditoría.
 * @returns {Promise<{ id: string, reference: string }>} Folio final asignado.
 */
export const adjustStock = async (items, type, userId, options = {}, legacyReference = null, legacyDate = null, legacySucursal = null, legacyCreatedBy = "") => {
    // Compatibilidad: si llega un string (o nada) en el cuarto argumento, es la
    // firma posicional antigua.
    const opts = typeof options === "string" || options === null || options === undefined
        ? {
            notes: options || "",
            reference: legacyReference,
            customDate: legacyDate,
            sucursal: legacySucursal,
            createdBy: legacyCreatedBy,
        }
        : options;

    const {
        notes = "",
        reference = null,
        customDate = null,
        sucursal = null,
        createdBy = "",
        reason = "",
        party = "",
        allowNegative = false,
    } = opts;

    try {
        // Une partidas repetidas en una sola: sin esto, dos líneas del mismo
        // producto leen/escriben el mismo documento y solo sobrevive la última.
        const itemsByProduct = new Map();
        for (const item of items || []) {
            if (!item?.productId) continue;
            const existing = itemsByProduct.get(item.productId);
            if (existing) {
                existing.quantity = Number(existing.quantity || 0) + Number(item.quantity || 0);
            } else {
                itemsByProduct.set(item.productId, { ...item, quantity: Number(item.quantity || 0) });
            }
        }
        const mergedItems = [...itemsByProduct.values()];
        if (mergedItems.length === 0) {
            throw new Error("Agrega al menos un producto.");
        }

        // Las entradas y salidas se valoran a costo (igual que reportes y PDF);
        // una venta se valora a precio de venta.
        const isMovement = type === 'entry' || type === 'exit';
        const total = mergedItems.reduce((acc, item) => {
            const unit = isMovement ? Number(item.cost || 0) : Number(item.price || 0);
            return acc + unit * Number(item.quantity || 0);
        }, 0);
        const transactionDate = customDate || new Date();
        const manualReference = normalizeReference(reference);

        if (isMovement && !manualReference) {
            // Sin folio manual: se asegura de que la serie exista antes de abrir
            // la transacción. El número se toma dentro de ella, así que dos
            // usuarios simultáneos no pueden quedarse con el mismo folio
            // (Firestore reintenta la transacción al detectar el conflicto).
            await readSeriesNormalized();
        }

        const newTransactionRef = doc(transactionsRef);
        let assignedReference = manualReference;

        await runTransaction(db, async (transaction) => {
            // 1. READ: estado actual de los productos
            const productReads = [];
            for (const item of mergedItems) {
                const productRef = doc(db, "products", item.productId);
                const productDoc = await transaction.get(productRef);
                if (!productDoc.exists()) {
                    throw new Error("Producto no encontrado: " + item.productId);
                }
                productReads.push({ ref: productRef, doc: productDoc, item });
            }

            // 1.b READ: serie de correlativos y folio ocupado (si es manual)
            let series = null;
            if (isMovement) {
                const seriesSnap = await transaction.get(seriesRef());
                const seriesData = seriesSnap.exists() ? seriesSnap.data() : {};
                series = {
                    entry: Number(seriesData.entry) || 0,
                    exit: Number(seriesData.exit) || 0
                };

                if (manualReference) {
                    const takenSnap = await transaction.get(query(
                        transactionsRef,
                        where("type", "==", type),
                        where("reference", "==", manualReference),
                        limit(1)
                    ));
                    if (!takenSnap.empty) {
                        throw new Error(`El folio ${formatReferenceLabel(type, manualReference)} ya está usado. Elige otro.`);
                    }
                } else {
                    const next = (series[type] || 0) + 1;
                    series[type] = next;
                    assignedReference = String(next).padStart(REFERENCE_PAD, "0");
                }
            }

            // 1.c VALIDACIÓN: una salida no puede dejar existencias negativas,
            // salvo que el usuario lo haya confirmado (ajustes negativos).
            if (type === 'exit' && !allowNegative) {
                const shortfalls = [];
                for (const read of productReads) {
                    const currentStock = Number(read.doc.data().stock) || 0;
                    const requested = Number(read.item.quantity) || 0;
                    if (requested > currentStock) {
                        shortfalls.push({
                            name: read.doc.data().name || read.item.name || read.item.productId,
                            available: currentStock,
                            requested,
                        });
                    }
                }
                if (shortfalls.length) {
                    const detail = shortfalls
                        .map((s) => `${s.name} (disponible ${s.available}, solicitado ${s.requested})`)
                        .join("; ");
                    const error = new Error(`Stock insuficiente: ${detail}`);
                    error.code = "insufficient-stock";
                    error.shortfalls = shortfalls;
                    throw error;
                }
            }

            // 2. WRITE: registro del movimiento
            transaction.set(newTransactionRef, {
                type,
                items: mergedItems,
                total,
                timestamp: transactionDate,
                userId,
                createdBy,
                notes,
                reference: assignedReference || "",
                sucursal: sucursal || "",
                reason: reason || "",
                party: party || "",
            });

            // 2.b WRITE: contador de la serie (solo si el folio supera el actual)
            if (series) {
                const used = referenceNumber(assignedReference);
                const lastNumber = Math.max(series[type] || 0, used);
                transaction.set(seriesRef(), { entry: series.entry, exit: series.exit, [type]: lastNumber }, { merge: true });
                transaction.set(doc(db, "counters", LEGACY_COUNTER_ID), { lastNumber }, { merge: true });
            }

            // 3. WRITE: stock de cada producto
            for (const read of productReads) {
                const currentStock = read.doc.data().stock || 0;
                let newStock = currentStock;

                if (type === 'entry') {
                    newStock += Number(read.item.quantity);
                } else { // exit o sale
                    newStock -= Number(read.item.quantity);
                }

                transaction.update(read.ref, {
                    stock: newStock,
                    last_updated: new Date()
                });
            }
        });

        return { id: newTransactionRef.id, reference: assignedReference || "" };
    } catch (error) {
        console.error("Transaction failed: ", error);
        throw error;
    }
};

// --- Transaction Management ---

export const editTransaction = async (transactionId, oldData, newData) => {
    // oldData: { type, items, reference } - datos originales de la transacción
    // newData: { type, items, reference, notes, sucursal, timestamp } - nuevos datos
    // Revierte el efecto original y aplica el nuevo calculando el NETO por producto
    // dentro de una sola transacción (lecturas antes de escrituras).
    // El folio se valida y, si cambia la serie (entrada <-> salida) o se deja
    // vacío, se toma el siguiente de la serie correspondiente.

    try {
        await runTransaction(db, async (transaction) => {
            const oldQtyByProduct = {};
            for (const item of oldData.items || []) {
                if (!item.productId) continue;
                oldQtyByProduct[item.productId] = (oldQtyByProduct[item.productId] || 0) + (Number(item.quantity) || 0);
            }

            const newQtyByProduct = {};
            for (const item of newData.items || []) {
                if (!item.productId) continue;
                newQtyByProduct[item.productId] = (newQtyByProduct[item.productId] || 0) + (Number(item.quantity) || 0);
            }

            const allIds = new Set([...Object.keys(oldQtyByProduct), ...Object.keys(newQtyByProduct)]);

            // FASE 1 (lecturas): leer el stock actual de cada producto afectado
            const reads = [];
            for (const productId of allIds) {
                const productRef = doc(db, "products", productId);
                const productDoc = await transaction.get(productRef);
                if (!productDoc.exists()) {
                    if (newQtyByProduct[productId]) {
                        throw new Error("Product not found during edit (new): " + productId);
                    }
                    console.warn("Product not found during edit (old):", productId);
                    continue;
                }
                reads.push({
                    ref: productRef,
                    currentStock: productDoc.data().stock || 0,
                    productId,
                    name: productDoc.data().name || productId
                });
            }

            // FASE 1.b (lecturas): folio final según la serie del tipo nuevo
            const typeChanged = oldData.type !== newData.type;
            const manualReference = normalizeReference(newData.reference);
            let finalReference = manualReference;
            let series = null;
            let seriesLast = 0;

            if (isCorrelativeType(newData.type)) {
                const seriesSnap = await transaction.get(seriesRef());
                const seriesData = seriesSnap.exists() ? seriesSnap.data() : {};
                series = {
                    entry: Number(seriesData.entry) || 0,
                    exit: Number(seriesData.exit) || 0
                };
                seriesLast = series[newData.type] || 0;

                if (manualReference) {
                    // Solo se busca duplicado si el folio es nuevo en esta serie.
                    const keepsReference = !typeChanged
                        && manualReference === normalizeReference(oldData.reference);
                    let taken = false;
                    if (!keepsReference) {
                        const takenSnap = await transaction.get(query(
                            transactionsRef,
                            where("type", "==", newData.type),
                            where("reference", "==", manualReference),
                            limit(1)
                        ));
                        taken = takenSnap.docs.some((d) => d.id !== transactionId);
                    }
                    if (taken) {
                        throw new Error(`El folio ${formatReferenceLabel(newData.type, manualReference)} ya está usado en esa serie.`);
                    }
                } else {
                    // Sin folio: si es el mismo tipo se conserva el actual;
                    // si cambió de tipo se toma el siguiente de la nueva serie.
                    const previous = normalizeReference(oldData.reference);
                    const keepsOwnReference = !typeChanged
                        && isCorrelativeType(oldData.type)
                        && previous;
                    finalReference = keepsOwnReference
                        ? previous
                        : String(seriesLast + 1).padStart(REFERENCE_PAD, "0");
                    seriesLast = Math.max(seriesLast, referenceNumber(finalReference));
                }
            } else {
                // Ventas: el folio se mantiene tal cual (puede quedar vacío).
                finalReference = manualReference;
            }

            // FASE 2 (escrituras): aplicar el neto revertir-original + aplicar-nuevo
            for (const read of reads) {
                const oldQty = oldQtyByProduct[read.productId] || 0;
                const newQty = newQtyByProduct[read.productId] || 0;
                let newStock = read.currentStock;

                if (oldQty) {
                    if (oldData.type === 'entry') {
                        newStock -= oldQty;
                    } else { // exit o sale
                        newStock += oldQty;
                    }
                }

                if (newQty) {
                    if (newData.type === 'entry') {
                        newStock += newQty;
                    } else { // exit o sale
                        newStock -= newQty;
                    }
                }

                if (newStock !== read.currentStock) {
                    // La edición no debe crear existencias negativas de forma
                    // silenciosa; usar un ajuste explícito para esos casos.
                    if (newData.type !== 'entry' && newStock < 0) {
                        const error = new Error(
                            `Stock insuficiente para editar: ${read.name} quedaría en ${newStock}.`
                        );
                        error.code = "insufficient-stock";
                        throw error;
                    }
                    transaction.update(read.ref, {
                        stock: newStock,
                        last_updated: new Date()
                    });
                }
            }

            // FASE 2.b (escrituras): sincronizar la serie si el folio la supera
            if (series) {
                const used = referenceNumber(finalReference);
                const lastNumber = Math.max(seriesLast, used);
                if (lastNumber !== (series[newData.type] || 0)) {
                    transaction.set(seriesRef(), { [newData.type]: lastNumber }, { merge: true });
                }
                if (lastNumber > 0) {
                    // El contador legado guarda el mayor de ambas series.
                    transaction.set(doc(db, "counters", LEGACY_COUNTER_ID), { lastNumber }, { merge: true });
                }
            }

            // Actualizar el documento de la transacción
            const txRef = doc(db, "transactions", transactionId);
            transaction.update(txRef, {
                type: newData.type,
                items: newData.items,
                total: newData.total,
                timestamp: newData.timestamp,
                notes: newData.notes,
                reference: finalReference,
                sucursal: newData.sucursal || "",
                reason: newData.reason || "",
                party: newData.party || "",
                editedAt: new Date(),
                editedBy: newData.editedBy || 'unknown'
            });
        });
        return true;
    } catch (error) {
        console.error("Edit transaction failed:", error);
        throw error;
    }
};

/**
 * Elimina un movimiento revirtiendo el stock.
 *
 * @param {string} transactionId
 * @param {{ type: string, items: Array, reference?: string }} transactionData
 * @param {{ reclaimReference?: boolean }} options Si `reclaimReference` es true
 *   y el folio era el último de su serie, se devuelve el número al correlativo.
 */
export const deleteTransaction = async (transactionId, transactionData, { reclaimReference = false } = {}) => {
    try {
        await runTransaction(db, async (transaction) => {
            // 1. READ: estado actual de los productos afectados
            const productReads = [];
            for (const item of transactionData.items) {
                const productRef = doc(db, "products", item.productId);
                const productDoc = await transaction.get(productRef);
                if (!productDoc.exists()) {
                    console.warn("Product not found during deletion:", item.productId);
                    continue; // Skip if product was deleted
                }
                productReads.push({ ref: productRef, doc: productDoc, item });
            }

            // 1.b READ: serie de correlativos (solo si se va a devolver el folio)
            const canReclaim = reclaimReference
                && isCorrelativeType(transactionData.type)
                && !!referenceNumber(transactionData.reference);
            let series = null;
            if (canReclaim) {
                const seriesSnap = await transaction.get(seriesRef());
                const seriesData = seriesSnap.exists() ? seriesSnap.data() : {};
                series = {
                    entry: Number(seriesData.entry) || 0,
                    exit: Number(seriesData.exit) || 0
                };
            }

            // 2. WRITE: revertir el stock
            for (const read of productReads) {
                const currentStock = read.doc.data().stock || 0;
                let newStock = currentStock;

                // Reverse the original operation
                if (transactionData.type === 'entry') {
                    // Entry added stock, so we subtract
                    newStock -= Number(read.item.quantity);
                } else { // exit or sale
                    // Exit/Sale removed stock, so we add it back
                    newStock += Number(read.item.quantity);
                }

                transaction.update(read.ref, {
                    stock: newStock,
                    last_updated: new Date()
                });
            }

            // 2.b WRITE: devolver el folio al correlativo (solo si era el último)
            if (series) {
                const used = referenceNumber(transactionData.reference);
                const currentLast = series[transactionData.type] || 0;
                if (used > 0 && used === currentLast) {
                    const lastNumber = used - 1;
                    const otherLast = series[transactionData.type === "entry" ? "exit" : "entry"] || 0;
                    transaction.set(seriesRef(), { [transactionData.type]: lastNumber }, { merge: true });
                    transaction.set(
                        doc(db, "counters", LEGACY_COUNTER_ID),
                        { lastNumber: Math.max(lastNumber, otherLast) },
                        { merge: true }
                    );
                }
            }

            // 3. WRITE: borrar el documento del movimiento
            const txRef = doc(db, "transactions", transactionId);
            transaction.delete(txRef);
        });
        return true;
    } catch (error) {
        console.error("Delete transaction failed:", error);
        throw error;
    }
};

export const deleteProduct = async (productId) => {
    const docRef = doc(db, "products", productId);
    await deleteDoc(docRef);
};

// --- Correlativos: migración ---

const BATCH_LIMIT = 400;

/**
 * Renumera el historial con series separadas por tipo:
 * la entrada más antigua (por fecha del movimiento) es 0001, la siguiente 0002…
 * y lo mismo para las salidas (0001, 0002…). Al final deja los contadores
 * sincronizados para que el próximo folio automático continúe la serie.
 *
 * Los movimientos sin fecha utilizable se colocan al final de su serie, para
 * que no desplazen a los que sí tienen fecha.
 *
 * @returns {Promise<{ entry: number, exit: number }>} Último folio de cada serie.
 */
export const reindexTransactions = async () => {
    try {
        const q = query(transactionsRef, where("type", "in", MOVEMENT_TYPES));
        const querySnapshot = await getDocs(q);

        const transactions = querySnapshot.docs.map((snap) => ({
            id: snap.id,
            ...snap.data()
        }));

        const totals = { entry: 0, exit: 0 };
        const updates = [];

        for (const type of MOVEMENT_TYPES) {
            const group = transactions.filter((tx) => tx.type === type);
            // Las fechas más antiguas primero; las sin fecha quedan al final.
            group.sort((a, b) => {
                const timeA = movementTime(a);
                const timeB = movementTime(b);
                if (timeA !== timeB) {
                    if (timeA === 0) return 1;
                    if (timeB === 0) return -1;
                    return timeA - timeB;
                }
                return compareByDate(a, b);
            });

            group.forEach((tx, index) => {
                const nextNum = index + 1;
                const newRef = String(nextNum).padStart(REFERENCE_PAD, "0");
                if (tx.reference !== newRef) {
                    updates.push({ id: tx.id, reference: newRef });
                }
                totals[type] = nextNum;
            });
        }

        for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
            const batch = writeBatch(db);
            for (const update of updates.slice(i, i + BATCH_LIMIT)) {
                batch.update(doc(db, "transactions", update.id), { reference: update.reference });
            }
            await batch.commit();
        }

        // Contadores: la serie continúa donde terminó la migración.
        await setDoc(seriesRef(), totals, { merge: true });
        await setDoc(
            doc(db, "counters", LEGACY_COUNTER_ID),
            { lastNumber: Math.max(totals.entry, totals.exit) },
            { merge: true }
        );

        return totals;
    } catch (error) {
        console.error("Migration failed:", error);
        throw error;
    }
};

