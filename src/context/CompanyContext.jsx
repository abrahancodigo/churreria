import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase.config";
import { useAuth } from "../hooks/useAuth";
import { CompanyContext } from "./company-context";

const FALLBACK_COMPANY = Object.freeze({
    name: "Churrería POS",
    address: "",
    logoUrl: ""
});

const INITIAL_STATE = {
    uid: null,
    info: FALLBACK_COMPANY,
    loading: false
};

/** Una sola escucha de la empresa, compartida por toda la aplicación. */
export const CompanyProvider = ({ children }) => {
    const { user } = useAuth();
    const userId = user?.uid;
    const [state, setState] = useState(INITIAL_STATE);

    useEffect(() => {
        if (!userId) return undefined;

        let active = true;
        return onSnapshot(
            doc(db, "settings", "company"),
            (snap) => {
                if (!active) return;
                setState({
                    uid: userId,
                    info: snap.exists()
                        ? { ...FALLBACK_COMPANY, ...snap.data() }
                        : FALLBACK_COMPANY,
                    loading: false
                });
            },
            (error) => {
                if (!active) return;
                console.error("Error loading company settings:", error);
                setState({ uid: userId, info: FALLBACK_COMPANY, loading: false });
            }
        );
    }, [userId]);

    const companyInfo = state.uid === userId ? state.info : FALLBACK_COMPANY;
    const loading = Boolean(userId) && (state.uid !== userId || state.loading);

    return (
        <CompanyContext.Provider value={{ companyInfo, loading }}>
            {children}
        </CompanyContext.Provider>
    );
};