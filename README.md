# Churrería POS

Sistema web para llevar las ventas y el inventario de una churrería. La interfaz
está pensada para usarse desde computadora, tableta o teléfono.

## Qué incluye

- Catálogo de productos con precio, costo, SKU, imágenes y stock.
- Registro de entradas y salidas de almacén.
- Historial de transacciones, reportes y exportación a Excel.
- Acceso con Firebase Authentication y datos en Cloud Firestore.
- Permisos para administración y caja, además de tema claro y oscuro.

## Desarrollo local

Requiere Node.js y npm.

```bash
npm install
npm run dev
```

Vite mostrará la dirección local en la terminal, normalmente
`http://localhost:5173/`.

## Comandos

```bash
npm run lint      # Revisa el código con ESLint
npm run build     # Genera la versión de producción en dist/
npm run preview   # Sirve localmente la última compilación
```

## Firebase

La aplicación inicializa Firebase en `src/firebase.config.js`. Antes de usarla
en otro entorno, configura allí los datos de la aplicación web de Firebase y
confirma que Authentication, Firestore, las reglas y los índices correspondan
al proyecto elegido. No publiques secretos de administración en el código del
cliente.

La guía de [despliegue a Firebase Hosting](GUIA_DESPLIEGUE_FIREBASE.md) explica
cómo publicar la aplicación.
