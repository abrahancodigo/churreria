import { db } from "../firebase.config";
import {
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    Timestamp,
    where
} from "firebase/firestore";
import { startOfDay, endOfDay, parseISO } from "date-fns";

const transactionsRef = collection(db, "transactions");
export const REPORT_ROW_LIMIT = 1000;

/** Consulta acotada por fechas; evita descargar todo el historial. */
export const getReportTransactions = async ({ dateFrom, dateTo }) => {
    if (!dateFrom || !dateTo) {
        throw new Error("Selecciona la fecha inicial y la fecha final.");
    }

    const start = startOfDay(parseISO(dateFrom));
    const end = endOfDay(parseISO(dateTo));
    if (start > end) {
        throw new Error("La fecha inicial no puede ser posterior a la final.");
    }

    const q = query(
        transactionsRef,
        where("timestamp", ">=", Timestamp.fromDate(start)),
        where("timestamp", "<=", Timestamp.fromDate(end)),
        orderBy("timestamp", "desc"),
        limit(REPORT_ROW_LIMIT + 1)
    );
    const snapshot = await getDocs(q);

    return {
        transactions: snapshot.docs.slice(0, REPORT_ROW_LIMIT).map((snapshotDoc) => ({
            id: snapshotDoc.id,
            ...snapshotDoc.data()
        })),
        truncated: snapshot.size > REPORT_ROW_LIMIT,
        limit: REPORT_ROW_LIMIT
    };
};

/**
 * Existencia del producto justo antes del inicio del rango consultado.
 * Necesaria para que el cardex muestre el saldo real y no solo la variación
 * neta del periodo consultado.
 */
export const getOpeningStock = async (productId, dateFrom) => {
    if (!productId || !dateFrom) return 0;

    const start = startOfDay(parseISO(dateFrom));
    const q = query(
        transactionsRef,
        where("timestamp", "<", Timestamp.fromDate(start))
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.reduce((saldo, snapshotDoc) => {
        const tx = snapshotDoc.data();
        if (tx.type !== "entry" && tx.type !== "exit") return saldo;
        const item = tx.items?.find((item) => item.productId === productId);
        if (!item) return saldo;
        const qty = Number(item.quantity || 0);
        return saldo + (tx.type === "entry" ? qty : -qty);
    }, 0);
};
