import { useState } from "react";
import { Download, Database, CheckCircle } from "lucide-react";
import { db } from "../firebase.config";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { PageHeader } from "../components/ui";

const COLLECTIONS = ["products", "transactions", "users", "settings", "counters"];

export default function Backup() {
    const [backupInProgress, setBackupInProgress] = useState(false);
    const [currentCollection, setCurrentCollection] = useState("");
    const [backupComplete, setBackupComplete] = useState(false);
    const [summary, setSummary] = useState(null);

    const { user } = useAuth();
    const { addToast } = useToast();

    const downloadJSON = (data, filename) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const backupCollection = async (name) => {
        try {
            setCurrentCollection(name);
            const snapshot = await getDocs(collection(db, name));
            const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
            downloadJSON(docs, `${name}_backup_${timestamp}.json`);
            return docs.length;
        } catch (error) {
            console.error(`Error backing up ${name}:`, error);
            addToast(`Error en ${name}: ${error.message}`, "error");
            return 0;
        }
    };

    const handleBackup = async () => {
        setBackupInProgress(true);
        setBackupComplete(false);
        const counts = {};
        try {
            for (const col of COLLECTIONS) {
                const count = await backupCollection(col);
                counts[col] = count;
                addToast(`${col}: ${count} documentos exportados`);
            }
            const summaryData = {
                timestamp: new Date().toISOString(),
                projectId: db.app.options.projectId,
                backupBy: user?.email,
                collections: counts,
                totalDocuments: Object.values(counts).reduce((a, b) => a + b, 0),
            };
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
            downloadJSON(summaryData, `backup_summary_${timestamp}.json`);
            setSummary(summaryData);
            setBackupComplete(true);
            addToast("✅ Backup completado");
        } catch (error) {
            addToast("Error durante el backup: " + error.message, "error");
        } finally {
            setBackupInProgress(false);
            setCurrentCollection("");
        }
    };

    return (
        <div>
            <PageHeader title="Backup" sub="Copia de seguridad en archivos JSON" icon={Database} accent="sky" />

            <div className="card mb-3 max-w-2xl">
                <div className="flex items-start gap-3.5 mb-4">
                    <span className="p-2.5 rounded-xl bg-sky-100 flex-shrink-0">
                        <Database className="h-6 w-6 text-sky-700" />
                    </span>
                    <div>
                        <h2 className="font-extrabold text-ink">¿Por qué hacer backup?</h2>
                        <ul className="text-sm text-ink-3 mt-1 space-y-0.5">
                            <li>• Protege tus datos antes de cambios grandes</li>
                            <li>• Guarda copias periódicas en lugar seguro</li>
                        </ul>
                    </div>
                </div>

                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 mb-4">
                    <p className="text-sm text-amber-800">
                        <b>Importante:</b> los archivos se descargan a tu carpeta de Descargas.
                        Guárdalos en un lugar seguro.
                    </p>
                </div>

                <button onClick={handleBackup} disabled={backupInProgress} className="btn-primary btn-block !py-4">
                    {backupInProgress ? (
                        <>
                            <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            Exportando {currentCollection}...
                        </>
                    ) : (
                        <>
                            <Download className="h-5 w-5" />
                            Crear backup completo
                        </>
                    )}
                </button>

                {!backupInProgress && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        {COLLECTIONS.map((c) => (
                            <span key={c} className="badge-muted">{c}</span>
                        ))}
                    </div>
                )}
            </div>

            {backupComplete && summary && (
                <div className="card !border-emerald-200 max-w-2xl">
                    <div className="flex items-center gap-2.5 mb-3">
                        <CheckCircle className="h-6 w-6 text-emerald-700" />
                        <h2 className="font-extrabold text-emerald-800">Backup completado</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        {Object.entries(summary.collections).map(([col, count]) => (
                            <div key={col} className="flex justify-between items-center p-3 bg-paper border border-line rounded-xl">
                                <span className="font-bold text-sm text-ink-2 capitalize">{col}</span>
                                <span className="font-black text-sky-700 text-sm">{count} docs</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-line">
                        <span className="font-extrabold text-ink">Total</span>
                        <span className="font-black text-emerald-700">{summary.totalDocuments} documentos</span>
                    </div>
                </div>
            )}
        </div>
    );
}
