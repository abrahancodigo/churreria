import { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.config';

/**
 * Single source of truth for the `settings/company` document.
 *
 * Previously Layout, Sidebar, ReceiptPrinter and Transactions each opened
 * their own read of this document, which meant 4 reads on every app start and
 * the risk of components rendering stale company data. One shared listener
 * fixes both.
 *
 * The exported context object is required for the provider and hook, so this
 * file intentionally mixes exports (same pattern as AuthContext/ToastContext).
 */
export const CompanyContext = createContext({ companyInfo: {}, loading: true });

export const useCompany = () => useContext(CompanyContext);

/** Shared listener over `settings/company`. */

export const CompanyProvider = ({ children }) => {
    const [companyInfo, setCompanyInfo] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onSnapshot(
            doc(db, 'settings', 'company'),
            (snap) => {
                setCompanyInfo(snap.exists() ? snap.data() : {});
                setLoading(false);
            },
            (error) => {
                console.error('Error loading company settings:', error);
                setLoading(false);
            }
        );
        return () => unsubscribe();
    }, []);

    return (
        <CompanyContext.Provider value={{ companyInfo, loading }}>
            {children}
        </CompanyContext.Provider>
    );
};
