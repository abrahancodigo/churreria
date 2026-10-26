import { db } from "../firebase.config";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    orderBy,
    runTransaction,
    writeBatch,
    where,
    limit
} from "firebase/firestore";

const transactionsRef = collection(db, "transactions");

// --- Transactions & Stock Management ---

export const adjustStock = async (items, type, userId, notes = "", reference = "", customDate = null, sucursal = null) => {
    // items: [{ productId, quantity, price, cost }]
    // type: 'entry' | 'exit' | 'sale'
    // customDate: optional Date object for the transaction timestamp

    try {
        const total = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        const transactionDate = customDate || new Date();

        await runTransaction(db, async (transaction) => {
            // 1. READ: Get all current product states
            const productReads = [];
            for (const item of items) {
                const productRef = doc(db, "products", item.productId);
                const productDoc = await transaction.get(productRef);
                if (!productDoc.exists()) {
                    throw new Error("Product not found: " + item.productId);
                }
                productReads.push({ ref: productRef, doc: productDoc, item });
            }

            // 2. WRITE: Create Transaction Record
            const newTransactionRef = doc(transactionsRef); // Auto-ID
            transaction.set(newTransactionRef, {
                type,
                items,
                total,
                timestamp: transactionDate,
                userId,
                notes,
                reference, // Save the custom reference
                sucursal    // Save sucursal as a dedicated field
            });

            // If it's an entry or exit with a numeric reference, update the global counter
            if ((type === 'exit' || type === 'entry') && reference) {
                const numericRef = parseInt(reference.replace(/\D/g, ''));
                if (!isNaN(numericRef)) {
                    const counterRef = doc(db, "counters", "global_movements");
                    transaction.set(counterRef, { lastNumber: numericRef }, { merge: true });
                }
            }

            // 3. WRITE: Update Stock for each item
            for (const read of productReads) {
                const currentStock = read.doc.data().stock || 0;
                let newStock = currentStock;

                if (type === 'entry') {
                    newStock += Number(read.item.quantity);
                } else { // exit or sale
                    if (currentStock < read.item.quantity) {
                        // Optional: strict check
                    }
                    newStock -= Number(read.item.quantity);
                }

                transaction.update(read.ref, {
                    stock: newStock,
                    last_updated: new Date()
                });
            }
        });
        return true;
    } catch (error) {
        console.error("Transaction failed: ", error);
        throw error;
    }
};


// --- Counters ---

/**
 * Returns the next movement reference number (zero padded to 4 digits).
 *
 * The counter is global: `counters/global_movements.lastNumber` is written by
 * adjustStock() whenever a movement with a numeric reference is saved, so
 * reading it here gives the next free number.
 */
export const getNextCorrelativo = async () => {
    try {
        const counterRef = doc(db, "counters", "global_movements");
        const counterSnap = await getDoc(counterRef);

        const lastNumber = counterSnap.exists() ? Number(counterSnap.data().lastNumber) || 0 : 0;
        return String(lastNumber + 1).padStart(4, '0');
    } catch (error) {
        console.error("Error fetching correlativo:", error);
        return "";
    }
};

/**
 * Distinct sucursal names already used in past movements.
 *
 * There is no sucursales collection yet, so the catalog is derived from the
 * `transactions` collection. New transactions store `sucursal` as a field;
 * older ones only embed it in `notes` as "Sucursal: <name>", so both are read.
 * Used to feed the <datalist> suggestions without migrating any data.
 */
export const getSucursalesUsadas = async () => {
    try {
        const q = query(
            transactionsRef,
            where("type", "in", ["entry", "exit"]),
            orderBy("timestamp", "desc"),
            limit(500)
        );
        const snapshot = await getDocs(q);

        const names = new Set();
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const fromField = (data.sucursal || "").trim();
            if (fromField) names.add(fromField);

            const match = (data.notes || "").match(/Sucursal:\s*([^|]+)/i);
            if (match) {
                const fromNotes = match[1].trim();
                if (fromNotes) names.add(fromNotes);
            }
        });

        return Array.from(names).sort((a, b) => a.localeCompare(b, 'es'));
    } catch (error) {
        console.error("Error fetching sucursales:", error);
        return [];
    }
};

export const reindexTransactions = async () => {
    try {
        const q = query(transactionsRef, where("type", "in", ["entry", "exit"]));
        const querySnapshot = await getDocs(q);

        const transactions = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Sort by timestamp strictly (oldest first)
        transactions.sort((a, b) => {
            const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
            const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : (b.timestamp ? new Date(b.timestamp).getTime() : 0);

            if (timeA === timeB) {
                return a.id.localeCompare(b.id);
            }
            return timeA - timeB;
        });

        const batch = writeBatch(db);
        let lastNumber = 0;

        // Assign new references in a single global sequence
        transactions.forEach((tx, index) => {
            const nextNum = index + 1;
            const newRef = String(nextNum).padStart(4, '0');

            const txRef = doc(db, "transactions", tx.id);
            batch.update(txRef, {
                reference: newRef
            });
            lastNumber = nextNum;
        });

        // Update the global counter
        const counterRef = doc(db, "counters", "global_movements");
        batch.set(counterRef, { lastNumber }, { merge: true });

        await batch.commit();
        return true;
    } catch (error) {
        console.error("Migration failed:", error);
        throw error;
    }
};
