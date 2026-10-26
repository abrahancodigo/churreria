import { db } from "../firebase.config";
import {
    collection,
    getDocs,
    orderBy,
    query,
    Timestamp,
    where
} from "firebase/firestore";

const transactionsRef = collection(db, "transactions");

/** Movimientos de un tipo dentro de un rango, resueltos por Firestore. */
export const getTransactionsByTypeAndRange = async (type, start, end) => {
    const q = query(
        transactionsRef,
        where("type", "==", type),
        where("timestamp", ">=", Timestamp.fromDate(start)),
        where("timestamp", "<=", Timestamp.fromDate(end)),
        orderBy("timestamp", "desc")
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((snapshotDoc) => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data()
    }));
};
