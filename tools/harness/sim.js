// Datos y dobles de prueba para el arnés visual (ver main.jsx).
// Este módulo se importa ANTES que la app, así que cuando App resuelve
// `firebase/*` el global ya está publicado.

const user = { uid: "u-admin", email: "porfirio@churreria.mx" };
export const profile = { uid: user.uid, email: user.email, name: "Porfirio Ruiz", role: "admin" };

const now = Date.now();
const ts = (daysAgo, hour = 9) => {
    const d = new Date(now - daysAgo * 86400000);
    d.setHours(hour, 15, 0, 0);
    return { toDate: () => d, seconds: Math.floor(d.getTime() / 1000) };
};

export const products = [
    { id: "p1", name: "Churro clásico azucarado", sku: "001", category: "Comida", price: 12, cost: 4.5, stock: 240 },
    { id: "p2", name: "Churro relleno de cajeta", sku: "002", category: "Comida", price: 18, cost: 7, stock: 96 },
    { id: "p3", name: "Churro relleno de chocolate", sku: "003", category: "Comida", price: 18, cost: 7.2, stock: 8 },
    { id: "p4", name: "Churro relleno de fresa", sku: "004", category: "Comida", price: 18, cost: 6.8, stock: 54 },
    { id: "p5", name: "Café de olla 12 oz", sku: "010", category: "Bebidas", price: 25, cost: 6, stock: 120 },
    { id: "p6", name: "Chocolate caliente", sku: "011", category: "Bebidas", price: 28, cost: 8, stock: 6 },
    { id: "p7", name: "Bolsa de papel kraft", sku: "P01", category: "Snacks", price: 0, cost: 0.35, stock: 1400 },
    { id: "p8", name: "Azúcar morena 1 kg", sku: "M01", category: "General", price: 0, cost: 22, stock: 12 },
];

const item = (id, qty) => {
    const p = products.find((x) => x.id === id);
    return { productId: p.id, name: p.name, quantity: qty, price: p.price, cost: p.cost, sku: p.sku };
};

export const transactions = [
    { id: "t1", type: "entry", reference: "0007", reason: "Compra a proveedor", party: "Distribuidora La Espiga", sucursal: "Centro", userId: user.uid, createdBy: user.email, timestamp: ts(1, 8), notes: "Entrega de masa y cajeta", items: [item("p1", 120), item("p2", 60)] },
    { id: "t2", type: "exit", reference: "0012", reason: "Traspaso a sucursal", party: "Sucursal Norte", sucursal: "Norte", userId: user.uid, createdBy: user.email, timestamp: ts(2, 16), notes: "", items: [item("p1", 40), item("p5", 12)] },
    { id: "t3", type: "entry", reference: "0006", reason: "Producción", party: "", sucursal: "Centro", userId: user.uid, createdBy: user.email, timestamp: ts(4, 7), notes: "Lote de la madrugada", items: [item("p4", 80)] },
    { id: "t4", type: "exit", reference: "0011", reason: "Merma", party: "", sucursal: "Centro", userId: user.uid, createdBy: user.email, timestamp: ts(5, 20), notes: "Se quemó una charola", items: [item("p3", 6)] },
    { id: "t5", type: "entry", reference: "0005", reason: "Devolución de cliente", party: "Cliente", sucursal: "Centro", userId: user.uid, createdBy: user.email, timestamp: ts(6, 12), notes: "", items: [item("p1", 10)] },
    { id: "t6", type: "sale", reference: "SAL-0001", userId: user.uid, createdBy: user.email, timestamp: ts(1, 13), notes: "", items: [item("p1", 5), item("p5", 2)] },
];

const ok = () => Promise.resolve();
const snapDoc = (data) => ({ exists: () => Boolean(data), data: () => data, id: "doc" });
const docs = (list) => ({ docs: list.map((d) => ({ id: d.id, data: () => d })), size: list.length, empty: list.length === 0 });

const colName = (ref) => ref?.__col || ref?.__doc;

export const Firestore = {
    collection: (_db, name) => ({ __col: name }),
    doc: (_db, col, id) => ({ __doc: col, id }),
    query: (ref) => ref,
    where: () => ({}),
    orderBy: () => ({}),
    limit: () => ({}),
    Timestamp: { fromDate: (d) => ({ toDate: () => d }) },
    onSnapshot: (ref, cb) => {
        const col = colName(ref);
        const data = col === "transactions" ? transactions : col === "products" ? products : [];
        setTimeout(() => cb(docs(data)), 10);
        return () => {};
    },
    getDocs: async (ref) => {
        const col = colName(ref);
        if (col === "transactions") return docs(transactions);
        if (col === "products") return docs(products);
        if (col === "users") return docs([profile]);
        return docs([]);
    },
    getDoc: async (ref) => {
        const col = colName(ref);
        if (col === "users") return snapDoc(profile);
        if (col === "settings") return snapDoc({ name: "Churrería Porfirio", address: "Av. Principal 123, San Salvador", logoUrl: "" });
        if (col === "counters") return snapDoc({ entry: 7, exit: 12 });
        return snapDoc(undefined);
    },
    setDoc: ok, updateDoc: ok, deleteDoc: ok, addDoc: ok,
    writeBatch: () => ({ set: ok, update: ok, delete: ok, commit: ok }),
    runTransaction: async (_db, fn) => fn({
        get: async (ref) => snapDoc(ref?.__doc === "products" ? products.find((p) => p.id === ref.id) : undefined),
        set: () => {},
        update: () => {},
    }),
    serverTimestamp: () => new Date(),
};

export const auth = {
    onAuthStateChanged: (_auth, cb) => { setTimeout(() => cb(user), 5); return () => {}; },
    signInWithEmailAndPassword: async () => ({ user }),
    createUserWithEmailAndPassword: async () => ({ user }),
    signOut: async () => {},
};

globalThis.__FIREBASE_SIM__ = { Fire: { auth }, Firestore, user, profile };
