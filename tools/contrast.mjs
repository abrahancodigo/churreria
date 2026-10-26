// Auditor de contraste WCAG 2.1 (herramienta de verificación, no parte de la app).
// Comprueba los pares texto/fondo que usa la interfaz y falla si alguno no llega
// al mínimo AA: 4.5:1 para texto normal y 3:1 para texto grande / iconos.
//
// Uso: node tools/contrast.mjs
const hexToRgb = (hex) => {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
};

const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

export const luminance = (hex) => {
    const [r, g, b] = hexToRgb(hex).map(linear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Relación de contraste entre dos colores (1 a 21). */
export const contrast = (fg, bg) => {
    const a = luminance(fg);
    const b = luminance(bg);
    const [light, dark] = a > b ? [a, b] : [b, a];
    return (light + 0.05) / (dark + 0.05);
};

// Paleta de la app (tokens de src/index.css y tailwind.config.js).
const T = {
    brand50: "#eef4ff", brand100: "#d9e6ff", brand500: "#2b7fff", brand600: "#2065ff",
    brand700: "#1750cc", brand800: "#123a99",
    ink: "#0f172a", ink2: "#334155", ink3: "#475569",
    paper: "#f6f8fc", white: "#ffffff", line: "#dfe6f2",
    emerald600: "#059669", emerald700: "#047857", emerald50: "#ecfdf5", emerald100: "#d1fae5", emerald200: "#a7f3d0",
    amber600: "#d97706", amber700: "#b45309", amber800: "#92400e", amber100: "#fef3c7", amber200: "#fde68a", amber50: "#fffbeb",
    rose600: "#e11d48", rose700: "#be123c", rose50: "#fff1f2", rose100: "#ffe4e6",
    sky600: "#0284c7", sky700: "#0369a1", sky50: "#f0f9ff", sky100: "#e0f2fe",
    indigo600: "#4f46e5", indigo700: "#4338ca", indigo100: "#e0e7ff",
    brand50: "#eef4ff", brand100: "#d9e6ff", brand200: "#bad4ff", brand300: "#8bb8ff", brand900: "#0e2b73",
    navy: "#0f172a", slate50: "#f8fafc",
};

// [nombre, frente, fondo, mínimo exigido]
const PAIRS = [
    ["texto base sobre papel", T.ink, T.paper, 4.5],
    ["texto 2º sobre papel", T.ink2, T.paper, 4.5],
    ["texto 3º sobre papel", T.ink3, T.paper, 4.5],
    ["texto base sobre tarjeta", T.ink, T.white, 4.5],
    ["texto 2º sobre tarjeta", T.ink2, T.white, 4.5],
    ["texto 3º sobre tarjeta", T.ink3, T.white, 4.5],
    ["blanco sobre botón marca (degradé 600)", T.white, T.brand600, 4.5],
    ["blanco sobre marca 500 (icono/logo/nav chip)", T.white, T.brand500, 3],
    ["blanco sobre marca 400 toldos decorativos", T.white, "#5293ff", 3],
    ["blanco sobre marca 700 (hover)", T.white, T.brand700, 4.5],
    ["marca 800 sobre marca 50", T.brand800, T.brand50, 4.5],
    ["blanco sobre marca 700 (botón sólido)", T.white, T.brand700, 4.5],
    ["blanco sobre esmeralda 700 (chip entrada)", T.white, T.emerald700, 4.5],
    ["blanco sobre ámbar 800 (salida)", T.white, T.amber800, 4.5],
    ["blanco sobre cielo 700 (chip activo)", T.white, T.sky700, 4.5],
    ["blanco sobre tarjeta oscura (marino)", T.white, T.ink, 4.5],
    ["marca 300 sobre tarjeta oscura", "#8bb8ff", T.ink, 4.5],
    ["blanco/75 sobre tarjeta oscura (etiqueta)", "#c4d0e6", T.ink, 4.5],
    ["marca 800 sobre blanco", T.brand800, T.white, 4.5],
    ["marca 600 sobre blanco (grande/icono)", T.brand600, T.white, 3],
    ["blanco sobre esmeralda 800 (éxito hover)", T.white, "#065f46", 4.5],
    ["blanco sobre ámbar 700 ( botón salída)", T.white, T.amber700, 4.5],
    ["azul 900 sobre azul 100 (badge entrada)", T.brand900, T.brand100, 4.5],
    ["azul 900 sobre azul 200", T.brand900, T.brand200, 4.5],
    ["éxito 900 sobre éxito 200 (badge venta)", "#064e3b", T.emerald200, 4.5],
    ["ámbar 900 sobre ámbar 200 (badge salída)", "#78350f", T.amber200, 4.5],
    ["blanco sobre peligro", T.white, T.rose600, 4.5],
    ["peligro 700 sobre peligro 50", T.rose700, T.rose50, 4.5],
    ["peligro 700 sobre peligro 100", T.rose700, T.rose100, 4.5],
    ["ámbar 900 sobre ámbar 100", "#78350f", T.amber100, 4.5],
    ["ámbar 800 sobre ámbar 50", T.amber800, T.amber50, 4.5],
    ["ámbar 800 sobre blanco", T.amber800, T.white, 4.5],
    ["cielo 800 sobre cielo 50", "#075985", T.sky50, 4.5],
    ["cielo 800 sobre cielo 100", "#075985", T.sky100, 4.5],
    ["indigo 900 sobre indigo 100 (badge admin)", "#312e81", T.indigo100, 4.5],
    ["indigo 700 sobre blanco (icono admin)", T.indigo700, T.white, 3],
    ["blanco sobre bandas marinas de contenido", T.white, T.ink, 4.5],
    ["blanco sobre sidebar (azul rey)", T.white, "#2b53e0", 4.5],
    ["blanco/85 sobre sidebar (item/menu/grupo)", "#dfe5fa", "#2b53e0", 4.5],
    ["blanco/75 sobre pie del sidebar", "#c4d6e8", "#1c3aa0", 4.5],
    ["blanco/70 sobre sidebar (icono inactivo)", "#bfcfff", "#2b53e0", 3],
    ["brand-100 sobre sidebar (rol/etiqueta)", "#d9e6ff", "#2b53e0", 4.5],
    ["brand-300 sobre sidebar (icono activo)", "#8bb8ff", "#2b53e0", 3],
    ["blanco sobre item activo (sidebar)", T.white, "#4467f2", 4.5],
    ["slate50 sobre ink (menú sobre oscuro)", T.slate50, T.ink, 4.5],
];

let failed = 0;
const rows = PAIRS.map(([name, fg, bg, min]) => {
    const ratio = contrast(fg, bg);
    const ok = ratio >= min;
    if (!ok) failed += 1;
    return { name, fg, bg, min, ratio: ratio.toFixed(2), ok };
});

const width = Math.max(...rows.map((r) => r.name.length));
for (const r of rows) {
    console.log(
        `${r.ok ? "OK  " : "FALLA"} ${r.name.padEnd(width)}  ${r.ratio.padStart(5)}:1  (mín ${r.min})  ${r.fg} / ${r.bg}`
    );
}
console.log(`\n${rows.length - failed}/${rows.length} pares cumplen el mínimo AA.`);
process.exit(failed === 0 ? 0 : 1);
