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
            addToast("✅ Backup completado exitosamente");
        } catch (error) {
            addToast("Error durante el backup: " + error.message, "error");
        } finally {
            setBackupInProgress(false);
            setCurrentCollection("");
        }
    };

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <Shield className="h-16 w-16 text-red-400 mb-4" />
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h1>
                <p className="text-gray-600">Solo administradores pueden acceder a esta página</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Backup de Base de Datos</h1>
                <p className="text-gray-600">Exporta todos los datos de Firestore a archivos JSON locales</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="flex items-start gap-4 mb-6">
                    <div className="p-3 bg-blue-100 rounded-lg">
                        <Database className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">¿Por qué hacer backup?</h2>
                        <ul className="text-gray-600 space-y-1">
                            <li>• Protege tus datos antes de hacer cambios en producción</li>
                            <li>• Permite restaurar información en caso de error</li>
                            <li>• Crea copias de seguridad periódicas</li>
                        </ul>
                    </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-yellow-800 mb-1">Importante</h3>
                            <p className="text-yellow-700 text-sm">
                                Los archivos se descargarán en tu carpeta de Descargas. 
                                Guárdalos en un lugar seguro antes de continuar con cualquier cambio.
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleBackup}
                    disabled={backupInProgress}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                    {backupInProgress ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            Exportando {currentCollection}...
                        </>
                    ) : (
                        <>
                            <Download className="h-5 w-5" />
                            Crear Backup Completo
                        </>
                    )}
                </button>
            </div>

            {backupComplete && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                        <h2 className="text-lg font-bold text-green-800">Backup Completado</h2>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 mb-4">
                        <h3 className="font-semibold text-gray-900 mb-3">Resumen de datos exportados:</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {Object.entries(summary.collections).map(([col, count]) => (
                                <div key={col} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                    <span className="font-medium text-gray-700 capitalize">{col}</span>
                                    <span className="font-bold text-blue-600">{count} docs</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 pt-4 border-t flex justify-between items-center">
                            <span className="font-bold text-gray-900">Total</span>
                            <span className="font-bold text-green-600">{summary.totalDocuments} documentos</span>
                        </div>
                    </div>

                    <div className="text-sm text-green-700">
                        <p className="font-semibold mb-1">✅ Archivos descargados:</p>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                            {Object.keys(summary.collections).map(col => (
                                <li key={col}>{col}_backup_*.json</li>
                            ))}
                            <li>backup_summary_*.json</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
