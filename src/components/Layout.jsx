import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { SidebarNav, BottomNav, CompanyMark, MobileMenuDrawer } from "./AppNav";
import { useCompany } from "../hooks/useCompany";

/**
 * Shell de la aplicacion.
 *
 * Movil: el contenedor es fijo (`fixed inset-0`) y forma una columna de altura
 * completa: cabecera / area de contenido con scroll propio / barra inferior.
 * Como el documento antes del shell no puede desplazarse, las barras del
 * navegador (Chrome, Safari) nunca colapsan ni reaparecen al hacer scroll y
 * la barra inferior queda perfectamente quieta en todas las pantallas.
 *
 * Escritorio: igual que siempre, sidebar fija y scroll de documento.
 */
export default function Layout() {
    const company = useCompany();
    const [menuOpen, setMenuOpen] = useState(false);
    const location = useLocation();
    const scrollerRef = useRef(null);

    // Cada pantalla arranca desde arriba, igual en movil que en escritorio.
    useEffect(() => {
        scrollerRef.current?.scrollTo({ top: 0 });
        window.scrollTo({ top: 0 });
    }, [location.pathname]);

    return (
        <div className="bg-paper fixed inset-0 md:static md:min-h-screen flex flex-col md:block overflow-hidden md:overflow-visible">
            {/* Fondo con malla azulada: evita el lienzo plano y separa las tarjetas. */}
            <div className="pointer-events-none fixed inset-0 -z-10 bg-mesh-cool opacity-70" aria-hidden="true" />

            {/* Barra lateral de escritorio */}
            <aside className="hidden md:block fixed inset-y-0 left-0 w-64 z-30">
                <SidebarNav />
            </aside>

            {/* Cabecera movil: hijo fijo de la columna, nunca interviene en el scroll. */}
            <header className="md:hidden shrink-0 z-30 bg-white border-b border-line shadow-card">
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

            {/* Contenido: en movil, el unico scroll de la app (por eso, con la
                barra inferior en flujo, nada la desplaza). En escritorio solo se
                reserva el ancho de la sidebar; el scroll vuelve a ser el documento. */}
            <div ref={scrollerRef}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain md:h-auto md:flex-none md:overflow-visible md:pl-64">
                <main className="px-4 sm:px-6 pt-4 sm:py-8 pb-10 md:pb-14 max-w-7xl mx-auto">
                    <Outlet />
                </main>
            </div>

            {/* Barra inferior movil en flujo: estable por geometria, sin trucos. */}
            <BottomNav />
            <MobileMenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
        </div>
    );
}
