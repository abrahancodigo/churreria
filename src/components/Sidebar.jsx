import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
    ArrowRightLeft,
    Database,
    FileBarChart2,
    Flame,
    LayoutDashboard,
    LogOut,
    Package,
    Receipt,
    Settings as SettingsIcon,
    ShoppingCart,
    X,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";
import { useCompany } from "../context/CompanyContext";
import { useRole } from "../hooks/useRole";

const OPERATIONS = [
    { name: "Resumen", path: "/", icon: LayoutDashboard },
    { name: "Inventario", path: "/inventory", icon: Package },
    { name: "Movimientos", path: "/stock-adjustments", icon: ArrowRightLeft },
    { name: "Punto de venta", path: "/pos", icon: ShoppingCart },
    { name: "Ventas e historial", path: "/transactions", icon: Receipt },
    { name: "Reportes", path: "/reports", icon: FileBarChart2 },
];

const ADMINISTRATION = [
    { name: "Configuración", path: "/settings", icon: SettingsIcon },
    { name: "Copias de seguridad", path: "/backup", icon: Database, adminOnly: true },
];

function NavigationItem({ item, active, onNavigate }) {
    const Icon = item.icon;

    return (
        <Link
            to={item.path}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={clsx(
                "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                active
                    ? "bg-primary-50 text-primary-800"
                    : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
            )}
        >
            <Icon
                className={clsx(
                    "h-[18px] w-[18px] shrink-0 transition-colors",
                    active ? "text-primary-700" : "text-ink-400 group-hover:text-ink-700",
                )}
                aria-hidden="true"
            />
            <span className="truncate">{item.name}</span>
            {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-600" aria-hidden="true" />}
        </Link>
    );
}

export default function Sidebar({ onNavigate }) {
    const { logout, user } = useAuth();
    const { companyInfo } = useCompany();
    const { isAdmin, role } = useRole();
    const location = useLocation();
    const [showLogo, setShowLogo] = useState(false);

    const renderNavigation = (items) => items
        .filter((item) => !item.adminOnly || isAdmin)
        .map((item) => (
            <NavigationItem
                key={item.path}
                item={item}
                active={location.pathname === item.path}
                onNavigate={onNavigate}
            />
        ));

    return (
        <>
            <aside className="flex h-full w-64 shrink-0 flex-col border-r border-ink-200/70 bg-rail">
                <div className="flex h-[76px] shrink-0 items-center gap-3 border-b border-ink-200/70 px-5">
                    {companyInfo.logoUrl ? (
                        <button
                            type="button"
                            onClick={() => setShowLogo(true)}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ink-200/70 bg-white p-1.5 transition hover:border-primary-300"
                            title="Ver logo"
                        >
                            <img src={companyInfo.logoUrl} alt={`Logo de ${companyInfo.name || "la tienda"}`} className="h-full w-full object-contain" />
                        </button>
                    ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                            <Flame className="h-5 w-5" aria-hidden="true" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="truncate text-sm font-bold tracking-tight text-ink-900">
                            {companyInfo.name || "Churrería"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-ink-500">Gestión de tienda</p>
                    </div>
                    {onNavigate && (
                        <button
                            type="button"
                            onClick={onNavigate}
                            className="btn-icon ml-auto h-9 w-9 shrink-0 rounded-lg"
                            aria-label="Cerrar menú"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>

                <nav aria-label="Navegación principal" className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-3 py-5">
                    <div className="space-y-1">
                        <p className="px-3.5 pb-2 text-[11px] font-semibold text-ink-400">OPERACIÓN</p>
                        {renderNavigation(OPERATIONS)}
                    </div>

                    <div className="space-y-1">
                        <p className="px-3.5 pb-2 text-[11px] font-semibold text-ink-400">ADMINISTRACIÓN</p>
                        {renderNavigation(ADMINISTRATION)}
                    </div>
                </nav>

                <div className="shrink-0 border-t border-ink-200/70 p-3">
                    <div className="mb-2 flex items-center gap-3 rounded-xl bg-ink-50 px-3 py-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-800">
                            {(user?.email || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-ink-800">{user?.email || "Usuario"}</p>
                            <p className="mt-0.5 text-xs text-ink-500">
                                {role === "admin" ? "Administrador" : "Cajero"}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={logout}
                        className="btn-ghost w-full justify-start px-3.5 text-ink-500 hover:bg-danger-50 hover:text-danger-700"
                    >
                        <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
                        Cerrar sesión
                    </button>
                </div>
            </aside>

            {showLogo && companyInfo.logoUrl && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-scrim/70 p-4 backdrop-blur-sm animate-fade-in"
                    onClick={() => setShowLogo(false)}
                >
                    <div
                        className="relative max-h-[90vh] max-w-4xl animate-scale-in"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Logo de la tienda"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => setShowLogo(false)}
                            className="absolute -right-2 -top-12 rounded-full bg-white/15 p-2 text-white transition hover:bg-white/25"
                            aria-label="Cerrar logo"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <img
                            src={companyInfo.logoUrl}
                            alt={`Logo de ${companyInfo.name || "la tienda"}`}
                            className="max-h-[90vh] max-w-full rounded-2xl bg-surface p-4 object-contain shadow-panel"
                        />
                    </div>
                </div>
            )}
        </>
    );
}
