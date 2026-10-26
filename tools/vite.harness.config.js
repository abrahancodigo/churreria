import path from "node:path";
import react from "@vitejs/plugin-react";

// Config de Vite solo para el arnés de verificación visual.
// Alias `firebase/*` -> módulo simulado, para montar las pantallas reales con
// datos de ejemplo y capturarlas sin depender de la red ni del proyecto en la nube.
export default {
    root: path.resolve("."),
    plugins: [
        react(),
        {
            name: "firebase-simulator",
            enforce: "pre",
            resolveId(id) {
                if (id.startsWith("firebase/")) return "\0firebase-sim";
                return null;
            },
            load(id) {
                if (id !== "\0firebase-sim") return null;
                return `
                    const sim = globalThis.__FIREBASE_SIM__;
                    export const initializeApp = () => ({ options: { projectId: "churreria-por" } });
                    export const getAuth = () => sim.Fire.auth;
                    export const getFirestore = () => sim.Fire.db;
                    export const initializeFirestore = () => sim.Fire.db;
                    export const persistentLocalCache = () => ({});
                    export const persistentMultipleTabManager = () => ({});
                    export const onAuthStateChanged = (a, cb) => {
                        const t = setTimeout(() => cb(sim.user), 5);
                        return () => clearTimeout(t);
                    };
                    export const signInWithEmailAndPassword = async () => ({ user: sim.user });
                    export const createUserWithEmailAndPassword = async () => ({ user: sim.user });
                    export const signOut = async () => {};
                    const F = sim.Firestore;
                    export const collection = F.collection;
                    export const doc = F.doc;
                    export const query = F.query;
                    export const where = F.where;
                    export const orderBy = F.orderBy;
                    export const limit = F.limit;
                    export const onSnapshot = F.onSnapshot;
                    export const getDocs = F.getDocs;
                    export const getDoc = F.getDoc;
                    export const setDoc = F.setDoc;
                    export const updateDoc = F.updateDoc;
                    export const deleteDoc = F.deleteDoc;
                    export const addDoc = F.addDoc;
                    export const writeBatch = F.writeBatch;
                    export const runTransaction = F.runTransaction;
                    export const serverTimestamp = F.serverTimestamp;
                    export const Timestamp = F.Timestamp;
                `;
            },
        },
    ],
    server: {
        host: "127.0.0.1",
        port: 5199,
        strictPort: true,
        // Solo vigila lo que se edita de verdad. Los perfiles de Chrome de las
        // herramientas (`tools/*.mjs`) crean cientos de archivos por corrida en
        // `.tmp/`; si el watcher los observa, satura el límite del sistema y
        // tumba el servidor a media verificación.
        watch: {
            ignored: [
                "**/.tmp/**",
                "**/tmp-shots/**",
                "**/dist/**",
                "**/node_modules/**",
                "**/.git/**",
                "**/.perch/**",
                "**/backup/**",
            ],
        },
    },
};
