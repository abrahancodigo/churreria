import { useEffect, useState } from "react";

/**
 * Barra de progreso para cargas con duración indeterminada.
 *
 * No existe forma de preguntar a Firestore "¿cuánto falta?", así que la barra
 * avanza rápido al principio y se frena al acercarse a `slowAt` mientras
 * espera la respuesta real. Cuando la carga termina, `isLoading` pasa a false
 * y la barra se completa al 100 %, se muestra "Listo" y se desvanece.
 *
 * Nota de implementación: ningún setState se ejecuta de forma síncrona dentro
 * del cuerpo de un efecto. El avance se actualiza desde el callback del
 * intervalo y el estado de salida desde un temporizador, de modo que React no
 * encadena renders.
 *
 * @param {boolean} isLoading  Carga en curso.
 * @param {string}  label      Texto que acompaña al porcentaje.
 * @param {number}  [slowAt]   Porcentaje donde el avance se ralentiza (85).
 * @param {number}  [duration] Milisegundos para esconderse tras terminar (650).
 */
export default function LoadingProgress({ isLoading, label = "Cargando…", slowAt = 85, duration = 650 }) {
    // Progreso simulado. Se reinicia cuando arranca una carga nueva.
    const [progress, setProgress] = useState(0);
    // true solo durante la animación de salida, después de terminar la carga.
    const [fadingOut, setFadingOut] = useState(false);

    // Avance simulado mientras se carga. Se detiene a `slowAt` para no mentir
    // con un 100 % antes de que los datos lleguen de verdad.
    useEffect(() => {
        if (!isLoading) return undefined;

        const startedAt = Date.now();
        const step = () => {
            const elapsed = Date.now() - startedAt;
            // Curva asintótica: rápido al inicio, se aproxima a `slowAt` sin tocarlo.
            const next = slowAt * (1 - Math.exp(-elapsed / 450));
            setProgress(prev => Math.max(prev, next));
        };

        // El primer avance ocurre en el siguiente tick, no en el cuerpo del efecto.
        const timer = setInterval(step, 80);
        return () => clearInterval(timer);
    }, [isLoading, slowAt]);

    // Al terminar: saltar a 100 %, esperar un instante y ocultar.
    // Todo el estado se actualiza desde callbacks asíncronos.
    useEffect(() => {
        if (isLoading) return undefined;

        const complete = setTimeout(() => setProgress(100), 0);
        const hide = setTimeout(() => setFadingOut(true), duration);

        return () => {
            clearTimeout(complete);
            clearTimeout(hide);
        };
    }, [isLoading, duration]);

    // Al empezar una carga nueva se vuelve a mostrar y el progreso arranca de cero.
    useEffect(() => {
        if (!isLoading) return undefined;
        const reset = setTimeout(() => {
            setFadingOut(false);
            setProgress(0);
        }, 0);
        return () => clearTimeout(reset);
    }, [isLoading]);

    const visible = isLoading || !fadingOut;
    if (!visible) return null;

    const percent = Math.min(100, Math.round(progress));
    const done = !isLoading;

    return (
        <div
            className={`loading-progress ${done ? "loading-progress-done" : ""}`}
            role="status"
            aria-live="polite"
            aria-label={done ? "Carga completa" : label}
        >
            <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-2 font-medium text-ink-600">
                    {!done && (
                        <span className="h-3 w-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    )}
                    {done ? "Listo" : label}
                </span>
                <span className="font-semibold tabular-nums text-ink-500">{percent} %</span>
            </div>
            <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
            >
                <div
                    className="h-full rounded-full bg-brand-gradient-soft transition-[width] duration-200 ease-out"
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
    );
}
