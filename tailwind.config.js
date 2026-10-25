/**
 * Churrería POS — Design tokens
 * "Azul Tinta": base de gris frío con acento azul profundo.
 *
 * TODOS los colores se resuelven mediante CSS variables definidas en
 * src/index.css (`:root` para claro, `:root.dark` para oscuro). Así el tema
 * cambia con una sola clase en <html> y ningún componente necesita `dark:`.
 *
 * Escalas (ink, primary, success, warning, danger):
 *   50-300  → tintes de superficie   (en oscuro se vuelven oscuros)
 *   400-600 → tonos sólidos constantes (usables como fondo con texto blanco)
 *   700-900 → texto sobre tintes     (en oscuro se aclaran)
 */
const v = (name) => `rgb(var(${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                primary: {
                    50: v("--primary-50"),
                    100: v("--primary-100"),
                    200: v("--primary-200"),
                    300: v("--primary-300"),
                    400: v("--primary-400"),
                    500: v("--primary-500"),
                    600: v("--primary-600"),
                    700: v("--primary-700"),
                    800: v("--primary-800"),
                    900: v("--primary-900"),
                },
                // Neutros cálidos. En oscuro la rampa se invierte:
                // ink-50 = fondo de página, ink-900 = texto principal.
                ink: {
                    50: v("--ink-50"),
                    100: v("--ink-100"),
                    200: v("--ink-200"),
                    300: v("--ink-300"),
                    400: v("--ink-400"),
                    500: v("--ink-500"),
                    600: v("--ink-600"),
                    700: v("--ink-700"),
                    800: v("--ink-800"),
                    900: v("--ink-900"),
                },
                success: {
                    50: v("--success-50"),
                    100: v("--success-100"),
                    200: v("--success-200"),
                    300: v("--success-300"),
                    400: v("--success-400"),
                    500: v("--success-500"),
                    600: v("--success-600"),
                    700: v("--success-700"),
                    800: v("--success-800"),
                    900: v("--success-900"),
                },
                warning: {
                    50: v("--warning-50"),
                    100: v("--warning-100"),
                    200: v("--warning-200"),
                    300: v("--warning-300"),
                    400: v("--warning-400"),
                    500: v("--warning-500"),
                    600: v("--warning-600"),
                    700: v("--warning-700"),
                    800: v("--warning-800"),
                    900: v("--warning-900"),
                },
                danger: {
                    50: v("--danger-50"),
                    100: v("--danger-100"),
                    200: v("--danger-200"),
                    300: v("--danger-300"),
                    400: v("--danger-400"),
                    500: v("--danger-500"),
                    600: v("--danger-600"),
                    700: v("--danger-700"),
                    800: v("--danger-800"),
                    900: v("--danger-900"),
                },
                // Semánticos: superficies con contraparte clara/oscuro.
                surface: v("--surface"),   // tarjetas, modales, tablas
                elevated: v("--elevated"), // campos de formulario dentro de tarjetas
                rail: v("--rail"),         // barra lateral
                scrim: v("--scrim"),       // velo de modales
            },
            fontFamily: {
                sans: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
            },
            boxShadow: {
                // Capas suaves con tinte cálido. En oscuro se declaran en CSS.
                'xs': 'var(--shadow-xs)',
                'card': 'var(--shadow-card)',
                'card-lg': 'var(--shadow-card-lg)',
                'panel': 'var(--shadow-panel)',
                'sidebar': 'var(--shadow-sidebar)',
                'focus': 'var(--shadow-focus)',
                'glow': 'var(--shadow-glow)',
                'inner-hairline': 'inset 0 1px 0 0 rgb(255 255 255 / 0.06)',
            },
            backgroundImage: {
                'brand-gradient': 'linear-gradient(145deg, #1e3a8a 0%, #2551eb 55%, #3b6df6 100%)',
                'brand-gradient-soft': 'linear-gradient(145deg, #2551eb 0%, #6090fa 100%)',
                'brand-gradient-ember': 'radial-gradient(120% 140% at 15% 0%, rgba(96, 144, 250, 0.22) 0%, rgba(37, 81, 235, 0) 60%), linear-gradient(145deg, #1e3a8a 0%, #2551eb 100%)',
                'surface-gradient': 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                'noise-subtle': 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0)',
            },
            animation: {
                'fade-in': 'fadeIn 0.18s ease-out',
                'slide-up': 'slideUp 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
                'slide-down': 'slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                'scale-in': 'scaleIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                'slide-in-left': 'slideInLeft 0.26s cubic-bezier(0.16, 1, 0.3, 1)',
                'slide-in-right': 'slideInRight 0.26s cubic-bezier(0.16, 1, 0.3, 1)',
                'shimmer': 'shimmer 1.6s linear infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px) scale(0.99)' },
                    '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
                },
                slideDown: {
                    '0%': { opacity: '0', transform: 'translateY(-8px) scale(0.99)' },
                    '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
                },
                slideInLeft: {
                    '0%': { opacity: '0', transform: 'translateX(-20px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
                slideInRight: {
                    '0%': { opacity: '0', transform: 'translateX(20px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
                scaleIn: {
                    '0%': { opacity: '0', transform: 'scale(0.97)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
            },
            borderRadius: {
                '4xl': '2rem',
                '5xl': '2.5rem',
            },
            transitionTimingFunction: {
                'premium': 'cubic-bezier(0.16, 1, 0.3, 1)',
            },
        },
    },
    plugins: [],
};
