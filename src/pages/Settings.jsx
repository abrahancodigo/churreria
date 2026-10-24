import { useState, useEffect } from "react";
import { Save, Building, Users, Trash, Shield, RefreshCw } from "lucide-react";
import { db } from "../firebase.config";
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc } from "firebase/firestore";
import { reindexTransactions } from "../lib/db";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { useRole } from "../hooks/useRole";
import ConfirmDialog from "../components/ConfirmDialog";

export default function Settings() {
    const [companyInfo, setCompanyInfo] = useState({ name: "", address: "", logoUrl: "" });
    const [usersList, setUsersList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("company");
    const [isReindexing, setIsReindexing] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [deletingUser, setDeletingUser] = useState(false);
    const [showReindexConfirm, setShowReindexConfirm] = useState(false);
    const { addToast } = useToast();
    const { user } = useAuth();
    const { isAdmin } = useRole();

    // Redirect non-admins
    if (!isAdmin) {
        return (
            <div className="max-w-4xl mx-auto">
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <Shield className="h-5 w-5 text-yellow-400" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-yellow-700">
                                Solo los administradores pueden acceder a esta página.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    useEffect(() => {
        fetchSettings();
        fetchUsers();
    }, []);

    const fetchSettings = async () => {
        try {
            const docRef = doc(db, "settings", "company");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setCompanyInfo(docSnap.data());
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
        }
    };

    const fetchUsers = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "users"));
            const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsersList(users);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCompany = async (e) => {
        e.preventDefault();
        try {
            await setDoc(doc(db, "settings", "company"), companyInfo);
            addToast("¡Información de la empresa guardada!");
        } catch (error) {
            addToast("Error al guardar: " + error.message, "error");
        }
    };

    const toggleRole = async (targetUser) => {
        const newRole = targetUser.role === 'admin' ? 'cashier' : 'admin';
        try {
            await updateDoc(doc(db, "users", targetUser.id), { role: newRole });
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
            await deleteDoc(doc(db, "users", userToDelete));
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
            addToast("¡Migración completada! Todas las transacciones han sido re-indexadas.");
        } catch (error) {
            addToast("Error en la migración: " + error.message, "error");
        } finally {
            setIsReindexing(false);
            setShowReindexConfirm(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">Configuración</h1>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b">
                    <button
                        onClick={() => setActiveTab("company")}
                        className={`flex-1 py-3 sm:py-4 px-4 sm:px-6 text-center font-medium text-sm sm:text-base flex items-center justify-center gap-2 touch-manipulation ${activeTab === "company" ? "bg-blue-50 text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:bg-gray-50"}`}
                    >
                        <Building className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span>Empresa</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("users")}
                        className={`flex-1 py-3 sm:py-4 px-4 sm:px-6 text-center font-medium text-sm sm:text-base flex items-center justify-center gap-2 touch-manipulation ${activeTab === "users" ? "bg-blue-50 text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:bg-gray-50"}`}
                    >
                        <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span>Usuarios</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("maintenance")}
                        className={`flex-1 py-3 sm:py-4 px-4 sm:px-6 text-center font-medium text-sm sm:text-base flex items-center justify-center gap-2 touch-manipulation ${activeTab === "maintenance" ? "bg-blue-50 text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:bg-gray-50"}`}
                    >
                        <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span>Reseteo</span>
                    </button>
                </div>

                <div className="p-4 sm:p-6">
                    {activeTab === "company" && (
                        <form onSubmit={handleSaveCompany} className="space-y-6 max-w-lg">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Nombre de la Empresa</label>
                                <input
                                    type="text"
                                    value={companyInfo.name}
                                    onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-3 text-base"
                                    placeholder="ej. Churrería Porfirio"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Dirección / Pie de Página</label>
                                <textarea
                                    value={companyInfo.address}
                                    onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-3 text-base"
                                    rows="3"
                                    placeholder="ej. Av. Principal 123, Ciudad..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">URL del Logo (Opcional)</label>
                                <input
                                    type="text"
                                    value={companyInfo.logoUrl}
                                    onChange={(e) => setCompanyInfo({ ...companyInfo, logoUrl: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-3 text-base"
                                    placeholder="https://..."
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full sm:w-auto flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 touch-manipulation"
                            >
                                <Save className="mr-2 h-4 w-4" /> Guardar Cambios
                            </button>
                        </form>
                    )}

                    {activeTab === "users" && (
                        <div>
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
                                <h3 className="text-lg font-medium text-gray-900">Usuarios Registrados</h3>
                                <p className="text-sm text-gray-500">Para agregar, pídeles registrarse en el Login.</p>
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead>
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Correo</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {usersList.map((u) => (
                                            <tr key={u.id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.name || "Sin Nombre"}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.email}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                                                        {u.role === 'admin' ? 'Administrador' : 'Cajero'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <button
                                                        onClick={() => toggleRole(u)}
                                                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                                                        title="Cambiar Rol"
                                                    >
                                                        <Shield className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteUser(u.id)}
                                                        className="text-red-600 hover:text-red-900"
                                                        title="Eliminar Acceso"
                                                    >
                                                        <Trash className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-3">
                                {usersList.map((u) => (
                                    <div key={u.id} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-medium text-gray-900">{u.name || "Sin Nombre"}</h4>
                                                <p className="text-sm text-gray-500 truncate">{u.email}</p>
                                            </div>
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                                                {u.role === 'admin' ? 'Admin' : 'Cajero'}
                                            </span>
                                        </div>
                                        <div className="flex justify-end space-x-2 pt-2 border-t border-gray-200">
                                            <button
                                                onClick={() => toggleRole(u)}
                                                className="px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-md flex items-center gap-1 touch-manipulation"
                                            >
                                                <Shield className="h-4 w-4" />
                                                Cambiar Rol
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(u.id)}
                                                className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md flex items-center gap-1 touch-manipulation"
                                            >
                                                <Trash className="h-4 w-4" />
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {usersList.length === 0 && (
                                    <div className="text-center py-10 text-gray-500">
                                        No hay usuarios registrados.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === "maintenance" && (
                        <div className="space-y-6">
                            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
                                <div className="flex">
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-red-800">Zona de Riesgo</h3>
                                        <div className="mt-2 text-sm text-red-700">
                                            <p>Estas acciones modifican registros históricos de forma masiva.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border rounded-lg bg-gray-50">
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Re-indexar Transacciones</h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    Elimina las referencias actuales de todas las Entradas y Salidas y asigna nuevos números secuenciales (0001, 0002...) basados en la fecha de creación.
                                </p>
                                <button
                                    onClick={() => setShowReindexConfirm(true)}
                                    disabled={isReindexing}
                                    className="flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 touch-manipulation font-bold"
                                >
                                    {isReindexing ? <RefreshCw className="animate-spin mr-2 h-5 w-5" /> : <RefreshCw className="mr-2 h-5 w-5" />}
                                    {isReindexing ? "RE-INDEXANDO..." : "RE-INDEXAR TODO (SÓLO ADMIS)"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

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
