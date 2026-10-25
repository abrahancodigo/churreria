import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNavigate, Link } from "react-router-dom";
import { Lock, Mail, ArrowRight, Flame, AlertCircle, Sun, Moon } from "lucide-react";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await login(email, password);
            navigate("/");
        } catch (err) {
            console.error(err);
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError("Correo o contraseña incorrectos.");
            } else if (err.code === 'auth/too-many-requests') {
                setError("Demasiados intentos fallidos. Intente más tarde.");
            } else {
                setError("Error al iniciar sesión: " + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-dvh bg-ink-50 lg:grid lg:grid-cols-[1.05fr_1fr]">
            {/* Brand panel */}
            <div className="hidden lg:flex flex-col justify-between bg-primary-50 p-12 relative overflow-hidden border-r border-primary-100">
                <div
                    className="absolute inset-0 opacity-[0.07] pointer-events-none"
                    style={{
                        backgroundImage: "radial-gradient(circle at 1px 1px, rgb(37 81 235 / 0.24) 1px, transparent 0)",
                        backgroundSize: "30px 30px"
                    }}
                />
                <div
                    aria-hidden="true"
                    className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full opacity-70 blur-3xl"
                    style={{ background: "radial-gradient(circle, rgb(96 144 250 / 0.25) 0%, transparent 70%)" }}
                />

                <div className="relative flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary-600 flex items-center justify-center shadow-card">
                        <Flame className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-ink-900 font-semibold tracking-tight">Churrería POS</span>
                </div>

                <div className="relative max-w-md">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-700">Hecho para el día a día</p>
                    <h1 className="mt-3 text-[2.6rem] leading-[1.08] font-bold text-ink-900 tracking-tight">
                        Tu negocio, más fácil de llevar.
                    </h1>
                    <p className="mt-5 text-ink-600 leading-relaxed">
                        Control de stock, movimientos de almacén y ventas con reportes
                        listos para exportar, desde cualquier dispositivo.
                    </p>
                    <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-primary-200 pt-6">
                        <div>
                            <dt className="text-xs text-ink-500">Inventario</dt>
                            <dd className="text-sm font-semibold text-ink-900 mt-1">Al día</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-ink-500">Reportes</dt>
                            <dd className="text-sm font-semibold text-ink-900 mt-1">Claros</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-ink-500">Ventas</dt>
                            <dd className="text-sm font-semibold text-ink-900 mt-1">Rápidas</dd>
                        </div>
                    </dl>
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

                    <h2 className="text-2xl font-bold text-ink-900 tracking-tight">Inicia sesión</h2>
                    <p className="text-sm text-ink-500 mt-1.5">
                        Accede con tu cuenta para entrar al sistema.
                    </p>

                    {error && (
                        <div
                            role="alert"
                            className="mt-6 flex items-start gap-2.5 p-3.5 rounded-xl bg-danger-50 border border-danger-200 text-sm text-danger-800"
                        >
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-danger-600" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                        <div>
                            <label htmlFor="login-email" className="input-label">Correo electrónico</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" />
                                <input
                                    id="login-email"
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
                            <label htmlFor="login-password" className="input-label">Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" />
                                <input
                                    id="login-password"
                                    type="password"
                                    autoComplete="current-password"
                                    placeholder="••••••••"
                                    className="input-field pl-9"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full py-3 text-base"
                        >
                            {loading ? (
                                <>
                                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Iniciando sesión...
                                </>
                            ) : (
                                <>
                                    Entrar al sistema
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-7 text-sm text-ink-500">
                        ¿No tienes cuenta?{" "}
                        <Link to="/register" className="font-semibold text-primary-700 hover:text-primary-800">
                            Regístrate
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
