import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import { SidebarNav, BottomNav, CompanyMark, MobileMenuDrawer } from "./AppNav";
import { useCompany } from "../hooks/useCompany";

export default function Layout() {
    const company = useCompany();
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <div className="min-h-screen bg-paper">
            {/* Fondo con malla azulada: evita el lienzo plano y separa las tarjetas. */}
            <div className="pointer-events-none fixed inset-0 -z-10 bg-mesh-cool opacity-70" aria-hidden="true" />

            {/* Barra lateral de escritorio */}
            <aside className="hidden md:block fixed inset-y-0 left-0 w-64 z-30">
                <SidebarNav />
            </aside>

            {/* Cabecera movil con la misma identidad que el sidebar + hamburguesa.
                Altura y sangria alineadas con el contenido (px-4) para que la
                marca, el titulo y las tarjetas compartan el mismo eje. */}
            <header className="md:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-line shadow-card">
                <div className="flex items-center gap-2.5 pl-4 pr-2 h-14">
                    <CompanyMark company={company} />
                    <p className="font-extrabold text-ink truncate flex-1">{company.name}</p>
                    <button type="button" onClick={() => setMenuOpen(true)}
                        aria-label="Abrir menú" aria-expanded={menuOpen}
                        className="btn-icon flex-shrink-0">
                        <Menu className="h-6 w-6" strokeWidth={2.4} />
                    </button>
                </div>
            </header>

            {/* Contenido: sangria horizontal identica a la cabecera y aire
                inferior suficiente para la barra movil + zona segura del dedo. */}
            <div className="md:pl-64">
                <main className="px-4 sm:px-6 pt-4 sm:py-8 pb-32 md:pb-14 max-w-7xl mx-auto">
                    <Outlet />
                </main>
            </div>

            <BottomNav />
            <MobileMenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
        </div>
    );
}
