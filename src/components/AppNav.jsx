import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useRole } from "../hooks/useRole";
import { useCompany } from "../hooks/useCompany";
import { LogOut, ChevronRight, X } from "lucide-react";
import { NAV_GROUPS, BOTTOM_TABS } from "./nav";

/** Logo o inicial de la empresa, en una capsula de marca. */
export function CompanyMark({ company, size = "md" }) {
    const box = size === "lg" ? "h-11 w-11 rounded-2xl text-lg" : "h-9 w-9 rounded-xl text-base";
    return company.logoUrl ? (
        <img src={company.logoUrl} alt="Logo"
            className={`${box} object-contain bg-white border border-white/15 p-1 flex-shrink-0`} />
    ) : (
        <div className={`${box} bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center font-black flex-shrink-0 shadow-glow`}>
            {(company.name || "C").charAt(0).toUpperCase()}
        </div>
    );
}

/**
 * Barra lateral de escritorio.
 *
 * Fondo oscuro (`ink`): da jerarquia frente al contenido claro y hace que la
 * banda azul del item activo resalte sin necesidad de relleno. El contraste
 * de todo el texto sobre el marino profundo esta por encima de 9:1.
 */
export function SidebarNav({ onNavigate }) {
    const location = useLocation();
    const { user, logout } = useAuth();
    const { isAdmin } = useRole();
    const company = useCompany();

    return (
        <div className="flex flex-col h-full bg-ink-fade text-white border-r border-black/40">
            <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
                <CompanyMark company={company} />
                <div className="min-w-0">
                    <p className="font-extrabold truncate leading-tight text-white">{company.name}</p>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-brand-100">
                        {isAdmin ? "Administrador" : "Cajero"}
                    </p>
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
                {NAV_GROUPS.filter((g) => !g.adminOnly || isAdmin).map((group) => (
                    <div key={group.label}>
                        <p className="px-3 mb-2 text-[10px] font-extrabold text-white/85 uppercase tracking-[0.16em]">
                            {group.label}
                        </p>
                        <div className="space-y-0.5">
                            {group.items.map((item) => {
                                const Icon = item.icon;
                                const active = location.pathname === item.path;
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        onClick={onNavigate}
                                        aria-current={active ? "page" : undefined}
                                        className={`group relative flex items-center gap-3 pl-3 pr-2.5 min-h-[44px] py-2.5 rounded-xl text-[15px] font-bold transition-all
                                            ${active
                                                ? "bg-white/[0.12] text-white"
                                                : "text-white/85 hover:bg-white/[0.06] hover:text-white"}`}
                                    >
                                        {active && (
                                            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-brand-400" />
                                        )}
                                        <Icon className={`h-5 w-5 flex-shrink-0 transition-colors ${active ? "text-brand-300" : "text-white/70 group-hover:text-white"}`} />
                                        <span className="flex-1">{item.name}</span>
                                        <ChevronRight className={`h-4 w-4 transition-all ${active ? "opacity-60" : "opacity-0 -translate-x-1 group-hover:opacity-40 group-hover:translate-x-0"}`} />
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            <div className="p-3 border-t border-white/10 space-y-1">
                <div className="flex items-center gap-2.5 px-2 py-1.5">
                    <span className="h-8 w-8 rounded-full bg-white/10 text-white/85 flex items-center justify-center text-xs font-black flex-shrink-0">
                        {(user?.email || "?").charAt(0).toUpperCase()}
                    </span>
                    <p className="truncate text-xs font-semibold text-white/65">{user?.email}</p>
                </div>
                <button
                    onClick={logout}
                    className="flex items-center gap-3 w-full px-2.5 min-h-[44px] py-2.5 rounded-xl text-sm font-bold text-rose-300 hover:bg-rose-500/15 hover:text-rose-200 transition-colors"
                >
                    <LogOut className="h-5 w-5" />
                    Cerrar sesión
                </button>
            </div>
        </div>
    );
}

/**
 * Navegacion inferior en movil: tres accesos, el central destacado.
 *
 * Es un hijo en flujo al final de la columna del Layout (no flotante): el
 * scroll ocurre en el area de contenido contigua, asi que la barra no puede
 * moverse al desplazarse la pantalla, sin importar el modulo activo.
 */
export function BottomNav() {
    const location = useLocation();
    return (
        <nav className="md:hidden shrink-0 relative z-40 bg-white border-t border-line px-2 pt-1.5 shadow-[0_-6px_20px_-12px_rgba(15,23,42,0.35)]"
            style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
            <div className="grid grid-cols-3 items-end gap-1">
                {BOTTOM_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const active = location.pathname === tab.path;
                    if (tab.center) {
                        return (
                            <Link key={tab.path} to={tab.path} aria-label={tab.name}
                                className="flex flex-col items-center gap-0.5 -mt-5">
                                <span className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all
                                    ${active
                                        ? "bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-glow scale-105"
                                        : "bg-brand-500 text-white shadow-pop"}`}>
                                    <Icon className="h-6 w-6" strokeWidth={2.4} />
                                </span>
                                <span className={`text-[10px] font-extrabold ${active ? "text-brand-700" : "text-ink-3"}`}>
                                    {tab.name}
                                </span>
                            </Link>
                        );
                    }
                    return (
                        <Link key={tab.path} to={tab.path} aria-current={active ? "page" : undefined}
                            className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-[11px] font-bold transition-colors
                                ${active ? "text-brand-700" : "text-ink-3"}`}>
                            <span className={`p-1.5 rounded-xl transition-colors ${active ? "bg-brand-50" : ""}`}>
                                <Icon className="h-5 w-5" strokeWidth={active ? 2.6 : 2} />
                            </span>
                            {tab.name}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

/**
 * Cajon hamburguesa para movil: reproduce la sidebar completa (logo, rol,
 * grupos con links de admin y logout) en un panel que entra desde la derecha.
 * Convive con BottomNav a proposito: la barra inferior cubre el acceso rapido
 * y el cajon expone el arbol completo (incluidos los links de admin).
 */
export function MobileMenuDrawer({ open, onClose }) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", onKey);
        const { body } = document;
        const prevOverflow = body.style.overflow;
        body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            body.style.overflow = prevOverflow;
        };
    }, [open, onClose]);
    if (!open) return null;
    return (
        <div className="md:hidden fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Menú de navegación">
            <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden="true" />
            <div className="absolute inset-y-0 right-0 w-[86%] max-w-[19rem] bg-ink-fade shadow-pop border-l border-black/30 overflow-y-auto animate-slide-in-right">
                <button type="button" onClick={onClose} aria-label="Cerrar menú"
                    className="absolute top-3 right-3 z-10 h-11 w-11 rounded-xl text-white/85 hover:bg-white/10 hover:text-white inline-flex items-center justify-center transition-colors touch-manipulation">
                    <X className="h-6 w-6" strokeWidth={2.4} />
                </button>
                <SidebarNav onNavigate={onClose} />
            </div>
        </div>
    );
}
