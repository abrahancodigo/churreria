import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) return <div className="flex h-screen h-[100dvh] items-center justify-center">Loading...</div>;

    if (!user) {
        return <Navigate to="/login" />;
    }

    return children;
}
