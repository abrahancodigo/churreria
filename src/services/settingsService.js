import { db } from "../firebase.config";
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc
} from "firebase/firestore";

const companyRef = doc(db, "settings", "company");
const usersRef = collection(db, "users");

export const getCompanySettings = async () => {
    const snapshot = await getDoc(companyRef);
    return snapshot.exists() ? snapshot.data() : null;
};

export const saveCompanySettings = async (companyInfo) => {
    await setDoc(companyRef, companyInfo);
};

export const listUsers = async () => {
    const snapshot = await getDocs(usersRef);
    return snapshot.docs.map((snapshotDoc) => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data()
    }));
};

export const updateUserRole = async (userId, role) => {
    await updateDoc(doc(db, "users", userId), { role });
};

export const deleteUser = async (userId) => {
    await deleteDoc(doc(db, "users", userId));
};
