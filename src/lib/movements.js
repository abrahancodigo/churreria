// ---------------------------------------------------------------------------
// Catálogo de motivos de movimiento.
//
// Vive aparte de las páginas porque lo usan tres lugares que deben coincidir:
// el alta (StockAdjustment), la edición (Transactions) y los reportes
// (Reports). Si cada uno llevara su propia lista, un motivo escrito en el alta
// no aparecería como filtro en el reporte.
// ---------------------------------------------------------------------------

/** Motivos de entrada, en el orden en que se muestran. */
export const ENTRY_REASONS = [
    "Compra a proveedor",
    "Devolución de cliente",
    "Traspaso recibido",
    "Ajuste positivo",
    "Producción",
];

/** Motivos de salida, en el orden en que se muestran. */
export const EXIT_REASONS = [
    "Traspaso a sucursal",
    "Merma",
    "Consumo interno",
    "Ajuste negativo",
    "Devolución a proveedor",
];

/** Motivos válidos para un tipo. */
export const reasonsFor = (type) => (type === "entry" ? ENTRY_REASONS : EXIT_REASONS);

/** Etiqueta del campo de contraparte según el tipo. */
export const partyLabelFor = (type) => (type === "entry" ? "Proveedor" : "Destino");

/** Placeholder del campo de contraparte según el tipo. */
export const partyPlaceholderFor = (type) =>
    type === "entry" ? "Distribuidora La Espiga..." : "Sucursal Norte, cliente, uso interno...";

/**
 * Motivos que ya existen en los datos pero no están en el catálogo (registros
 * viejos o escritos a mano). Se ofrecen como opción extra para no perderlos al
 * editar.
 */
export const extraReasons = (transactions, type) => {
    const known = new Set(reasonsFor(type));
    const found = new Set();
    for (const tx of transactions || []) {
        if (tx.type !== type) continue;
        const reason = String(tx.reason || "").trim();
        if (reason && !known.has(reason)) found.add(reason);
    }
    return [...found].sort((a, b) => a.localeCompare(b));
};

/**
 * Sucursales conocidas: las que ya se registraron en movimientos anteriores,
 * más las que se hayan capturado dentro de las notas viejas ("Sucursal: X").
 * Sirve para poblar el select sin obligar a teclearlas otra vez.
 */
export const knownSucursales = (transactions, getSucursal) => {
    const found = new Set();
    for (const tx of transactions || []) {
        const value = tx.sucursal || (getSucursal ? getSucursal(tx) : "");
        const clean = String(value || "").trim();
        if (clean) found.add(clean);
    }
    return [...found].sort((a, b) => a.localeCompare(b));
};
