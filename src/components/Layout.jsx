import { Outlet, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import { Menu, X } from "lucide-react";
import { useCompany } from "../context/CompanyContext";

export default function Layout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { companyInfo } = useCompany();
    const location = useLocation();

    // Close sidebar on route change (mobile)
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [location.pathname]);

    // Lock body scroll while the mobile drawer is open
    useEffect(() => {
        document.body.style.overflow = isSidebarOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [isSidebarOpen]);

    // Escape closes the drawer
    useEffect(() => {
        if (!isSidebarOpen) return;
        const onKeyDown = (e) => { if (e.key === "Escape") setIsSidebarOpen(false); };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isSidebarOpen]);

    return (
        <div className="flex h-screen h-[100dvh] bg-gradient-to-br from-slate-50 via-primary-50/30 to-accent-50/20 overflow-hidden">
            {/* Subtle dot pattern background */}
            <div 
                className="fixed inset-0 opacity-[0.015] pointer-events-none z-0"
                style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, #0ea5e9 1px, transparent 0)`,
                    backgroundSize: '24px 24px'
                }}
            ></div>
            
            {/* Mobile Header */}
            <div className="fixed top-0 left-0 right-0 z-40 md:hidden bg-white/80 backdrop-blur-xl border-b border-white/30 shadow-glass">
                <div className="flex items-center justify-between h-16 px-4">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 rounded-xl text-slate-600 hover:bg-primary-50 hover:text-primary-600 transition-all duration-300 focus:outline-none shadow-sm"
                        aria-label="Abrir menú"
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                    <h1 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-accent-600 truncate tracking-tight">
                        {companyInfo.name || "Sistema POS"}
                    </h1>
                    <div className="w-10" /> {/* Spacer for centering */}
                </div>
            </div>

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-50 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />

                    {/* Sidebar */}
                    <div
                        className="absolute left-0 top-0 h-full w-64 overflow-y-auto animate-slide-in-left"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setIsSidebarOpen(false)}
                            className="absolute top-3 right-3 z-50 p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/20 transition-all duration-300 backdrop-blur-md"
                            aria-label="Cerrar menú"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <Sidebar />
                    </div>
                </div>
            )}

            {/* Desktop Sidebar */}
            <div className="hidden md:flex md:flex-shrink-0 relative z-20">
                <Sidebar />
            </div>

            {/* Main Content */}
            <div className="flex flex-col flex-1 w-0 overflow-hidden relative z-10">
                <main className="flex-1 relative overflow-y-auto focus:outline-none pt-14 md:pt-0">
                    <div className="py-6 md:py-8">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
                            <Outlet />
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
