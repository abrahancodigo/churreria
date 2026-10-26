import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useRole } from "../hooks/useRole";

export default function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
                <div className="w-full max-w-sm space-y-3">
                    <div className="skeleton h-8 w-2/3" />
                    <div className="skeleton h-24" />
                    <div className="skeleton h-24" />
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

export function RequireAdmin({ children }) {
    const { userData, profileLoading, profileError } = useAuth();
    const { isAdmin } = useRole();

    if (profileLoading) {
        return (
            <div className="card space-y-3" aria-label="Verificando permisos">
                <div className="skeleton h-7 w-1/3" />
                <div className="skeleton h-20" />
            </div>
        );
    }

    if (profileError) {
        return (
            <div className="card text-center py-12">
                <p className="font-extrabold text-slate-900">No se pudo verificar tu perfil</p>
                <p className="text-sm text-slate-500 mt-1">Revisa la conexión y recarga la página.</p>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="card text-center py-12">
                <p className="text-4xl mb-3">🔒</p>
                <p className="font-extrabold text-slate-900">Solo administradores</p>
                <p className="text-sm text-slate-500 mt-1">
                    {userData ? `Tu rol es "${userData.role || "cajero"}". Pide a un administrador que te dé acceso.` : "No tienes permiso para ver esta sección."}
                </p>
            </div>
        );
    }

    return children;
}
