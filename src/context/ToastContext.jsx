import { createContext, useContext, useState, useCallback } from "react";
import { X, CheckCircle, AlertCircle } from "lucide-react";

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = "success") => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }, []);

    const removeToast = (id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="fixed z-[60] inset-x-4 bottom-safe sm:inset-x-auto sm:right-6 sm:bottom-6 space-y-3 pointer-events-none">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        role="status"
                        aria-live="polite"
                        className={`flex items-center gap-3 p-4 rounded-2xl shadow-glass-lg backdrop-blur-xl 
                                  border border-white/30 animate-slide-up w-full sm:min-w-[320px] sm:max-w-md
                                  pointer-events-auto
                                  ${toast.type === "error" 
                                      ? "bg-danger-500/95 text-white" 
                                      : "bg-success-500/95 text-white"
                                  }`}
                    >
                        {toast.type === "success" ? (
                            <CheckCircle className="h-5 w-5 flex-shrink-0" />
                        ) : (
                            <AlertCircle className="h-5 w-5 flex-shrink-0" />
                        )}
                        <span className="font-medium flex-1 break-words">{toast.message}</span>
                        <button 
                            onClick={() => removeToast(toast.id)} 
                            className="touch-target -my-2 -mr-2 rounded-lg hover:bg-white/20 transition-colors flex-shrink-0"
                            aria-label="Cerrar notificación"
                        >
                            <X size={18} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
