import { useState, useCallback } from "react";
import { X, CheckCircle2, AlertTriangle } from "lucide-react";
import { ToastContext } from "./toast-context";

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = "success") => {
        const id = Date.now() + Math.random();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    }, []);

    const removeToast = (id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            {/* aria-live: los lectores de pantalla anuncian el aviso sin robar el foco. */}
            <div className="fixed bottom-24 md:bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-[60] space-y-2 pointer-events-none"
                role="status" aria-live="polite">
                {toasts.map((toast) => {
                    const isError = toast.type === "error";
                    const Icon = isError ? AlertTriangle : CheckCircle2;
                    return (
                        <div
                            key={toast.id}
                            className={`pointer-events-auto flex items-start gap-3 p-3.5 pr-2.5 rounded-2xl shadow-pop
                                       border animate-toast-in sm:min-w-[320px] sm:max-w-sm
                                       ${isError ? "bg-rose-50 border-rose-200" : "bg-white border-line"}`}
                        >
                            <span className={`mt-0.5 h-8 w-8 flex-shrink-0 inline-flex items-center justify-center rounded-xl
                                ${isError ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                                <Icon className="h-4 w-4" strokeWidth={2.4} />
                            </span>
                            <span className={`flex-1 text-sm font-semibold leading-snug ${isError ? "text-rose-900" : "text-ink"}`}>
                                {toast.message}
                            </span>
                            <button
                                onClick={() => removeToast(toast.id)}
                                aria-label="Cerrar aviso"
                                className="p-1.5 rounded-lg text-ink-3 hover:bg-paper transition-colors flex-shrink-0"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
};
