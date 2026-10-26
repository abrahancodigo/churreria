# Guía de Despliegue a Firebase Hosting

Sigue estos pasos para publicar tu Sistema de Inventario en internet.

## 1. Prerrequisitos
Asegúrate de estar en la carpeta del proyecto:
```bash
cd churreria
```

## 2. Instalar Herramientas de Firebase (si no las tienes)
Si nunca has usado Firebase en tu terminal, instala las herramientas:
```bash
npm install -g firebase-tools
```

## 3. Iniciar Sesión
Conecta tu terminal con tu cuenta de Google:
```bash
npx firebase login
```
*Se abrirá una ventana en tu navegador para que autorices el acceso.*

## 4. Vincular Proyecto (IMPORTANTE)
Este paso es necesario para evitar el error "No currently active project".
Ejecuta el siguiente comando y selecciona tu proyecto (por ejemplo `churreria-por...`) de la lista usando las flechas y Enter:
```bash
npx firebase use --add
```
*Cuando te pregunte "What alias do you want to use for this project?", escribe: `default`.*

## 5. Construir y Desplegar
Genera la versión optimizada para producción y súbela:

```bash
npm run build
npx firebase deploy
```

## Solución de Problemas Comunes

### Error de Reglas de Firestore
Si ves errores de permisos, asegúrate de que las reglas en `firestore.rules` se hayan subido. El comando `deploy` debería hacerlo automáticamente.

### Índices Faltantes
Si al buscar en Reportes ves un error en la consola del navegador sobre un índice faltante, haz clic en el enlace que aparece en la consola. Firebase creará el índice por ti automáticamente.

### Página en Blanco
Si al abrir la URL ves una página en blanco, verifica que:
1.  Tu `firebase.config.js` tenga las credenciales correctas.
2.  En la consola del navegador (F12) no haya errores rojos.
