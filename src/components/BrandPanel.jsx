/**
 * Panel de marca para las pantallas de acceso.
 * El churro se dibuja con CSS puro: sin imágenes externas ni peticiones extra.
 */
export function BrandPanel({ title, subtitle, points = [] }) {
    return (
        <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-ink-fade px-12 py-14 text-white">
            {/* Halos de luz azules sobre el marino profundo */}
            <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent" aria-hidden="true" />

            <div className="relative">
                <div className="flex items-center gap-3">
                    <ChurroMark />
                    <div>
                        <p className="font-extrabold tracking-tight leading-tight text-white">Churrería</p>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-100">Sistema de almacén</p>
                    </div>
                </div>

                <h2 className="mt-14 text-4xl font-extrabold leading-[1.1] tracking-tight text-balance">
                    {title}
                </h2>
                <p className="mt-3 text-base text-white max-w-sm">{subtitle}</p>

                <ul className="mt-10 space-y-3.5">
                    {points.map(({ icon: Icon, text }) => (
                        <li key={text} className="flex items-center gap-3 text-sm font-semibold text-white/85">
                            <span className="h-9 w-9 rounded-xl bg-white/10 ring-1 ring-white/15 flex items-center justify-center flex-shrink-0">
                                {Icon ? <Icon className="h-4 w-4 text-brand-200" strokeWidth={2.4} /> : null}
                            </span>
                            {text}
                        </li>
                    ))}
                </ul>
            </div>

            <p className="relative text-xs font-semibold text-white/75">
                © {new Date().getFullYear()} · Control de inventario y movimientos
            </p>
        </aside>
    );
}

/** Churro estilizado hecho con CSS (aro de azúcar + cuerpo trenzado). */
function ChurroMark() {
    return (
        <span className="relative h-11 w-11 rounded-2xl bg-brand-500 flex items-center justify-center overflow-hidden flex-shrink-0">
            <span
                className="absolute h-7 w-7 rounded-full border-[5px] border-white/95"
                style={{ transform: "rotate(-18deg) skewX(-6deg)" }}
                aria-hidden="true"
            />
            <span className="absolute h-7 w-7 rounded-full border-[2px] border-dashed border-ink/25"
                style={{ transform: "rotate(-18deg) skewX(-6deg)" }} aria-hidden="true" />
        </span>
    );
}
