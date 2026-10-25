import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNavigate, Link } from "react-router-dom";
import { Lock, Mail, User, ArrowRight, Flame, AlertCircle, Sun, Moon } from "lucide-react";

export default function Register() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            return setError("Las contraseñas no coinciden.");
        }
        if (password.length < 6) {
            return setError("La contraseña debe tener al menos 6 caracteres.");
        }
        setError("");
        setLoading(true);
        try {
            await register(email, password, name);
            navigate("/");
        } catch (err) {
            console.error(err);
            if (err.code === 'auth/email-already-in-use') {
                setError("Este correo ya está registrado.");
            } else if (err.code === 'auth/weak-password') {
                setError("La contraseña debe tener al menos 6 caracteres.");
            } else {
                setError("Error al registrarse: " + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-dvh lg:grid lg:grid-cols-[1.1fr_1fr] bg-ink-50">
            {/* Brand panel */}
            <div className="hidden lg:flex flex-col justify-between bg-primary-50 p-12 relative overflow-hidden border-r border-primary-100">
                <div
                    aria-hidden="true"
                    className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full opacity-70 blur-3xl"
                    style={{ background: "radial-gradient(circle, rgb(96 144 250 / 0.25) 0%, transparent 70%)" }}
                />
                <div
                    className="absolute inset-0 opacity-[0.07] pointer-events-none"
                    style={{
                        backgroundImage: "radial-gradient(circle at 1px 1px, rgb(37 81 235 / 0.24) 1px, transparent 0)",
                        backgroundSize: "30px 30px"
                    }}
                />
                <div className="relative flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary-600 flex items-center justify-center shadow-card">
                        <Flame className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-ink-900 font-semibold tracking-tight">Churrería POS</span>
                </div>

                <div className="relative max-w-md">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-700">Un buen comienzo</p>
                    <h1 className="mt-3 text-4xl font-bold text-ink-900 tracking-tight leading-[1.1]">
                        Todo lo importante, más ordenado.
                    </h1>
                    <p className="mt-5 text-ink-600 leading-relaxed">
                        Crea tu cuenta y accede al inventario, los movimientos de almacén
                        y el punto de venta desde el navegador.
                    </p>
                    <ul className="mt-10 space-y-3 border-t border-primary-200 pt-6">
                        {[
                            "Inventario y stock siempre al día",
                            "Entradas y salidas con trazabilidad",
                            "Reportes exportables a Excel",
                        ].map((item) => (
                            <li key={item} className="flex items-center gap-3 text-sm text-ink-700">
                                <span className="h-2 w-2 rounded-full bg-success-500 shrink-0" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="relative text-xs text-ink-500">
                    Sistema de gestión interna para churrerías.
                </p>
            </div>

            {/* Form panel */}
            <div className="relative flex items-center justify-center px-5 py-10 sm:px-10">
                <button
                    onClick={toggleTheme}
                    className="absolute top-5 right-5 btn-icon h-10 w-10 rounded-xl"
                    aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
                >
                    {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
                </button>

                <div className="w-full max-w-sm surface-raised rounded-3xl p-7 sm:p-9">
                    <div className="lg:hidden flex items-center gap-2.5 mb-8">
                        <div className="h-9 w-9 rounded-lg bg-brand-gradient-soft flex items-center justify-center">
                            <Flame className="h-5 w-5 text-white" />
                        </div>
                        <span className="font-semibold text-ink-900 tracking-tight">Churrería POS</span>
                    </div>

                    <h2 className="text-2xl font-bold text-ink-900 tracking-tight">Crear cuenta</h2>
                    <p className="text-sm text-ink-500 mt-1.5">
                        Completa los datos para registrarte en el sistema.
                    </p>

                    {error && (
                        <div
                            role="alert"
                            className="mt-6 flex items-start gap-2.5 p-3.5 rounded-lg bg-danger-50 border border-danger-200 text-sm text-danger-800"
                        >
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                        <div>
                            <label htmlFor="reg-name" className="input-label">Nombre completo</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" />
                                <input
                                    id="reg-name"
                                    type="text"
                                    autoComplete="name"
                                    placeholder="Tu nombre completo"
                                    className="input-field pl-9"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="reg-email" className="input-label">Correo electrónico</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" />
                                <input
                                    id="reg-email"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="tu@correo.com"
                                    className="input-field pl-9"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="reg-password" className="input-label">Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" />
                                <input
                                    id="reg-password"
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder="Mínimo 6 caracteres"
                                    className="input-field pl-9"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="reg-confirm" className="input-label">Confirmar contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" />
                                <input
                                    id="reg-confirm"
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder="Repite tu contraseña"
                                    className="input-field pl-9"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full py-3 text-base mt-2"
                        >
                            {loading ? (
                                <>
                                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Creando cuenta...
                                </>
                            ) : (
                                <>
                                    Crear cuenta
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-8 text-sm text-ink-500">
                        ¿Ya tienes cuenta?{" "}
                        <Link to="/login" className="font-semibold text-primary-700 hover:text-primary-800">
                            Inicia sesión
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
