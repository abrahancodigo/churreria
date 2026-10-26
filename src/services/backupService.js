import { db } from "../firebase.config";
import { collection, getDocs } from "firebase/firestore";

export const getBackupProjectId = () => db.app.options.projectId;

export const getBackupCollection = async (collectionName) => {
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map((snapshotDoc) => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data()
    }));
};
