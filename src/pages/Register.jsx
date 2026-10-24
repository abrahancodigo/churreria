import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Lock, Mail, User, ArrowRight, CheckCircle } from "lucide-react";

export default function Register() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
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
        <div className="flex items-center justify-center min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 relative overflow-hidden">
            {/* Animated Background Decorations */}
            <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent-500/30 blur-[150px] rounded-full animate-float"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-500/30 blur-[150px] rounded-full animate-float" style={{ animationDelay: '1s' }}></div>
            <div className="absolute top-[30%] left-[50%] w-[30%] h-[30%] bg-success-500/20 blur-[120px] rounded-full animate-float" style={{ animationDelay: '2s' }}></div>

            {/* Pattern overlay */}
            <div 
                className="absolute inset-0 opacity-[0.02] pointer-events-none"
                style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
                    backgroundSize: '32px 32px'
                }}
            ></div>

            <div className="w-full max-w-md p-8 bg-white/10 backdrop-blur-2xl shadow-glass-lg rounded-[2.5rem] relative z-10 mx-4 border border-white/20">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-accent-400 to-primary-400 rounded-3xl shadow-glow-accent mb-6 animate-float">
                        <span className="text-white text-3xl font-black">CP</span>
                    </div>
                    <h2 className="text-3xl font-black text-white tracking-tight">Crear Cuenta</h2>
                    <p className="text-white/60 mt-2 font-medium">Únete a Churrearía POS</p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="p-4 mb-6 text-sm font-semibold text-white bg-danger-500/90 backdrop-blur-sm border border-danger-400/30 rounded-2xl animate-shake flex items-center gap-3">
                        <span>⚠️</span>
                        {error}
                    </div>
                )}

                {/* Success hints */}
                <div className="mb-6 flex flex-wrap gap-2 justify-center">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/10">
                        <CheckCircle className="h-3.5 w-3.5 text-success-400" />
                        <span className="text-xs text-white/70 font-medium">Acceso inmediato</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/10">
                        <CheckCircle className="h-3.5 w-3.5 text-success-400" />
                        <span className="text-xs text-white/70 font-medium">Gratis por siempre</span>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block mb-2 text-sm font-bold text-white/80 ml-1 flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Nombre Completo
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Tu nombre completo"
                                className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-400 focus:border-transparent transition-all placeholder:text-white/40 text-white font-medium backdrop-blur-sm pl-12"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block mb-2 text-sm font-bold text-white/80 ml-1 flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Correo Electrónico
                        </label>
                        <div className="relative">
                            <input
                                type="email"
                                placeholder="tu@correo.com"
                                className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-400 focus:border-transparent transition-all placeholder:text-white/40 text-white font-medium backdrop-blur-sm pl-12"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block mb-2 text-sm font-bold text-white/80 ml-1 flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            Contraseña
                        </label>
                        <div className="relative">
                            <input
                                type="password"
                                placeholder="Mínimo 6 caracteres"
                                className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-400 focus:border-transparent transition-all placeholder:text-white/40 text-white font-medium backdrop-blur-sm pl-12"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                        </div>
                    </div>
                    
                    <div className="pb-2">
                        <label className="block mb-2 text-sm font-bold text-white/80 ml-1 flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            Confirmar Contraseña
                        </label>
                        <div className="relative">
                            <input
                                type="password"
                                placeholder="Repite tu contraseña"
                                className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-400 focus:border-transparent transition-all placeholder:text-white/40 text-white font-medium backdrop-blur-sm pl-12"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                        </div>
                    </div>
                    
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 px-6 font-bold text-white bg-gradient-to-r from-accent-500 to-primary-500 rounded-2xl 
                                 hover:from-accent-600 hover:to-primary-600 active:scale-[0.98] transition-all duration-300 
                                 shadow-glow-accent focus:outline-none focus:ring-4 focus:ring-accent-500/30 
                                 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Creando cuenta...
                            </>
                        ) : (
                            <>
                                Crear Mi Cuenta
                                <ArrowRight className="h-5 w-5" />
                            </>
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div className="mt-8 text-center">
                    <p className="text-white/60 font-medium">
                        ¿Ya tienes cuenta?{" "}
                        <Link 
                            to="/login" 
                            className="text-white font-bold hover:text-accent-300 transition-colors decoration-2 underline-offset-4 hover:underline"
                        >
                            Inicia sesión
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
