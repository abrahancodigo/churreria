// Paleta de acentos por pantalla.
//
// Vive aparte de `ui.jsx` porque ese archivo debe exportar solo componentes
// (regla react-refresh). Las clases son literales completos para que Tailwind
// las detecte al compilar: nada de plantillas dinámicas tipo `bg-${color}-500`.
export const ACCENTS = {
    brand: {
        soft: "bg-blue-50",
        softText: "text-blue-800",
        ring: "ring-blue-200",
        bar: "bg-blue-500",
        glow: "from-blue-500/20 to-transparent",
        chipActive: "bg-blue-700 text-white border-blue-700 hover:bg-blue-800",
    },
    entry: {
        soft: "bg-sky-50",
        softText: "text-sky-800",
        ring: "ring-sky-200",
        bar: "bg-sky-600",
        glow: "from-sky-500/20 to-transparent",
        chipActive: "bg-sky-700 text-white border-sky-700 hover:bg-sky-800",
    },
    exit: {
        soft: "bg-amber-50",
        softText: "text-amber-900",
        ring: "ring-amber-200",
        bar: "bg-amber-600",
        glow: "from-amber-500/20 to-transparent",
        chipActive: "bg-amber-700 text-white border-amber-700 hover:bg-amber-800",
    },
    emerald: {
        soft: "bg-emerald-50",
        softText: "text-emerald-800",
        ring: "ring-emerald-200",
        bar: "bg-emerald-700",
        glow: "from-emerald-600/20 to-transparent",
        chipActive: "bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800",
    },
    sky: {
        soft: "bg-sky-50",
        softText: "text-sky-800",
        ring: "ring-sky-200",
        bar: "bg-sky-600",
        glow: "from-sky-500/20 to-transparent",
        chipActive: "bg-sky-700 text-white border-sky-700 hover:bg-sky-800",
    },
    // Admin: indigo azul profundo, coherente con la paleta premium.
    plum: {
        soft: "bg-indigo-50",
        softText: "text-indigo-800",
        ring: "ring-indigo-200",
        bar: "bg-indigo-600",
        glow: "from-indigo-500/20 to-transparent",
        chipActive: "bg-indigo-700 text-white border-indigo-700 hover:bg-indigo-800",
    },
};

/** Devuelve el acento pedido o el de marca si el nombre no existe. */
export const accentOf = (name) => ACCENTS[name] || ACCENTS.brand;
