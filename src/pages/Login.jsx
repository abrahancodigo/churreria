import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { Lock, Mail, ArrowRight, AlertCircle, Package, ShieldCheck, Store } from "lucide-react";
import { useCompany } from "../hooks/useCompany";
import { BrandPanel } from "../components/BrandPanel";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const company = useCompany();

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
        <div className="min-h-screen grid lg:grid-cols-2">
            <BrandPanel
                title="Tu almacén, siempre cuadrando."
                subtitle="Entradas, salidas, folios y comprobantes en un solo lugar."
                points={[
                    { icon: Package, text: "Control de inventario en tiempo real" },
                    { icon: Store, text: "Movimientos por sucursal con folio consecutivo" },
                    { icon: ShieldCheck, text: "Reportes y exportables cuando los necesites" },
                ]}
            />

            <main className="flex items-center justify-center p-5 sm:p-8 bg-paper">
                <div className="w-full max-w-sm">
                    <div className="lg:hidden flex items-center gap-3 mb-6">
                        <CompanyLogo company={company} />
                        <div className="min-w-0">
                            <p className="font-extrabold text-ink truncate">{company.name || "Churrería"}</p>
                            <p className="text-xs font-semibold text-ink-3">Sistema de almacén</p>
                        </div>
                    </div>

                    <h1 className="text-3xl font-extrabold tracking-tight text-ink">Bienvenido</h1>
                    <p className="text-sm text-ink-2 mt-1 mb-6">Inicia sesión para continuar</p>

                    {error && (
                        <div role="alert"
                            className="p-3.5 mb-4 text-sm font-bold text-rose-900 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-2.5">
                            <AlertCircle className="h-5 w-5 text-rose-700 flex-shrink-0 mt-px" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="label" htmlFor="login-email">
                                <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Correo electrónico</span>
                            </label>
                            <input
                                id="login-email"
                                type="email"
                                placeholder="tu@correo.com"
                                className="input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div>
                            <label className="label" htmlFor="login-pass">
                                <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Contraseña</span>
                            </label>
                            <input
                                id="login-pass"
                                type="password"
                                placeholder="••••••••"
                                className="input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                            />
                        </div>

                        <button type="submit" disabled={loading} className="btn-primary btn-block !py-3.5">
                            {loading ? (
                                <>
                                    <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    Entrando...
                                </>
                            ) : (
                                <>
                                    Entrar al sistema
                                    <ArrowRight className="h-5 w-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-ink-2">
                        ¿No tienes cuenta?{" "}
                        <Link to="/register" className="text-brand-700 font-bold hover:underline underline-offset-2">
                            Regístrate
                        </Link>
                    </p>
                </div>
            </main>
        </div>
    );
}

function CompanyLogo({ company, large }) {
    const size = large ? "h-16 w-16" : "h-11 w-11";
    return (
        <div className={`${size} rounded-2xl bg-gradient-to-b from-brand-500 to-brand-600 shadow-card flex items-center justify-center overflow-hidden flex-shrink-0`}>
            {company.logoUrl ? (
                <img src={company.logoUrl} alt={company.name || "Logo"} className="h-full w-full object-cover" />
            ) : (
                <span className="text-white font-extrabold text-xl">
                    {(company.name || "C").charAt(0).toUpperCase()}
                </span>
            )}
        </div>
    );
}
