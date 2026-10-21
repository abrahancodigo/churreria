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
    writeBatch,
    where
} from "firebase/firestore";

// Collection References
const productsRef = collection(db, "products");
const transactionsRef = collection(db, "transactions");

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
    return await updateDoc(docRef, {
        ...data,
        stock: data.stock !== undefined ? Number(data.stock) : undefined,
        price: data.price !== undefined ? Number(data.price) : undefined,
        cost: data.cost !== undefined ? Number(data.cost) : undefined,
        last_updated: new Date()
    });
};

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

// --- Transaction Management ---

export const editTransaction = async (transactionId, oldData, newData) => {
    // oldData: { type, items } - datos originales de la transacción
    // newData: { type, items, reference, notes, sucursal, timestamp } - nuevos datos
    // Revierte el efecto original y aplica el nuevo calculando el NETO por producto
    // dentro de una sola transacción (lecturas antes de escrituras).

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
                reads.push({ ref: productRef, currentStock: productDoc.data().stock || 0, productId });
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
                    transaction.update(read.ref, {
                        stock: newStock,
                        last_updated: new Date()
                    });
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
                reference: newData.reference,
                sucursal: newData.sucursal,
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

export const deleteTransaction = async (transactionId, transactionData) => {
    // transactionData should include: type, items
    // This function reverses the stock changes and deletes the transaction

    try {
        await runTransaction(db, async (transaction) => {
            // 1. READ: Get all current product states
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

            // 2. WRITE: Reverse stock changes
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

            // 3. WRITE: Delete the transaction document
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

// --- Counters ---

export const getNextCorrelativo = async (sucursal, type) => {
    if (type !== 'exit' && type !== 'entry') return "";

    try {
        const counterRef = doc(db, "counters", "global_movements");
        const counterSnap = await getDoc(counterRef);

        if (counterSnap.exists()) {
            const nextNumber = (counterSnap.data().lastNumber || 0) + 1;
            return String(nextNumber).padStart(4, '0');
        } else {
            return "0001";
        }
    } catch (error) {
        console.error("Error fetching correlativo:", error);
        return "";
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
