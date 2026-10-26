import { db } from "../firebase.config";
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    onSnapshot
} from "firebase/firestore";

const productsRef = collection(db, "products");

// --- Products ---

/**
 * @param {Function} callback  Recibe el arreglo de productos.
 * @param {Object}   [hooks]
 * @param {Function} [hooks.onLoading] Se llama al empezar (y en cada recarga).
 *                                     Recibe `fromCache`: true si los datos vienen
 *                                     de la caché local de Firestore.
 * @param {Function} [hooks.onError]   Recibe el error si la escucha falla.
 */
export const getProducts = (callback, hooks = {}) => {
    const { onLoading, onError } = hooks;
    // Note: We use orderBy name here, but we can also order by sku in the UI or here
    const q = query(productsRef, orderBy("name"));
    // Fuente de verdad: el listener. A diferencia de getDocs(), onSnapshot
    // mantiene la caché interna de Firestore viva entre montajes del
    // componente, así que al volver al módulo la entrega suele ser instantánea.
    return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
        // Primero del caché y luego el servidor: el estado de carga debe
        // reflejar que todavía llegan datos frescos.
        onLoading?.(snapshot.metadata.fromCache);
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
    }, (error) => {
        // Sin este callback el fallo del listener queda mudo en pantalla.
        console.error("[Firestore] La escucha de productos falló:", error);
        onError?.(error);
    });
};

/**
 * Firestore rechaza `undefined` con "Unsupported field value", lo que haría
 * fallar la escritura completa. Este helper descarta esas claves.
 */
const compact = (payload) =>
    Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined)
    );

export const addProduct = async (productData) => {
    return await addDoc(productsRef, compact({
        ...productData,
        stock: Number(productData.stock) || 0,
        price: Number(productData.price) || 0,
        cost: Number(productData.cost) || 0,
        last_updated: new Date()
    }));
};

export const updateProduct = async (id, data) => {
    const docRef = doc(db, "products", id);
    return await updateDoc(docRef, compact({
        ...data,
        // El id real es el del documento: no duplicamos el campo.
        id: undefined,
        stock: data.stock !== undefined ? Number(data.stock) || 0 : undefined,
        price: data.price !== undefined ? Number(data.price) || 0 : undefined,
        cost: data.cost !== undefined ? Number(data.cost) || 0 : undefined,
        last_updated: new Date()
    }));
};

/**
 * Traduce los errores de Firestore a un mensaje entendible para el usuario.
 * @param {unknown} error error original
 * @param {string} fallback mensaje por defecto
 * @returns {string}
 */
export const friendlyDbError = (error, fallback = "Error en la operación") => {
    const message = String(error?.message || error || "");
    const code = String(error?.code || "");

    if (code === "permission-denied" || /insufficient permissions/i.test(message)) {
        return "No tienes permisos para realizar este cambio.";
    }
    if (/limited to\s*\d+\s*bytes|maximum size of a document|resource.*exceeded|row size|payload size/i.test(message)) {
        return "El producto supera el tamaño máximo permitido por Firestore (1 MB). " +
            "Si incluiste una imagen, reduce su peso.";
    }
    if (/Unsupported field value/i.test(message)) {
        return "Hay un dato incompleto en el producto. Revisa los campos obligatorios.";
    }
    if (/not found/i.test(message)) {
        return "El producto ya no existe (puede haber sido eliminado).";
    }
    if (/unavailable|network|failed to fetch/i.test(message)) {
        return "Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.";
    }
    if (code === "already-exists") {
        return "Ya existe un registro con esos datos.";
    }
    return fallback + (message ? ": " + message : "");
};

export const deleteProduct = async (productId) => {
    const docRef = doc(db, "products", productId);
    await deleteDoc(docRef);
};
