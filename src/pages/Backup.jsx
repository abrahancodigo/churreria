import { useState, useEffect } from "react";
import { Download, Shield, Database, CheckCircle, AlertCircle } from "lucide-react";
import { db } from "../firebase.config";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useRole } from "../hooks/useRole";

export default function Backup() {
    const [backupInProgress, setBackupInProgress] = useState(false);
    const [currentCollection, setCurrentCollection] = useState("");
    const [backupComplete, setBackupComplete] = useState(false);
    const [summary, setSummary] = useState({});

    const { user } = useAuth();
    const { isAdmin } = useRole();
    const { addToast } = useToast();

    const collections = ['products', 'transactions', 'users', 'settings', 'counters'];

    useEffect(() => {
        if (!isAdmin) {
            addToast("Solo administradores pueden acceder al backup", "error");
        }
    }, [isAdmin, addToast]);

    const downloadJSON = (data, filename) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const backupCollection = async (collectionName) => {
        try {
            setCurrentCollection(collectionName);
            const colRef = collection(db, collectionName);
            const snapshot = await getDocs(colRef);

            const docs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            downloadJSON(docs, `${collectionName}_backup_${timestamp}.json`);

            return docs.length;
        } catch (error) {
            console.error(`Error backing up ${collectionName}:`, error);
            addToast(`Error en ${collectionName}: ${error.message}`, "error");
            return 0;
        }
    };

    const handleBackup = async () => {
        if (!isAdmin) {
            addToast("Solo administradores pueden crear backups", "error");
            return;
        }

        setBackupInProgress(true);
        setBackupComplete(false);
        const summary = {};

        try {
            for (const col of collections) {
                const count = await backupCollection(col);
                summary[col] = count;
                addToast(`${col}: ${count} documentos exportados`);
            }

            // Download summary
            const summaryData = {
                timestamp: new Date().toISOString(),
                projectId: db.app.options.projectId,
                backupBy: user?.email,
                collections: summary,
                totalDocuments: Object.values(summary).reduce((a, b) => a + b, 0)
            };

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            downloadJSON(summaryData, `backup_summary_${timestamp}.json`);

            setSummary(summaryData);
            setBackupComplete(true);
            addToast("Backup completado exitosamente");
        } catch (error) {
            addToast("Error durante el backup: " + error.message, "error");
        } finally {
            setBackupInProgress(false);
            setCurrentCollection("");
        }
    };

    if (!isAdmin) {
        return (
            <div className="surface empty-state min-h-[60vh]">
                <div className="empty-icon bg-danger-50">
                    <Shield className="h-6 w-6 text-danger-600" />
                </div>
                <h1 className="badge-danger">Acceso denegado</h1>
                <p className="text-sm text-ink-500 mt-2">Solo administradores pueden acceder a esta página.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Backup de base de datos</h1>
                    <p className="page-subtitle">Exporta todos los datos de Firestore a archivos JSON locales</p>
                </div>
            </header>

            <section className="surface overflow-hidden">
                <div className="card-header">
                    <div className="flex items-center gap-3">
                        <div className="stat-icon bg-primary-50 text-primary-700">
                            <Database className="h-5 w-5" />
                        </div>
                        <h2 className="section-title">¿Por qué hacer backup?</h2>
                    </div>
                </div>

                <div className="p-5 sm:p-6 space-y-5">
                    <ul className="text-sm text-ink-600 space-y-1.5 list-disc list-inside">
                        <li>Protege tus datos antes de hacer cambios en producción</li>
                        <li>Permite restaurar información en caso de error</li>
                        <li>Crea copias de seguridad periódicas</li>
                    </ul>

                    <div className="surface-muted p-4 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-warning-600 shrink-0 mt-0.5" />
                        <div>
                            <h3 className="badge-warning">Importante</h3>
                            <p className="text-sm text-ink-600 mt-2">
                                Los archivos se descargarán en tu carpeta de Descargas.
                                Guárdalos en un lugar seguro antes de continuar con cualquier cambio.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="divider px-5 py-4">
                    <button
                        onClick={handleBackup}
                        disabled={backupInProgress}
                        className="btn-primary w-full py-3.5 text-base"
                    >
                        {backupInProgress ? (
                            <>
                                <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Exportando {currentCollection}...
                            </>
                        ) : (
                            <>
                                <Download className="h-5 w-5" />
                                Crear backup completo
                            </>
                        )}
                    </button>
                </div>
            </section>

            {backupComplete && (
                <section className="surface overflow-hidden">
                    <div className="card-header bg-success-50/60">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 text-success-600" />
                            <h2 className="section-title">Backup completado</h2>
                        </div>
                    </div>

                    <div className="p-5 sm:p-6 space-y-5">
                        <div>
                            <h3 className="section-label">Resumen de datos exportados</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                                {Object.entries(summary.collections).map(([col, count]) => (
                                    <div key={col} className="stat-card">
                                        <span className="stat-label capitalize">{col}</span>
                                        <span className="stat-value tabular-nums">{count} docs</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="divider flex justify-between items-center gap-3 pt-4">
                            <span className="stat-label">Total</span>
                            <span className="stat-value tabular-nums text-success-700">
                                {summary.totalDocuments} documentos
                            </span>
                        </div>

                        <div>
                            <p className="section-label">Archivos descargados</p>
                            <ul className="mt-3">
                                {Object.keys(summary.collections).map(col => (
                                    <li key={col} className="divider py-2.5 text-xs text-ink-500 tabular-nums">{col}_backup_*.json</li>
                                ))}
                                <li className="divider py-2.5 text-xs text-ink-500 tabular-nums">backup_summary_*.json</li>
                            </ul>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
