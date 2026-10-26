import { Outlet } from "react-router-dom";
import { SidebarNav, BottomNav, CompanyMark } from "./AppNav";
import { useCompany } from "../hooks/useCompany";

export default function Layout() {
    const company = useCompany();

    return (
        <div className="min-h-screen bg-paper">
            {/* Fondo con malla azulada: evita el lienzo plano y separa las tarjetas. */}
            <div className="pointer-events-none fixed inset-0 -z-10 bg-mesh-cool opacity-70" aria-hidden="true" />

            {/* Barra lateral de escritorio */}
            <aside className="hidden md:block fixed inset-y-0 left-0 w-64 z-30">
                <SidebarNav />
            </aside>

            {/* Cabecera movil con la misma identidad que el sidebar */}
            <header className="md:hidden sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-line">
                <div className="flex items-center gap-2.5 px-4 h-14">
                    <CompanyMark company={company} />
                    <p className="font-extrabold text-ink truncate">{company.name}</p>
                </div>
            </header>

            {/* Contenido: espacio inferior para la barra movil */}
            <div className="md:pl-64">
                <main className="px-4 sm:px-6 py-5 sm:py-8 pb-28 md:pb-12 max-w-7xl mx-auto">
                    <Outlet />
                </main>
            </div>

            <BottomNav />
        </div>
    );
}
