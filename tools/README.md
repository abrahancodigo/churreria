# Herramientas de verificación

Scripts de apoyo para comprobar la interfaz **sin tocar datos reales**.
No forman parte del build de la app (`vite build` solo empaqueta `src/`).

## Arnés (`tools/harness/`)

Monta la app real con Firebase simulado en memoria (`sim.js`): productos,
transacciones, folios y configuración de ejemplo. Permite abrir cualquier
pantalla con cualquier rol sin conectarse al proyecto de Firebase.

```bash
npx vite --config tools/vite.harness.config.js   # http://127.0.0.1:5199
```

Rutas con rol: `?role=admin&p=/inventory`, `?role=cashier&p=/transactions`.

## `contrast.mjs` — contraste de la paleta

Calcula la relación WCAG 2.1 de cada par texto/fondo que usa la interfaz y
falla si alguno no llega al mínimo **AA** (4.5:1 normal, 3:1 texto grande).

```bash
node tools/contrast.mjs
```

## `audit.mjs` — auditoría del DOM renderizado

Abre una ruta en Chrome headless y reporta en texto:

- contraste real de cada texto visible (color calculado contra el fondo efectivo,
  incluidos degradados);
- áreas táctiles menores a 44×44 px;
- desbordes horizontales (ignorando el scroll interno de tablas);
- texto recortado sin puntos suspensivos.

```bash
node tools/audit.mjs /inventory 1440 900
node tools/audit.mjs /stock-adjustments 390 844
```

Requiere el arnés corriendo. Para una sonda ad-hoc, exporta `AUDIT_EXPR` con una
función de JS a evaluar en la página ya montada.

## `console.mjs` — errores de consola

Vuelca los mensajes de consola, excepciones y el texto del DOM de una ruta.

```bash
node tools/console.mjs /reports
```

## `shoot.mjs` / `shot.mjs` — capturas

`shoot.mjs` captura varias rutas de una pasada y deja los PNG en `tmp-shots/`;
`shot.mjs` toma una sola imagen de una URL o archivo.

```bash
node tools/shoot.mjs 1440 900 admin / =inicio /inventory =inventario
node tools/shoot.mjs 390 844 admin / =inicio-movil
```

## Flujo recomendado antes de publicar

```bash
node tools/contrast.mjs      # paleta
npx eslint src              # código
npx vite build              # build de producción
```

Con el arnés levantado, audita todas las rutas en 390×844, 768×1024 y 1440×900.
