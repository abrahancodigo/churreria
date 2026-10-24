import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCompany } from "../context/CompanyContext";
import { useState } from "react";
import {
    LayoutDashboard,
    Package,
    Receipt,
    LogOut,
    ArrowRightLeft,
    Settings as SettingsIcon,
    X,
    FileBarChart2,
    ShoppingCart,
    Database,
} from "lucide-react";
import clsx from "clsx";
import { useRole } from "../hooks/useRole";

export default function Sidebar() {
    const { logout, user } = useAuth();
    const location = useLocation();
    const { isAdmin } = useRole();
    const { companyInfo } = useCompany();
    const [showLogoModal, setShowLogoModal] = useState(false);

    const navItems = [
        { name: "Inicio", path: "/", icon: LayoutDashboard },
        { name: "Inventario", path: "/inventory", icon: Package },
        { name: "Movimientos", path: "/stock-adjustments", icon: ArrowRightLeft },
        { name: "POS", path: "/pos", icon: ShoppingCart },
        { name: "Historial", path: "/transactions", icon: Receipt },
        { name: "Reportes", path: "/reports", icon: FileBarChart2 },
        { name: "Configuración", path: "/settings", icon: SettingsIcon },
        { name: "Backup", path: "/backup", icon: Database, adminOnly: true },
    ];

    return (
        <>
            <div className="flex flex-col h-full w-64 relative z-10">
                {/* Glassmorphic Sidebar with Gradient */}
                <div className="absolute inset-0 bg-sidebar-gradient backdrop-blur-xl"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-primary-50/50 via-transparent to-accent-50/30"></div>
                
                {/* Animated border */}
                <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-primary-300 via-accent-300 to-primary-300 opacity-50"></div>
                
                <div className="relative flex flex-col h-full border-r border-white/30 shadow-glass-lg">
                    {/* Brand Section */}
                    <div className="flex flex-col items-center justify-center border-b border-white/20 px-4 py-8 bg-gradient-to-b from-white/40 to-transparent">
                        {companyInfo.logoUrl && (
                            <button
                                onClick={() => setShowLogoModal(true)}
                                className="mb-4 hover:scale-110 transition-transform duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400 rounded-2xl bg-white/60 p-2 shadow-glow-primary group"
                                title="Clic para ver en tamaño completo"
                            >
                                <img
                                    src={companyInfo.logoUrl}
                                    alt="Logo"
                                    className="h-20 w-20 object-contain rounded-xl"
                                />
                            </button>
                        )}
                        <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-accent-600 text-center leading-tight tracking-tight">
                            {companyInfo.name || "Sistema de Inventario"}
                        </h1>
                    </div>

                    {/* Navigation */}
                    <div className="relative flex-1 overflow-y-auto py-6">
                        <nav className="px-3 space-y-2">
                            {navItems.filter(item => !item.adminOnly || isAdmin).map((item) => {
                                const Icon = item.icon;
                                const isActive = location.pathname === item.path;
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={clsx(
                                            "flex items-center px-4 py-3 text-sm font-semibold rounded-2xl transition-all duration-300 group relative overflow-hidden",
                                            isActive
                                                ? "bg-primary-gradient text-white shadow-glow-primary scale-105"
                                                : "text-slate-600 hover:bg-white/80 hover:text-primary-600 hover:translate-x-2"
                                        )}
                                    >
                                        {/* Active indicator glow */}
                                        {isActive && (
                                            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"></div>
                                        )}
                                        <Icon className={clsx(
                                            "mr-3 h-5 w-5 transition-all duration-300 relative z-10",
                                            isActive ? "text-white scale-110" : "text-slate-400 group-hover:text-primary-500 group-hover:scale-110"
                                        )} />
                                        <span className="relative z-10">{item.name}</span>
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    {/* User Section */}
                    <div className="relative p-4 border-t border-white/30 bg-gradient-to-t from-white/50 to-transparent">
                        <div className="flex items-center mb-4 px-2 py-3 bg-white/40 rounded-2xl border border-white/30 shadow-inner-light">
                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white font-bold text-xs shadow-glow-primary">
                                {user?.email?.charAt(0).toUpperCase()}
                            </div>
                            <div className="ml-3 truncate">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Usuario</p>
                                <p className="text-sm font-bold text-slate-700 truncate">{user?.email}</p>
                            </div>
                        </div>
                        <button
                            onClick={logout}
                            className="flex items-center w-full px-4 py-3 text-sm font-bold text-danger-600 rounded-2xl hover:bg-danger-50 hover:text-danger-700 transition-all duration-300 group border border-transparent hover:border-danger-200"
                        >
                            <LogOut className="mr-3 h-5 w-5 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12" />
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            </div>

            {/* Logo Modal */}
            {showLogoModal && companyInfo.logoUrl && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
                    onClick={() => setShowLogoModal(false)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] animate-scale-in" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setShowLogoModal(false)}
                            className="absolute -top-12 right-0 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-all duration-300 backdrop-blur-md"
                            aria-label="Cerrar"
                        >
                            <X className="h-6 w-6" />
                        </button>
                        <img
                            src={companyInfo.logoUrl}
                            alt="Logo Completo"
                            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-glass-lg bg-white/10 backdrop-blur-sm p-4"
                        />
                    </div>
                </div>
            )}
        </>
    );
}
