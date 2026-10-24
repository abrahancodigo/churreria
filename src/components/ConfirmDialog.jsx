import { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

/**
 * Accessible replacement for window.confirm().
 *
 * Native confirm() blocks the JS thread, cannot be styled, shows a desktop
 * sheet on iOS (breaking the POS flow) and renders unlabelled "OK/Cancel".
 * This dialog keeps focus, supports Escape, and uses 48px touch targets.
 */
export default function ConfirmDialog({
    open,
    title = '¿Confirmar acción?',
    message,
    confirmLabel = 'Sí, continuar',
    cancelLabel = 'Cancelar',
    danger = true,
    loading = false,
    onConfirm,
    onCancel,
}) {
    const cancelRef = useRef(null);

    useEffect(() => {
        if (!open) return;

        // Focus the safe action first so an accidental "Enter" never destroys data.
        cancelRef.current?.focus();

        const onKeyDown = (e) => {
            if (e.key === 'Escape' && !loading) onCancel?.();
        };
        window.addEventListener('keydown', onKeyDown);

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [open, loading, onCancel]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
            role="presentation"
        >
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
                onClick={() => !loading && onCancel?.()}
            />

            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                aria-describedby={message ? 'confirm-dialog-message' : undefined}
                className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 pb-safe sm:pb-5 animate-slide-up sm:animate-scale-in"
            >
                <div className="flex items-start gap-3">
                    <div className={`shrink-0 h-11 w-11 rounded-full flex items-center justify-center ${danger ? 'bg-red-100 text-red-600' : 'bg-primary-100 text-primary-600'}`}>
                        <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 id="confirm-dialog-title" className="text-lg font-bold text-gray-900">
                            {title}
                        </h2>
                        {message && (
                            <p id="confirm-dialog-message" className="mt-1 text-sm text-gray-600 whitespace-pre-line">
                                {message}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={() => !loading && onCancel?.()}
                        className="touch-target -my-2 -mr-2 shrink-0 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                        aria-label="Cerrar"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                    <button
                        ref={cancelRef}
                        type="button"
                        onClick={() => onCancel?.()}
                        disabled={loading}
                        className="w-full sm:w-auto min-h-12 px-5 rounded-xl border border-gray-300 text-base font-semibold text-gray-700 bg-white hover:bg-gray-50 active:bg-gray-100 touch-manipulation disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={() => onConfirm?.()}
                        disabled={loading}
                        className={`w-full sm:w-auto min-h-12 px-5 rounded-xl text-base font-semibold text-white touch-manipulation disabled:opacity-50 ${danger
                            ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                            : 'bg-primary-600 hover:bg-primary-700 active:bg-primary-800'
                            }`}
                    >
                        {loading ? 'Procesando...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
