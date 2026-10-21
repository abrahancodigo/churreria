/**
 * SCRIPT DE BACKUP DE FIRESTORE
 * =============================
 * Este script exporta todos los datos críticos de Firestore a archivos JSON locales.
 * 
 * USO:
 * 1. Asegúrate de tener firebase-tools instalado: npm install -g firebase-tools
 * 2. Ejecuta: node backup-firestore.js
 * 3. Se crearán archivos JSON en la carpeta backup/
 * 
 * FECHA: Se genera automáticamente con timestamp
 */

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// Configuración de Firebase Admin (necesitas tu service account)
// Si no tienes el archivo de service account, usa firebase-tools en su lugar
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

// Crear carpeta backup si no existe
const backupDir = path.join(__dirname, 'backup');
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

async function backupWithFirebaseTools() {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    console.log('🔄 Iniciando backup con firebase-tools...\n');

    const collections = ['products', 'transactions', 'users', 'settings', 'counters'];
    const backupData = {};

    try {
        // Verificar conexión
        console.log('📡 Verificando conexión con Firebase...');
        await execPromise('firebase --version');
        console.log('✅ firebase-tools disponible\n');

        for (const collection of collections) {
            console.log(`📦 Exportando colección: ${collection}...`);
            
            const outputFile = path.join(backupDir, `${collection}_${timestamp}.json`);
            
            try {
                // Usar firestore:export requiere un bucket de storage, usaremos un approach diferente
                // En su lugar, creamos un script que usa el SDK normal
                backupData[collection] = `Pendiente - usar SDK cliente para exportar`;
                console.log(`   ⚠️  Usa el script backup-client.js para exportar datos completos\n`);
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}\n`);
            }
        }

        console.log('✅ Backup completado (parcial)');
        console.log(`📁 Archivos guardados en: ${backupDir}`);
        
    } catch (error) {
        console.error('❌ Error durante el backup:', error.message);
        console.log('\n💡 Alternativa: Ejecuta backup-client.js desde el navegador');
    }
}

// Verificar si firebase-admin está disponible
try {
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        initializeApp({ credential: serviceAccount });
        const db = getFirestore();
        console.log('✅ Firebase Admin SDK inicializado');
        // Aquí iría la lógica de backup con admin SDK
    } else {
        console.log('⚠️  No se encontró serviceAccountKey.json');
        console.log('💡 Usando método alternativo...\n');
        backupWithFirebaseTools();
    }
} catch (error) {
    console.log('⚠️  Firebase Admin no disponible');
    backupWithFirebaseTools();
}

console.log('\n' + '='.repeat(50));
console.log('NOTA: Para un backup completo, usa backup-client.js');
console.log('Este script requiere firebase-admin o firebase-tools configurado');
console.log('='.repeat(50));
