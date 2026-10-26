import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { Lock, Mail, User, ArrowRight, AlertCircle, Package, Receipt, Users } from "lucide-react";
import { useCompany } from "../hooks/useCompany";
import { BrandPanel } from "../components/BrandPanel";

export default function Register() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();
    const company = useCompany();

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
        <div className="min-h-screen grid lg:grid-cols-2">
            <BrandPanel
                title="Únete al equipo."
                subtitle="Tu cuenta se crea como cajero; un administrador puede darte permisos después."
                points={[
                    { icon: Users, text: "Alta inmediata con tu correo" },
                    { icon: Package, text: "Consulta inventario y existencias" },
                    { icon: Receipt, text: "Imprime comprobantes de cada movimiento" },
                ]}
            />

            <main className="flex items-center justify-center p-5 sm:p-8 bg-paper">
                <div className="w-full max-w-sm">
                    <div className="lg:hidden flex items-center gap-3 mb-6">
                        <div className="h-11 w-11 rounded-2xl bg-gradient-to-b from-brand-500 to-brand-600 shadow-card flex items-center justify-center overflow-hidden flex-shrink-0">
                            {company.logoUrl ? (
                                <img src={company.logoUrl} alt="Logo" className="h-full w-full object-cover" />
                            ) : (
                                <span className="text-white font-extrabold text-xl">
                                    {(company.name || "C").charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="font-extrabold text-ink truncate">{company.name || "Churrería"}</p>
                            <p className="text-xs font-semibold text-ink-3">Sistema de almacén</p>
                        </div>
                    </div>

                    <h1 className="text-3xl font-extrabold tracking-tight text-ink">Crear cuenta</h1>
                    <p className="text-sm text-ink-2 mt-1 mb-6">
                        Entrarás como <strong className="text-ink">cajero</strong>
                    </p>

                    {error && (
                        <div role="alert"
                            className="p-3.5 mb-4 text-sm font-bold text-rose-900 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-2.5">
                            <AlertCircle className="h-5 w-5 text-rose-700 flex-shrink-0 mt-px" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="label" htmlFor="reg-name">
                                <span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Nombre completo</span>
                            </label>
                            <input id="reg-name" type="text" placeholder="Tu nombre" className="input"
                                value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
                        </div>
                        <div>
                            <label className="label" htmlFor="reg-email">
                                <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Correo electrónico</span>
                            </label>
                            <input id="reg-email" type="email" placeholder="tu@correo.com" className="input"
                                value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="label" htmlFor="reg-pass">
                                    <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Contraseña</span>
                                </label>
                                <input id="reg-pass" type="password" placeholder="Mín. 6" className="input"
                                    value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
                            </div>
                            <div>
                                <label className="label" htmlFor="reg-pass2">Confirmar</label>
                                <input id="reg-pass2" type="password" placeholder="Repite" className="input"
                                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password" />
                            </div>
                        </div>

                        <button type="submit" disabled={loading} className="btn-primary btn-block !py-3.5">
                            {loading ? (
                                <>
                                    <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    Creando cuenta...
                                </>
                            ) : (
                                <>
                                    Crear mi cuenta
                                    <ArrowRight className="h-5 w-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-ink-2">
                        ¿Ya tienes cuenta?{" "}
                        <Link to="/login" className="text-brand-700 font-bold hover:underline underline-offset-2">
                            Inicia sesión
                        </Link>
                    </p>
                </div>
            </main>
        </div>
    );
}
