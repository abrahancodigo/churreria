import { useState, useEffect } from "react";
import { Save, Building, Users, Shield, RefreshCw, Trash } from "lucide-react";
import { db } from "../firebase.config";
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc } from "firebase/firestore";
import { reindexTransactions, getCorrelativeStatus } from "../lib/db";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../hooks/useAuth";
import { PageHeader, EmptyState, ListSkeleton } from "../components/ui";

export default function Settings() {
    const [companyInfo, setCompanyInfo] = useState({ name: "", address: "", logoUrl: "" });
    const [usersList, setUsersList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("company");
    const [isReindexing, setIsReindexing] = useState(false);
    const [seriesStatus, setSeriesStatus] = useState(null);
    const { addToast } = useToast();
    const { user } = useAuth();

    useEffect(() => {
        fetchSettings();
        fetchUsers();
    }, []);

    useEffect(() => {
        if (activeTab === "maintenance") refreshSeriesStatus();
    }, [activeTab]);

    const refreshSeriesStatus = async () => {
        try {
            setSeriesStatus(await getCorrelativeStatus());
        } catch (error) {
            console.error("Error fetching correlativos:", error);
        }
    };

    const fetchSettings = async () => {
        try {
            const snap = await getDoc(doc(db, "settings", "company"));
            if (snap.exists()) setCompanyInfo(snap.data());
        } catch (error) {
            console.error("Error fetching settings:", error);
        }
    };

    const fetchUsers = async () => {
        try {
            const snapshot = await getDocs(collection(db, "users"));
            setUsersList(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCompany = async (e) => {
        e.preventDefault();
        if (companyInfo.logoUrl) {
            try {
                const url = new URL(companyInfo.logoUrl);
                if (url.protocol !== "https:" && url.protocol !== "http:") {
                    throw new Error("protocolo no permitido");
                }
            } catch {
                addToast("El logo debe ser una URL http(s) válida.", "error");
                return;
            }
        }
        try {
            await setDoc(doc(db, "settings", "company"), companyInfo, { merge: true });
            addToast("¡Información de la empresa guardada!");
        } catch (error) {
            addToast("Error al guardar: " + error.message, "error");
        }
    };

    const toggleRole = async (targetUser) => {
        if (targetUser.id === user.uid) {
            addToast("No puedes cambiar tu propio rol desde aquí.", "error");
            return;
        }
        const admins = usersList.filter((u) => u.role === "admin");
        const newRole = targetUser.role === "admin" ? "cashier" : "admin";
        if (targetUser.role === "admin" && admins.length <= 1 && newRole !== "admin") {
            addToast("Debe quedar al menos un administrador.", "error");
            return;
        }
        try {
            await updateDoc(doc(db, "users", targetUser.id), { role: newRole });
            setUsersList((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u)));
            addToast(`Rol de ${targetUser.name} actualizado a ${newRole === "admin" ? "Administrador" : "Cajero"}`);
        } catch (error) {
            addToast("Error al actualizar rol: " + error.message, "error");
        }
    };

    const handleDeleteUser = async (userId) => {
        if (userId === user.uid) {
            addToast("No puedes eliminar tu propia cuenta.", "error");
            return;
        }
        const target = usersList.find((u) => u.id === userId);
        const admins = usersList.filter((u) => u.role === "admin");
        if (target?.role === "admin" && admins.length <= 1) {
            addToast("Debe quedar al menos un administrador.", "error");
            return;
        }
        if (!window.confirm("¿Eliminar este perfil? Perderá acceso a los datos de inmediato. También elimina su cuenta en Firebase Authentication para desactivar la sesión por completo.")) return;
        try {
            await deleteDoc(doc(db, "users", userId));
            setUsersList((prev) => prev.filter((u) => u.id !== userId));
            addToast("Usuario eliminado del sistema.");
        } catch (error) {
            addToast("Error al eliminar usuario: " + error.message, "error");
        }
    };

    const handleReindex = async () => {
        const ok = window.confirm(
            "Se renumerará TODO el historial de entradas y salidas.\n\n" +
            "• Entradas: serie propia desde 0001, de la más antigua a la más reciente.\n" +
            "• Salidas: serie propia desde 0001, igual.\n" +
            "• Se respeta la fecha del movimiento (no la de registro).\n" +
            "• Los folios actuales se reemplazan; los comprobantes ya impresos no cambian.\n\n" +
            "¿Continuar?"
        );
        if (!ok) return;
        setIsReindexing(true);
        try {
            const totals = await reindexTransactions();
            await refreshSeriesStatus();
            addToast(`¡Re-indexado completado! Entradas hasta ${String(totals.entry).padStart(4, "0")} · Salidas hasta ${String(totals.exit).padStart(4, "0")}.`);
        } catch (error) {
            addToast("Error en la migración: " + error.message, "error");
        } finally {
            setIsReindexing(false);
        }
    };

    return (
        <div>
            <PageHeader title="Configuración" sub="Empresa, usuarios y mantenimiento" />

            <div className="flex gap-1.5 mb-3" role="tablist" aria-label="Secciones de configuración">
                {[["company", "Empresa", Building], ["users", "Usuarios", Users], ["maintenance", "Reseteo", RefreshCw]].map(([v, l, TabIcon]) => (
                    <button key={v} onClick={() => setActiveTab(v)}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 min-h-[44px] rounded-xl text-sm font-extrabold transition-all border-2 ${activeTab === v ? "bg-sky-700 text-white border-sky-700" : "bg-white text-ink-2 border-line-strong hover:border-sky-600 hover:text-sky-700"}`}>
                        <TabIcon className="h-4 w-4" />{l}
                    </button>
                ))}
            </div>

            {activeTab === "company" && (
                <form onSubmit={handleSaveCompany} className="card space-y-4 max-w-lg">
                    <div>
                        <label className="label" htmlFor="set-name">Nombre de la empresa</label>
                        <input id="set-name" type="text" value={companyInfo.name || ""}
                            onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })}
                            className="input" placeholder="Ej. Churrería Porfirio" />
                    </div>
                    <div>
                        <label className="label" htmlFor="set-addr">Dirección / pie de página</label>
                        <textarea id="set-addr" value={companyInfo.address || ""}
                            onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })}
                            className="input" rows="3" placeholder="Ej. Av. Principal 123" />
                    </div>
                    <div>
                        <label className="label" htmlFor="set-logo">URL del logo (opcional)</label>
                        <input id="set-logo" type="url" value={companyInfo.logoUrl || ""}
                            onChange={(e) => setCompanyInfo({ ...companyInfo, logoUrl: e.target.value })}
                            className="input" placeholder="https://..." />
                        {companyInfo.logoUrl && (
                            <img src={companyInfo.logoUrl} alt="Vista previa del logo" className="mt-2 h-16 w-16 object-contain rounded-xl border border-line bg-paper p-1" />
                        )}
                    </div>
                    <button type="submit" className="btn-primary w-full sm:w-auto">
                        <Save className="h-5 w-5" /> Guardar cambios
                    </button>
                </form>
            )}

            {activeTab === "users" && (
                <div className="card !p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-3">
                        <h3 className="font-extrabold text-ink">Usuarios registrados</h3>
                        <p className="text-xs text-ink-3">Para agregar, pídeles registrarse en el login.</p>
                    </div>
                    {loading ? (
                        <ListSkeleton rows={4} />
                    ) : usersList.length === 0 ? (
                        <EmptyState icon={Users} title="Sin usuarios" hint="Aún no hay cuentas registradas." />
                    ) : (
                        <ul className="space-y-2">
                            {usersList.map((u) => (
                                <li key={u.id} className="rounded-xl border border-line p-3 flex items-center gap-3">
                                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-black text-white flex-shrink-0 ${u.role === "admin" ? "bg-indigo-600" : "bg-ink-3"}`}>
                                        {(u.name || u.email || "?").charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-ink truncate">{u.name || "Sin nombre"}</p>
                                        <p className="text-xs text-ink-3 truncate">{u.email}</p>
                                    </div>
                                    <span className={u.role === "admin" ? "badge-admin" : "badge-muted"}>
                                        {u.role === "admin" ? "Admin" : "Cajero"}
                                    </span>
                                    <div className="flex gap-1">
                                        <button onClick={() => toggleRole(u)} aria-label={`Cambiar rol de ${u.email}`}
                                            className="btn-icon">
                                            <Shield className="h-5 w-5" />
                                        </button>
                                        <button onClick={() => handleDeleteUser(u.id)} aria-label={`Eliminar ${u.email}`}
                                            className="btn-icon !text-rose-600 hover:!bg-rose-50">
                                            <Trash className="h-5 w-5" />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {activeTab === "maintenance" && (
                <div className="space-y-3 max-w-lg">
                    <div className="card !border-rose-300 !bg-rose-50">
                        <h3 className="font-extrabold text-rose-900 mb-1">Zona de riesgo</h3>
                        <p className="text-sm text-rose-800">Estas acciones modifican registros históricos de forma masiva.</p>
                    </div>
                    <div className="card">
                        <h3 className="font-extrabold text-ink mb-1">Correlativos de movimientos</h3>
                        <p className="text-sm text-ink-3">
                            Las entradas y las salidas llevan numeración <strong>separada y continua</strong>:
                            cada tipo va 0001, 0002, 0003… según la fecha del movimiento (la más antigua primero).
                            El tipo ya se distingue en el comprobante (ENT / SAL), así que el folio es solo el número.
                        </p>
                        <div className="grid grid-cols-2 gap-2 mt-3">
                            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                                <p className="text-[11px] font-extrabold text-emerald-700 uppercase">Entradas</p>
                                <p className="font-mono font-black text-xl text-emerald-900">
                                    {seriesStatus?.entryLabel || "—"}
                                </p>
                                <p className="text-[11px] text-emerald-700">último folio usado</p>
                            </div>
                            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                                <p className="text-[11px] font-extrabold text-amber-700 uppercase">Salidas</p>
                                <p className="font-mono font-black text-xl text-amber-900">
                                    {seriesStatus?.exitLabel || "—"}
                                </p>
                                <p className="text-[11px] text-amber-700">último folio usado</p>
                            </div>
                        </div>
                    </div>
                    <div className="card">
                        <h3 className="font-extrabold text-ink mb-1">Re-indexar transacciones</h3>
                        <p className="text-sm text-ink-3 mb-3">
                            Renumera todo el historial desde 0001 <strong>por separado</strong> para entradas y salidas,
                            ordenando por la <strong>fecha del movimiento</strong>. Úsalo una vez si vienes de la numeración
                            anterior (que era una sola serie compartida) o si necesitas recalcular todo.
                        </p>
                        <button onClick={handleReindex} disabled={isReindexing} className="btn-danger w-full sm:w-auto">
                            <RefreshCw className={`h-5 w-5 ${isReindexing ? "animate-spin" : ""}`} />
                            {isReindexing ? "Re-indexando..." : "Re-indexar todo"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
