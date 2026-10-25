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
                className="absolute inset-0 bg-scrim/60 animate-fade-in"
                onClick={() => !loading && onCancel?.()}
            />

            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                aria-describedby={message ? 'confirm-dialog-message' : undefined}
                className="relative w-full sm:max-w-md modal-panel p-5 pb-safe sm:pb-5 animate-slide-up sm:animate-scale-in"
            >
                <div className="flex items-start gap-3">
                    <div className={`shrink-0 h-10 w-10 rounded-lg flex items-center justify-center ${
                        danger ? 'bg-danger-50 text-danger-600' : 'bg-primary-50 text-primary-700'
                    }`}>
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 id="confirm-dialog-title" className="text-base font-semibold text-ink-900">
                            {title}
                        </h2>
                        {message && (
                            <p id="confirm-dialog-message" className="mt-1 text-sm text-ink-600 whitespace-pre-line">
                                {message}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={() => !loading && onCancel?.()}
                        className="touch-target -my-2 -mr-2 shrink-0 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors"
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
                        className="btn-secondary w-full sm:w-auto min-h-12"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={() => onConfirm?.()}
                        disabled={loading}
                        className={`w-full sm:w-auto min-h-12 ${danger ? 'btn-danger' : 'btn-primary'}`}
                    >
                        {loading ? 'Procesando...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
