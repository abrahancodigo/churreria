import { db } from "../firebase.config";
import {
    collection,
    doc,
    limit,
    onSnapshot,
    orderBy,
    query,
    runTransaction
} from "firebase/firestore";

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

export const subscribeRecentTransactions = (callback, limitCount = 50) => {
    const q = query(
        collection(db, "transactions"),
        orderBy("timestamp", "desc"),
        limit(limitCount)
    );

    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map((snapshotDoc) => ({
            id: snapshotDoc.id,
            ...snapshotDoc.data()
        })));
    });
};
