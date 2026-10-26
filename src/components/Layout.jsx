import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, Moon, Sun, Flame } from "lucide-react";
import Sidebar from "./Sidebar";
import { useCompany } from "../context/CompanyContext";
import { useTheme } from "../context/ThemeContext";

export default function Layout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { companyInfo } = useCompany();
    const { theme, toggleTheme } = useTheme();

    useEffect(() => {
        document.body.style.overflow = isSidebarOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [isSidebarOpen]);

    // El drawer se cierra desde el onClick de cada enlace (ver Sidebar
    // onNavigate), no desde un efecto sobre la ruta: así evitamos un render
    // en cascada y el cierre ocurre en el mismo evento que la navegación.

    useEffect(() => {
        if (!isSidebarOpen) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === "Escape") setIsSidebarOpen(false);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isSidebarOpen]);

    return (
        <div className="app-shell flex min-h-dvh bg-ink-50 md:h-dvh md:overflow-hidden">
            <div className="relative z-30 hidden shrink-0 md:flex shadow-sidebar">
                <Sidebar />
            </div>

            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-50 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                >
                    <div className="absolute inset-0 bg-scrim/55 backdrop-blur-[2px] animate-fade-in" />
                    <div
                        className="absolute inset-y-0 left-0 w-64 animate-slide-in-left"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <Sidebar onNavigate={() => setIsSidebarOpen(false)} />
                    </div>
                </div>
            )}

            <div className="relative z-10 flex min-w-0 flex-1 flex-col md:overflow-hidden">
                <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-ink-200/70 bg-surface/85 px-4 backdrop-blur-xl sm:px-6 md:relative md:bg-surface md:backdrop-blur-none">
                    <div className="flex min-w-0 items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsSidebarOpen(true)}
                            className="touch-target -ml-2 rounded-xl text-ink-600 transition hover:bg-ink-100 md:hidden"
                            aria-label="Abrir menú"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                        <div className="flex items-center gap-2.5 md:hidden">
                            {companyInfo.logoUrl ? (
                                <img src={companyInfo.logoUrl} alt="" className="h-8 w-8 rounded-lg object-contain" />
                            ) : (
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                                    <Flame className="h-4 w-4" aria-hidden="true" />
                                </span>
                            )}
                            <span className="max-w-[42vw] truncate text-sm font-semibold text-ink-900">
                                {companyInfo.name || "Churrería"}
                            </span>
                        </div>
                        <p className="hidden text-sm font-medium text-ink-500 md:block">Panel de gestión</p>
                    </div>

                    <button
                        type="button"
                        onClick={toggleTheme}
                        className="btn-icon h-10 w-10 rounded-xl"
                        aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
                        title={theme === "dark" ? "Tema claro" : "Tema oscuro"}
                    >
                        {theme === "dark"
                            ? <Sun className="h-[18px] w-[18px]" aria-hidden="true" />
                            : <Moon className="h-[18px] w-[18px]" aria-hidden="true" />}
                    </button>
                </header>

                <main className="relative custom-scrollbar min-h-0 flex-1 md:overflow-y-auto">
                    <div className="pb-safe py-6 sm:py-8">
                        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                            <Outlet />
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
