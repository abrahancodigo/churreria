import { createContext, useContext, useEffect, useState, useCallback } from "react";

/**
 * Tema claro/oscuro.
 *
 * - Se aplica como clase `dark` en <html>, que es lo que leen las variables
 *   de src/index.css y la estrategia `darkMode: 'class'` de Tailwind.
 * - La elección del usuario se guarda en localStorage; si no existe se usa
 *   la preferencia del sistema operativo.
 * - Un script inline en index.html aplica la clase antes del primer pintado
 *   para evitar el destello blanco al cargar en modo oscuro.
 */

const STORAGE_KEY = "churreria-theme";
const ThemeContext = createContext(null);

const getSystemTheme = () =>
    typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

const readStoredTheme = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === "dark" || stored === "light" ? stored : null;
    } catch {
        return null;
    }
};

const applyTheme = (theme) => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0d1117" : "#f8fafc");
};

export const ThemeProvider = ({ children }) => {
    const [theme, setThemeState] = useState(() => readStoredTheme() || getSystemTheme());

    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    // Sigue los cambios del sistema mientras el usuario no haya elegido a mano.
    useEffect(() => {
        const media = window.matchMedia?.("(prefers-color-scheme: dark)");
        if (!media) return;

        const onChange = (e) => {
            if (!readStoredTheme()) setThemeState(e.matches ? "dark" : "light");
        };
        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
    }, []);

    const setTheme = useCallback((next) => {
        setThemeState(next === "dark" ? "dark" : "light");
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            /* modo privado: el tema solo dura la sesión */
        }
    }, []);

    const toggleTheme = useCallback(() => {
        setThemeState((current) => {
            const next = current === "dark" ? "light" : "dark";
            try {
                localStorage.setItem(STORAGE_KEY, next);
            } catch {
                /* sin persistencia */
            }
            return next;
        });
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

// Provider + hook en el mismo archivo: patrón intencional (ver AuthContext).
// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
    return ctx;
};
