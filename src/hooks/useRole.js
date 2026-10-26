import { useAuth } from "./useAuth";

export const useRole = () => {
    const { userData } = useAuth();

    const isAdmin = userData?.role === 'admin';
    const isCashier = userData?.role === 'cashier';

    return {
        isAdmin,
        isCashier,
        role: userData?.role || 'cashier'
    };
};
