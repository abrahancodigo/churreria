/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            // --- Marca: azul eléctrico sobre blanco frio ------------------------
            // Look ejecutivo vivo: azur saturado sobre superficies blancas con
            // profundidad 3D. `brand.600` (#2065ff) es el azur mas brillante que
            // pasa AA con texto blanco (4.80:1): a partir de ahi se construyen
            // botones y acentos. `brand.700` (#1750cc) llega a 6.87:1 y se usa
            // en hovers. `brand.400/500` son solo acento decorativo, nunca
            // llevan texto blanco encima.
            colors: {
                brand: {
                    50: "#eef4ff",
                    100: "#d9e6ff",
                    200: "#bad4ff",
                    300: "#8bb8ff",
                    400: "#5293ff",
                    500: "#2b7fff",
                    600: "#2065ff",
                    700: "#1750cc",
                    800: "#123a99",
                    900: "#0e2b73",
                    950: "#091b47",
                },
                // Neutros frios: con lienzo blanco-azulado, un gris calido se ve
                // sucio. Todos pasan AA sobre `paper` con holgura.
                ink: {
                    DEFAULT: "#0f172a",
                    2: "#334155",
                    3: "#475569",
                },
                paper: {
                    DEFAULT: "#f6f8fc",
                    deep: "#e9eef7",
                },
                line: {
                    DEFAULT: "#dfe6f2",
                    strong: "#c3cee0",
                },
            },
            fontFamily: {
                sans: ["'Plus Jakarta Sans'", "system-ui", "-apple-system", "sans-serif"],
            },
            // --- Profundidad 3D -------------------------------------------------
            // Sombras multicapa: contacto cercano + penumbra media + halo largo,
            // teñidas de azul marino (rgba Navy 15,23,42) para que la luz parezca
            // coherente. Calor de color = resta profundidad.
            boxShadow: {
                card: "0 1px 2px rgba(15,23,42,0.05), 0 3px 8px -1px rgba(15,23,42,0.07), 0 1px 0 rgba(255,255,255,0.6) inset",
                "card-hover": "0 2px 4px rgba(15,23,42,0.06), 0 10px 24px -4px rgba(15,23,42,0.14), 0 1px 0 rgba(255,255,255,0.6) inset",
                raised: "0 1px 3px rgba(15,23,42,0.08), 0 6px 16px -3px rgba(15,23,42,0.14), 0 12px 28px -10px rgba(15,23,42,0.12)",
                pop: "0 24px 56px -12px rgba(15,23,42,0.35), 0 10px 22px -10px rgba(15,23,42,0.20), 0 1px 0 rgba(255,255,255,0.35) inset",
                glow: "0 0 0 1px rgba(37,99,235,0.35), 0 10px 26px -8px rgba(29,78,216,0.55)",
            },
            backgroundImage: {
                "mesh-cool":
                    "radial-gradient(1100px 560px at 8% -12%, #d9e6ff 0%, transparent 55%), radial-gradient(900px 480px at 100% 0%, #e4e6ff 0%, transparent 52%), radial-gradient(850px 620px at 50% 115%, #d9e6ff 0%, transparent 55%)",
            // AZUL REY: saturado, real y rey. Tope #2b53e0 (electrico) con
            // base #1c3aa0 (rey profundo); mantiene AA con el menu translucido.
            "ink-fade": "linear-gradient(180deg, #2b53e0 0%, #1c3aa0 100%)",
            },
            animation: {
                // `both` mantiene el estado final: sin esto, el navegador puede
                // repintar el elemento en su posicion base al terminar.
                'fade-in': 'fadeIn 0.2s ease-out both',
                'slide-up': 'slideUp 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
                'scale-in': 'scaleIn 0.18s cubic-bezier(0.22, 1, 0.36, 1) both',
                'slide-in-right': 'slideInRight 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
                'toast-in': 'toastIn 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
                'pop-badge': 'popBadge 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(24px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                scaleIn: {
                    '0%': { opacity: '0', transform: 'scale(0.97)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                slideInRight: {
                    '0%': { opacity: '0', transform: 'translateX(24px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
                toastIn: {
                    '0%': { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
                    '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
                },
                popBadge: {
                    '0%': { transform: 'scale(0.8)' },
                    '60%': { transform: 'scale(1.08)' },
                    '100%': { transform: 'scale(1)' },
                },
            },
        },
    },
    plugins: [],
}
