import { createContext, useContext, useState, useCallback } from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

const ToastContext = createContext();

// Provider + hook en el mismo archivo: patrón intencional (ver AuthContext).
// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);

// Colisiona si dos toasts caen en el mismo milisegundo: usa id único.
let counter = 0;
const nextId = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    counter += 1;
    return `toast-${Date.now()}-${counter}`;
};

const STYLES = {
    success: {
        Icon: CheckCircle,
        iconClass: "text-success-600",
        tintClass: "bg-success-50",
        barClass: "bg-success-500",
    },
    error: {
        Icon: AlertCircle,
        iconClass: "text-danger-600",
        tintClass: "bg-danger-50",
        barClass: "bg-danger-500",
    },
    info: {
        Icon: Info,
        iconClass: "text-primary-600",
        tintClass: "bg-primary-50",
        barClass: "bg-primary-500",
    },
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback((message, type = "success") => {
        const id = nextId();
        setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
        setTimeout(() => removeToast(id), 4000);
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div
                className="fixed z-[80] inset-x-4 bottom-safe sm:inset-x-auto sm:right-6 sm:bottom-6 space-y-2.5 pointer-events-none"
                role="region"
                aria-label="Notificaciones"
            >
                {toasts.map((toast) => {
                    const style = STYLES[toast.type] || STYLES.success;
                    const { Icon } = style;
                    return (
                        <div
                            key={toast.id}
                            role={toast.type === "error" ? "alert" : "status"}
                            aria-live={toast.type === "error" ? "assertive" : "polite"}
                            className="relative flex items-start gap-3 overflow-hidden pl-4 pr-3 py-3 rounded-2xl bg-surface border border-ink-200/80 shadow-card-lg animate-slide-up w-full sm:min-w-[320px] sm:max-w-md pointer-events-auto"
                        >
                            <span className={`absolute left-0 top-0 h-full w-1 ${style.barClass}`} aria-hidden="true" />
                            <div className={`shrink-0 h-8 w-8 rounded-lg flex items-center justify-center ${style.tintClass}`}>
                                <Icon className={`h-[18px] w-[18px] ${style.iconClass}`} />
                            </div>
                            <span className="text-sm text-ink-800 flex-1 break-words pt-1.5 leading-snug">
                                {toast.message}
                            </span>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="shrink-0 h-8 w-8 -my-0.5 -mr-1 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors"
                                aria-label="Cerrar notificación"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
};
