/**
 * BACKUP CLIENTE - Exportar datos de Firestore desde el navegador
 * ================================================================
 * INSTRUCCIONES:
 * 
 * 1. Abre tu aplicación web-pos en el navegador (localhost o producción)
 * 2. Abre la consola del navegador (F12)
 * 3. Copia y pega este código completo en la consola
 * 4. Presiona Enter
 * 5. Se descargarán archivos JSON con todos tus datos
 * 
 * Esto creará un backup de: products, transactions, users, settings, counters
 */

(async function backupFirestore() {
    console.log('🔄 Iniciando backup de Firestore...\n');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const collections = ['products', 'transactions', 'users', 'settings', 'counters'];
    
    // Verificar si Firebase está disponible
    if (typeof window === 'undefined' || !window.firebase) {
        console.log('⚠️  Ejecuta este script desde la consola del navegador en tu app web-pos');
        return;
    }

    try {
        const { getFirestore, collection, getDocs } = require('firebase/firestore');
        const db = getFirestore();
        
        const backupData = {};
        const summary = {};

        for (const collectionName of collections) {
            console.log(`📦 Exportando: ${collectionName}...`);
            
            try {
                const colRef = collection(db, collectionName);
                const snapshot = await getDocs(colRef);
                
                const docs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                backupData[collectionName] = docs;
                summary[collectionName] = docs.length;
                
                // Descargar archivo JSON
                const blob = new Blob([JSON.stringify(docs, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${collectionName}_backup_${timestamp}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                console.log(`   ✅ ${docs.length} documentos exportados\n`);
            } catch (error) {
                console.log(`   ⚠️  Error en ${collectionName}: ${error.message}\n`);
                backupData[collectionName] = [];
                summary[collectionName] = 0;
            }
        }

        // Descargar resumen
        const summaryBlob = new Blob([JSON.stringify({
            timestamp: new Date().toISOString(),
            projectId: db.app.options.projectId,
            collections: summary
        }, null, 2)], { type: 'application/json' });
        const summaryUrl = URL.createObjectURL(summaryBlob);
        const summaryA = document.createElement('a');
        summaryA.href = summaryUrl;
        summaryA.download = `backup_summary_${timestamp}.json`;
        document.body.appendChild(summaryA);
        summaryA.click();
        document.body.removeChild(summaryA);
        URL.revokeObjectURL(summaryUrl);

        console.log('='.repeat(50));
        console.log('✅ BACKUP COMPLETADO');
        console.log('='.repeat(50));
        console.log('Resumen:', summary);
        console.log('\n📁 Archivos descargados en tu carpeta de Descargas');
        console.log('💾 Guarda estos archivos en un lugar seguro');
        
    } catch (error) {
        console.error('❌ Error durante el backup:', error);
        console.log('\n💡 Asegúrate de estar logueado en la aplicación');
    }
})();
