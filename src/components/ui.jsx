import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
    ArrowDownLeft,
    ArrowUpRight,
    TrendingDown,
    TrendingUp,
} from "lucide-react";
import { typeLabel } from "./TypeBadge";
import { accentOf } from "./accents";

// ---------------------------------------------------------------------------
// Piezas compartidas de la interfaz.
//
// Todo lo visual que repiten las pantallas vive aqui: asi un cambio de tono o de
// altura tactil se hace una vez. La paleta por pantalla esta en `accents.js`.
// Este archivo exporta SOLO componentes (regla react-refresh).
// ---------------------------------------------------------------------------

/**
 * Encabezado de pantalla: icono en capsula, título grande y un "glow" de marca
 * que da profundidad. `accent` cambia el tono según la sección.
 */
export function PageHeader({ title, sub, icon: Icon, accent = "brand", action }) {
    const a = accentOf(accent);
    return (
        <header className="relative mb-5 sm:mb-6">
            {/* Halo recortado en su propio contenedor: `blur` no respeta el
                overflow del padre, así que el clip va en el envoltorio. */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <div className={`absolute -top-6 -left-6 h-32 w-64 rounded-full bg-gradient-to-r ${a.glow} blur-2xl`} />
            </div>
            <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    {Icon && (
                        <span className={`hidden sm:inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${a.soft} ${a.softText} ring-1 ${a.ring}`}>
                            <Icon className="h-5 w-5" strokeWidth={2.2} />
                        </span>
                    )}
                    <div className="min-w-0">
                        <h1 className="page-title truncate">{title}</h1>
                        {sub && <p className="page-sub truncate">{sub}</p>}
                    </div>
                </div>
                {action && <div className="flex-shrink-0">{action}</div>}
            </div>
        </header>
    );
}

/**
 * Tarjeta de métrica. `accent` pinta la banda superior; `tone` decide el color
 * del valor (uso: verde para lo que suma, ámbar para lo que sale).
 */
export function StatCard({
    label,
    value,
    hint,
    icon: Icon,
    accent = "brand",
    valueTone = "text-ink",
    href,
}) {
    const a = accentOf(accent);
    const Wrapper = href || "div";
    const props = href ? { to: href } : {};
    return (
        <Wrapper {...props} className={`kpi group ${href ? "block" : ""}`}>
            <div className="flex items-center justify-between gap-2">
                <p className="eyebrow">{label}</p>
                {Icon && (
                    <span className={`kpi-icon ${a.soft} ${a.softText}`}>
                        <Icon className="h-4 w-4" strokeWidth={2.2} />
                    </span>
                )}
            </div>
            <p className={`kpi-value mt-3 ${valueTone}`}>{value}</p>
            {hint && <p className="mt-1.5 text-xs font-semibold text-ink-3">{hint}</p>}
            {/* Barra de acento: a toda anchura, al ras de la tarjeta. */}
            <span className={`absolute inset-x-0 top-0 h-1 ${a.bar}`} aria-hidden="true" />
        </Wrapper>
    );
}

export function EmptyState({ icon: Icon, title, hint, action, accent = "brand" }) {
    const a = accentOf(accent);
    return (
        <div className="flex flex-col items-center text-center rounded-2xl border border-dashed border-line-strong bg-white/60 px-6 py-10">
            {Icon && (
                <div className={`w-14 h-14 rounded-2xl ${a.soft} ${a.softText} flex items-center justify-center mb-3`}>
                    <Icon className="h-7 w-7" strokeWidth={1.8} />
                </div>
            )}
            <p className="font-extrabold text-ink">{title}</p>
            {hint && <p className="text-sm text-ink-3 mt-1 max-w-xs">{hint}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

export function ListSkeleton({ rows = 5 }) {
    return (
        <div className="card space-y-3">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                    <div className="skeleton w-10 h-10 !rounded-xl flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="skeleton h-3.5 w-2/3" />
                        <div className="skeleton h-3 w-1/3" />
                    </div>
                    <div className="skeleton h-6 w-14 !rounded-full" />
                </div>
            ))}
        </div>
    );
}

/** Insignia del tipo de movimiento con icono: entrada (abajo), salida (arriba). */
export function TypeBadge({ type }) {
    if (type === "sale") {
        return <span className="badge-sale">Venta</span>;
    }
    const isEntry = type === "entry";
    const Icon = isEntry ? ArrowDownLeft : ArrowUpRight;
    return (
        <span className={`${isEntry ? "badge-entry" : "badge-exit"} gap-1.5`}>
            <Icon className="h-3.5 w-3.5" strokeWidth={2.6} />
            {typeLabel(type)}
        </span>
    );
}

/** Insignia de variación para KPIs: verde cuando sube, rojo cuando baja. */
export function TrendPill({ value }) {
    const up = value >= 0;
    const Icon = up ? TrendingUp : TrendingDown;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold
            ${up ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
            <Icon className="h-3 w-3" strokeWidth={2.8} />
            {up ? "+" : ""}{value}%
        </span>
    );
}

/** Botón de icono accesible, con área táctil de 40px. */
export function IconButton({ label, icon: Icon, tone = "neutral", className = "", ...props }) {
    const tones = {
        neutral: "text-ink-3 hover:bg-paper hover:text-ink",
        brand: "text-brand-700 hover:bg-brand-50",
        danger: "text-rose-600 hover:bg-rose-50",
    };
    return (
        <button type="button" aria-label={label} title={label}
            className={`btn-icon ${tones[tone] || tones.neutral} ${className}`} {...props}>
            <Icon className="h-5 w-5" />
        </button>
    );
}

/**
 * Control segmentado accesible (role=tablist). Reemplaza a mano alzada los
 * botones con `bg-sky-600` repartidos por las páginas.
 */
export function Segmented({ options, value, onChange, accent = "brand", className = "" }) {
    const a = accentOf(accent);
    return (
        <div role="tablist" className={`inline-flex w-full sm:w-auto gap-1 rounded-2xl border border-line bg-white p-1 shadow-card ${className}`}>
            {options.map((opt) => {
                const active = opt.value === value;
                return (
                    <button
                        key={opt.value}
                        role="tab"
                        aria-selected={active}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl px-4 min-h-[44px] text-sm font-bold whitespace-nowrap transition-all
                            ${active ? `${a.chipActive} shadow-sm` : "text-ink-2 hover:bg-paper"}`}
                    >
                        {opt.icon && <opt.icon className="h-4 w-4" strokeWidth={2.4} />}
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}

/** Chip de selección (motivos de movimiento, filtros rápidos). */
export function Chip({ active, accent = "brand", className = "", ...props }) {
    const a = accentOf(accent);
    return (
        <button
            type="button"
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 min-h-[44px] text-xs font-bold transition-all active:scale-[0.98]
                ${active
                    ? `${a.chipActive} shadow-sm`
                    : "bg-white text-ink-2 border-line-strong hover:border-ink-3/50 hover:bg-paper"}
                ${className}`}
            {...props}
        />
    );
}

const CloseGlyph = () => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M18 6 6 18M6 6l12 12" />
    </svg>
);

/**
 * Capa flotante montada en `<body>` mediante portal.
 *
 * Se usa portal a proposito: si el modal se renderizara dentro del arbol de la
 * pagina quedaria dentro de contenedores con `transform` o `overflow-hidden`
 * (animaciones, tablas, `md:pl-64`...), que crean su propio contexto de
 * apilamiento y pueden dejar el panel DETRAS del fondo oscuro. En `<body>` el
 * z-index compite solo con la barra lateral y la navegacion, y siempre gana.
 *
 * Tambien cierra con `Escape`, bloquea el scroll de fondo mientras esta abierto
 * y devuelve el foco al elemento que lo abrio.
 */
function ModalLayer({ open, onClose, zClass = "z-50", children }) {
    const closingRef = useRef(onClose);

    // Mantiene la referencia al cierre sin volver a suscribir el listener en
    // cada render del padre (y sin escribir el ref durante el render).
    useEffect(() => {
        closingRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!open) return;
        const previous = document.activeElement;
        const onKey = (e) => { if (e.key === "Escape") closingRef.current?.(); };
        document.addEventListener("keydown", onKey);

        // Bloquea el desplazamiento del fondo sin saltar al inicio de la pagina.
        const { body } = document;
        const prevOverflow = body.style.overflow;
        const prevPadding = body.style.paddingRight;
        const gap = window.innerWidth - document.documentElement.clientWidth;
        body.style.overflow = "hidden";
        if (gap > 0) body.style.paddingRight = `${gap}px`;

        return () => {
            document.removeEventListener("keydown", onKey);
            body.style.overflow = prevOverflow;
            body.style.paddingRight = prevPadding;
            if (previous instanceof HTMLElement) previous.focus({ preventScroll: true });
        };
    }, [open]);

    if (!open) return null;
    return createPortal(
        <div className={`fixed inset-0 ${zClass} flex items-end sm:items-center justify-center sm:p-4 isolate`}
            role="dialog" aria-modal="true">
            {children}
        </div>,
        document.body
    );
}

export function Sheet({ open, onClose, title, children, wide, accent = "brand" }) {
    const a = accentOf(accent);
    return (
        <ModalLayer open={open} onClose={onClose}>
            <div className="absolute inset-0 z-0 bg-ink/60 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden="true" />
            <div className={`modal relative z-10 ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} w-full`}>
                <div className="drag-handle"><span /></div>
                <div className="sticky top-0 bg-white/95 backdrop-blur px-4 sm:px-6 py-3.5 border-b border-line flex items-center justify-between z-10 rounded-t-3xl sm:rounded-t-2xl">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`h-8 w-1.5 rounded-full ${a.bar} flex-shrink-0`} aria-hidden="true" />
                        <h2 className="font-extrabold text-ink truncate">{title}</h2>
                    </div>
                    <button onClick={onClose} aria-label="Cerrar" className="btn-icon flex-shrink-0">
                        <CloseGlyph />
                    </button>
                </div>
                <div className="p-4 sm:p-6">{children}</div>
            </div>
        </ModalLayer>
    );
}

export function PrintModal({ open, onClose, title, children }) {
    return (
        <ModalLayer open={open} onClose={onClose} zClass="z-[60]">
            <div className="absolute inset-0 z-0 bg-ink/70 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden="true" />
            <div className="relative z-10 bg-white w-full max-w-lg rounded-2xl shadow-pop max-h-[92vh] max-h-[92dvh] animate-scale-in flex flex-col">
                <div className="sticky top-0 bg-white px-4 sm:px-6 py-3.5 border-b border-line flex items-center justify-between z-10 rounded-t-2xl">
                    <h2 className="font-extrabold text-ink truncate pr-2">{title}</h2>
                    <button onClick={onClose} aria-label="Cerrar" className="btn-icon flex-shrink-0">
                        <CloseGlyph />
                    </button>
                </div>
                <div className="p-4 sm:p-6 flex-1 overflow-y-auto">{children}</div>
            </div>
        </ModalLayer>
    );
}
