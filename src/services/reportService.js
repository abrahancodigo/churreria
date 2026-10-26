import { db } from "../firebase.config";
import {
    collection,
    getDocs,
    orderBy,
    query,
    where,
    Timestamp
} from "firebase/firestore";
import { startOfDay, endOfDay, parseISO } from "date-fns";

const transactionsRef = collection(db, "transactions");

export const getReportTransactions = async ({ dateFrom, dateTo }) => {
    let q = query(transactionsRef, orderBy("timestamp", "desc"));

    const constraints = [];
    if (dateFrom) {
        constraints.push(where("timestamp", ">=", Timestamp.fromDate(startOfDay(parseISO(dateFrom)))));
    }
    if (dateTo) {
        constraints.push(where("timestamp", "<=", Timestamp.fromDate(endOfDay(parseISO(dateTo)))));
    }

    if (constraints.length > 0) {
        q = query(transactionsRef, ...constraints, orderBy("timestamp", "desc"));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((snapshotDoc) => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data()
    }));
};
