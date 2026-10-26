import { db } from "../firebase.config";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    where
} from "firebase/firestore";

const transactionsRef = collection(db, "transactions");

/**
 * Loads display data for the users referenced by dashboard movements.
 * Missing or unreadable users degrade gracefully to their raw id.
 */
export const getDashboardUsers = async (userIds) => {
    const entries = await Promise.all(userIds.map(async (userId) => {
        try {
            const userSnapshot = await getDoc(doc(db, "users", userId));
            const userData = userSnapshot.exists() ? userSnapshot.data() : {};
            const email = userData.email || userId;

            return [userId, { email, name: userData.name || email }];
        } catch (error) {
            console.warn(`No se pudo cargar el usuario ${userId}:`, error);
            return [userId, { email: userId, name: userId }];
        }
    }));

    return Object.fromEntries(entries);
};

export const getTransactionsByTypeAndRange = async (type, start, end) => {
    const q = query(
        transactionsRef,
        where("type", "==", type),
        where("timestamp", ">=", start),
        where("timestamp", "<=", end),
        orderBy("timestamp", "desc")
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((snapshotDoc) => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data()
    }));
};
