/**
 * Splash de carga con la marca.
 *
 * Misma estetica (y mismas clases .sp-*) que el splash embebido en
 * index.html: cuando React toma el control de #root, el splash de arranque
 * cede el paso a este componente sin "salto" visual mientras Firebase
 * verifica la sesion y se descargan los modulos.
 *
 * Las animaciones respetan `prefers-reduced-motion` (ver index.css).
 */
function ChurroLogo() {
    return (
        <svg className="sp-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <rect width="64" height="64" rx="18" fill="#BE4F2B" />
            <path d="M33.2 10.5c1.1 9.1-4.4 11.8-7.5 17.2-2.3 4-2.2 8.8.2 12.4 1-4 4.1-6.1 6.7-8.7.3 5.4 5.8 7.1 5.8 13.2 0 4.4-3 7.8-7.7 7.8-7.3 0-12.2-5.1-12.2-12.4 0-11.4 11.8-16 14.7-29.5Z" fill="#FFF8F0" />
            <path d="M42.5 25.4c.2 4.2-2.1 6.4-3.8 9.1 4 2.5 6.4 5.7 6.4 10.3 0 5.6-4.6 9.8-10.6 10.7 7.4-3.7 7.1-9.4 4.6-12.8-1.8-2.5-4.3-3.5-4.5-7.2 3-2.5 6.8-4.7 7.9-10.1Z" fill="#F2B078" />
        </svg>
    );
}

export default function Splash({ label = "Preparando tu almacén…" }) {
    return (
        <div className="sp-screen" role="status" aria-live="polite">
            <div className="sp-card">
                <ChurroLogo />
            </div>
            <div className="sp-track"><div className="sp-fill" /></div>
            <p className="sp-text">{label}</p>
        </div>
    );
}
