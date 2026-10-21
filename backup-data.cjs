/**
 * SCRIPT DE BACKUP - Node.js con Firebase SDK (ES Modules)
 * =========================================================
 * Ejecutar: node backup-data.cjs
 * 
 * Este script se conecta a Firebase y exporta todos los datos
 * a archivos JSON locales.
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

// Configuración de Firebase (misma que usa la app)
const firebaseConfig = {
  apiKey: "AIzaSyA3YZjrDIypPChhH8sAakZLoMkEVEw-1nA",
  authDomain: "churreria-por.firebaseapp.com",
  projectId: "churreria-por",
  storageBucket: "churreria-por.firebasestorage.app",
  messagingSenderId: "1090354394964",
  appId: "1:1090354394964:web:cc50d6ee53a50b9f737ac1",
  measurementId: "G-Y8N1Z3DZEL"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Crear carpeta backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const backupDir = path.join(__dirname, 'backup', `backup-${timestamp}`);

if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

console.log('🔄 Iniciando backup de Firestore...');
console.log(`📁 Carpeta: ${backupDir}\n`);

const collections = ['products', 'transactions', 'users', 'settings', 'counters'];
const summary = {};

async function backupCollection(collectionName) {
    try {
        console.log(`📦 Exportando: ${collectionName}...`);
        
        const colRef = collection(db, collectionName);
        const snapshot = await getDocs(colRef);
        
        const docs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Guardar archivo JSON
        const filePath = path.join(backupDir, `${collectionName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(docs, null, 2));
        
        summary[collectionName] = docs.length;
        console.log(`   ✅ ${docs.length} documentos guardados en ${collectionName}.json\n`);
        
        return docs;
    } catch (error) {
        console.log(`   ❌ Error en ${collectionName}: ${error.message}\n`);
        summary[collectionName] = 0;
        
        // Crear archivo vacío para mantener consistencia
        const filePath = path.join(backupDir, `${collectionName}.json`);
        fs.writeFileSync(filePath, '[]');
        
        return [];
    }
}

async function main() {
    console.log('='.repeat(50));
    console.log('BACKUP DE FIRESTORE');
    console.log('Proyecto:', firebaseConfig.projectId);
    console.log('='.repeat(50) + '\n');

    for (const col of collections) {
        await backupCollection(col);
    }

    // Guardar resumen
    const summaryData = {
        timestamp: new Date().toISOString(),
        projectId: firebaseConfig.projectId,
        backupPath: backupDir,
        collections: summary,
        totalDocuments: Object.values(summary).reduce((a, b) => a + b, 0)
    };
    
    fs.writeFileSync(
        path.join(backupDir, 'summary.json'),
        JSON.stringify(summaryData, null, 2)
    );

    console.log('='.repeat(50));
    console.log('✅ BACKUP COMPLETADO');
    console.log('='.repeat(50));
    console.log('\n📊 Resumen:', summary);
    console.log(`📁 Archivos guardados en: ${backupDir}`);
    console.log('\n💾 COPIA ESTA CARPETA A UN LUGAR SEGURO');
    console.log('   Antes de hacer cualquier cambio en producción\n');
}

main().catch(console.error);
