import { useState, useEffect } from "react";
import { db } from "../firebase.config";
import { doc, getDoc } from "firebase/firestore";

let cached = null;
let promise = null;

export function useCompany() {
    const [company, setCompany] = useState(cached || { name: "Churrería POS", address: "", logoUrl: "" });

    useEffect(() => {
        if (cached) return;
        if (!promise) {
            promise = getDoc(doc(db, "settings", "company"))
                .then((snap) => {
                    cached = snap.exists()
                        ? { name: "Churrería POS", address: "", logoUrl: "", ...snap.data() }
                        : { name: "Churrería POS", address: "", logoUrl: "" };
                    return cached;
                })
                .catch(() => ({ name: "Churrería POS", address: "", logoUrl: "" }));
        }
        promise.then(setCompany);
    }, []);

    return company;
}
