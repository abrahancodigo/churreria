import { useState, useEffect } from "react";
import { Save, Building, Users, Trash, Shield, RefreshCw, AlertTriangle } from "lucide-react";
import { reindexTransactions } from "../services/movementService";
import {
    deleteUser,
    getCompanySettings,
    listUsers,
    saveCompanySettings,
    updateUserRole
} from "../services/settingsService";
import { useToast } from "../context/ToastContext";
import { useRole } from "../hooks/useRole";
import ConfirmDialog from "../components/ConfirmDialog";

export default function Settings() {
    const [companyInfo, setCompanyInfo] = useState({ name: "", address: "", logoUrl: "" });
    const [usersList, setUsersList] = useState([]);
    const [activeTab, setActiveTab] = useState("company");
    const [isReindexing, setIsReindexing] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [deletingUser, setDeletingUser] = useState(false);
    const [showReindexConfirm, setShowReindexConfirm] = useState(false);
    const { addToast } = useToast();
    const { isAdmin } = useRole();

    useEffect(() => {
        if (!isAdmin) return;
        fetchSettings();
        fetchUsers();
    }, [isAdmin]);

    const fetchSettings = async () => {
        try {
            const company = await getCompanySettings();
            if (company) {
                setCompanyInfo(company);
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
        }
    };

    const fetchUsers = async () => {
        try {
            const users = await listUsers();
            setUsersList(users);
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    };

    const handleSaveCompany = async (e) => {
        e.preventDefault();
        try {
            await saveCompanySettings(companyInfo);
            addToast("Información de la empresa guardada");
        } catch (error) {
            addToast("Error al guardar: " + error.message, "error");
        }
    };

    const toggleRole = async (targetUser) => {
        const newRole = targetUser.role === 'admin' ? 'cashier' : 'admin';
        try {
            await updateUserRole(targetUser.id, newRole);
            setUsersList(prev => prev.map(u => u.id === targetUser.id ? { ...u, role: newRole } : u));
            addToast(`Rol de ${targetUser.name} actualizado a ${newRole === 'admin' ? 'Administrador' : 'Cajero'}`);
        } catch (error) {
            addToast("Error al actualizar rol: " + error.message, "error");
        }
    };

    const handleDeleteUser = async (userId) => {
        setUserToDelete(userId);
    };

    const confirmDeleteUser = async () => {
        if (!userToDelete) return;
        setDeletingUser(true);
        try {
            await deleteUser(userToDelete);
            setUsersList(prev => prev.filter(u => u.id !== userToDelete));
            addToast("Usuario eliminado del sistema.");
            setUserToDelete(null);
        } catch (error) {
            addToast("Error al eliminar usuario: " + error.message, "error");
        } finally {
            setDeletingUser(false);
        }
    };

    const handleReindex = async () => {
        setIsReindexing(true);
        try {
            await reindexTransactions();
            addToast("Migración completada. Todas las transacciones han sido re-indexadas.");
        } catch (error) {
            addToast("Error en la migración: " + error.message, "error");
        } finally {
            setIsReindexing(false);
            setShowReindexConfirm(false);
        }
    };

    const tabs = [
        { id: "company", label: "Empresa", icon: Building },
        { id: "users", label: "Usuarios", icon: Users },
        { id: "maintenance", label: "Mantenimiento", icon: RefreshCw },
    ];

    // Redirect non-admins
    if (!isAdmin) {
        return (
            <div className="max-w-4xl mx-auto">
                <div className="surface p-5 flex items-start gap-4">
                    <div className="stat-icon bg-warning-50 text-warning-700 shrink-0">
                        <Shield className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium text-ink-700 mt-2">
                        Solo los administradores pueden acceder a esta página.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Configuración</h1>
                    <p className="page-subtitle">Empresa, usuarios y mantenimiento del sistema</p>
                </div>
            </header>

            {/* Tabs */}
            <div className="segmented w-full overflow-x-auto custom-scrollbar">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`segment flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 text-sm ${
                                isActive
                                    ? "segment-active text-primary-700"
                                    : "hover:bg-surface hover:text-ink-900"
                            }`}
                        >
                            <Icon className="h-4 w-4" />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {activeTab === "company" && (
                <form onSubmit={handleSaveCompany} className="surface overflow-hidden">
                    <div className="card-header">
                        <h2 className="section-title">{tabs[0].label}</h2>
                    </div>
                    <div className="space-y-5 p-4 sm:p-6 max-w-lg">
                        <div>
                            <label htmlFor="set-company-name" className="input-label">Nombre de la empresa</label>
                            <input
                                id="set-company-name"
                                type="text"
                                value={companyInfo.name}
                                onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })}
                                className="input-field"
                                placeholder="ej. Churrería Porfirio"
                            />
                        </div>
                        <div>
                            <label htmlFor="set-company-address" className="input-label">Dirección / pie de página</label>
                            <textarea
                                id="set-company-address"
                                value={companyInfo.address}
                                onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })}
                                className="input-field"
                                rows="3"
                                placeholder="ej. Av. Principal 123, Ciudad..."
                            />
                        </div>
                        <div>
                            <label htmlFor="set-company-logo" className="input-label">URL del logo (opcional)</label>
                            <input
                                id="set-company-logo"
                                type="text"
                                value={companyInfo.logoUrl}
                                onChange={(e) => setCompanyInfo({ ...companyInfo, logoUrl: e.target.value })}
                                className="input-field"
                                placeholder="https://..."
                            />
                        </div>
                    </div>
                    <div className="divider px-4 sm:px-6 py-4">
                        <button type="submit" className="btn-primary">
                            <Save className="h-4 w-4" />
                            Guardar cambios
                        </button>
                    </div>
                </form>
            )}

            {activeTab === "users" && (
                <div className="surface overflow-hidden">
                    <div className="card-header flex-col items-start sm:flex-row sm:items-center">
                        <h3 className="section-title">Usuarios registrados</h3>
                        <p className="text-sm text-ink-500">Para agregar, pídeles registrarse en el login.</p>
                    </div>

                    <div className="p-4 sm:p-5 space-y-4">
                        {/* Desktop Table View */}
                        <div className="hidden md:block table-shell">
                            <div className="table-scroll">
                                <table className="min-w-full">
                                        <thead className="table-head">
                                            <tr>
                                                <th>Nombre</th>
                                                <th>Correo</th>
                                                <th>Rol</th>
                                                <th className="text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="table-body">
                                            {usersList.map((u) => (
                                                <tr key={u.id}>
                                                    <td className="whitespace-nowrap font-medium text-ink-900">{u.name || "Sin nombre"}</td>
                                                    <td className="whitespace-nowrap text-ink-500">{u.email}</td>
                                                    <td className="whitespace-nowrap">
                                                        <span className={u.role === 'admin' ? 'badge-primary' : 'badge-neutral'}>
                                                            {u.role === 'admin' ? 'Administrador' : 'Cajero'}
                                                        </span>
                                                    </td>
                                                    <td className="whitespace-nowrap text-right">
                                                        <div className="inline-flex items-center gap-1">
                                                            <button
                                                                onClick={() => toggleRole(u)}
                                                                className="btn-icon h-10 w-10 rounded-xl hover:text-primary-700 hover:bg-primary-50"
                                                                title="Cambiar rol"
                                                                aria-label={`Cambiar rol de ${u.name || u.email}`}
                                                            >
                                                                <Shield className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteUser(u.id)}
                                                                className="btn-icon h-10 w-10 rounded-xl hover:text-danger-700 hover:bg-danger-50"
                                                                title="Eliminar acceso"
                                                                aria-label={`Eliminar acceso de ${u.name || u.email}`}
                                                            >
                                                                <Trash className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-3">
                            {usersList.map((u) => (
                                <div key={u.id} className="surface-muted p-4">
                                    <div className="flex justify-between items-start gap-3 mb-3">
                                        <div className="min-w-0">
                                            <h4 className="text-sm font-semibold text-ink-900">{u.name || "Sin nombre"}</h4>
                                            <p className="text-xs text-ink-500 truncate">{u.email}</p>
                                        </div>
                                        <span className={u.role === 'admin' ? 'badge-primary' : 'badge-neutral'}>
                                            {u.role === 'admin' ? 'Admin' : 'Cajero'}
                                        </span>
                                    </div>
                                    <div className="divider mt-3 pt-3 flex justify-end gap-2">
                                        <button
                                            onClick={() => toggleRole(u)}
                                            className="btn-ghost"
                                        >
                                            <Shield className="h-4 w-4" />
                                            Cambiar rol
                                        </button>
                                        <button
                                            onClick={() => handleDeleteUser(u.id)}
                                            className="btn-ghost text-danger-600 hover:bg-danger-50"
                                        >
                                            <Trash className="h-4 w-4" />
                                            Eliminar
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {usersList.length === 0 && (
                                <div className="surface-muted empty-state">
                                    <div className="empty-icon bg-surface">
                                        <Users className="h-6 w-6 text-ink-400" />
                                    </div>
                                    <p className="text-sm font-medium text-ink-700">No hay usuarios registrados.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "maintenance" && (
                <div className="surface overflow-hidden">
                    <div className="card-header">
                        <h3 className="section-title">Re-indexar transacciones</h3>
                    </div>

                    <div className="p-4 sm:p-5">
                        <div className="surface-muted">
                            <div className="p-4 flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-danger-600 shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="badge-danger">Zona de riesgo</h3>
                                    <p className="text-sm text-ink-600 mt-2">
                                        Estas acciones modifican registros históricos de forma masiva.
                                    </p>
                                </div>
                            </div>

                            <div className="divider mx-4" />

                            <div className="p-4">
                                <p className="text-sm text-ink-600">
                                    Elimina las referencias actuales de todas las entradas y salidas y asigna nuevos
                                    números secuenciales (0001, 0002...) basados en la fecha de creación.
                                </p>
                                <button
                                    onClick={() => setShowReindexConfirm(true)}
                                    disabled={isReindexing}
                                    className="btn-danger mt-4"
                                >
                                    {isReindexing
                                        ? <RefreshCw className="animate-spin h-4 w-4" />
                                        : <RefreshCw className="h-4 w-4" />}
                                    {isReindexing ? "Re-indexando..." : "Re-indexar todo (solo admins)"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={!!userToDelete}
                title="Eliminar usuario"
                message="Este usuario perderá el acceso al sistema. El historial de ventas que registró se conserva."
                confirmLabel="Sí, eliminar"
                loading={deletingUser}
                onConfirm={confirmDeleteUser}
                onCancel={() => !deletingUser && setUserToDelete(null)}
            />

            <ConfirmDialog
                open={showReindexConfirm}
                title="Re-indexar todas las transacciones"
                message={"Esta acción re-indexará TODAS las entradas y salidas cronológicamente empezando desde 0001.\n\n¿Deseas continuar?"}
                confirmLabel="Sí, re-indexar"
                loading={isReindexing}
                onConfirm={handleReindex}
                onCancel={() => !isReindexing && setShowReindexConfirm(false)}
            />
        </div>
    );
}
