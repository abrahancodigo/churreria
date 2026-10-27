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
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
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

// Las reglas de Firestore exigen sesión iniciada. El script se autentica con un
// usuario administrador mediante BACKUP_EMAIL y BACKUP_PASSWORD. Ejemplo:
//   BACKUP_EMAIL=usuario@dominio BACKUP_PASSWORD=... node backup-data.cjs
const backupEmail = process.env.BACKUP_EMAIL;
const backupPassword = process.env.BACKUP_PASSWORD;

if (!backupEmail || !backupPassword) {
  console.error('❌ Faltan credenciales. Define BACKUP_EMAIL y BACKUP_PASSWORD antes de ejecutar el backup.');
  process.exit(1);
}

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// Si getFirestore se inicializa antes del login no es problema: el SDK envía la
// solicitud con la sesión vigente cuando esta existe.
const auth = getAuth(app);

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
const failedCollections = new Set();

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
        failedCollections.add(collectionName);
        
        // No creamos un JSON vacío: un backup incompleto debe reconocerse como
        // tal y no confundirse con una colección realmente vacía.
        return [];
    }
}

async function main() {
    console.log('='.repeat(50));
    console.log('BACKUP DE FIRESTORE');
    console.log('Proyecto:', firebaseConfig.projectId);
    console.log('='.repeat(50) + '\n');

    await signInWithEmailAndPassword(auth, backupEmail, backupPassword);

    for (const col of collections) {
        await backupCollection(col);
    }

    // Guardar resumen
    const summaryData = {
        timestamp: new Date().toISOString(),
        projectId: firebaseConfig.projectId,
        backupPath: backupDir,
        collections: summary,
        failedCollections: [...failedCollections],
        totalDocuments: Object.values(summary).reduce((a, b) => a + b, 0)
    };
    
    fs.writeFileSync(
        path.join(backupDir, 'summary.json'),
        JSON.stringify(summaryData, null, 2)
    );

    console.log('='.repeat(50));
    if (failedCollections.size) {
        console.log('⚠️  BACKUP PARCIAL O FALLIDO');
    } else {
        console.log('✅ BACKUP COMPLETADO');
    }
    console.log('='.repeat(50));
    console.log('\n📊 Resumen:', summary);
    console.log(`📁 Archivos guardados en: ${backupDir}`);
    if (failedCollections.size) {
        console.log('\n❗ Colecciones con error:', [...failedCollections].join(', '));
        console.log('   Revisa las credenciales/reglas y vuelve a ejecutar antes de modificar producción.');
        process.exitCode = 1;
    } else {
        console.log('\n💾 COPIA ESTA CARPETA A UN LUGAR SEGURO');
        console.log('   Antes de hacer cualquier cambio en producción\n');
    }
}

main().catch((error) => {
    console.error('❌ Backup cancelado:', error.message);
    process.exitCode = 1;
});
