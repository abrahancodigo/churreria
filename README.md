# Churrería — Sistema de almacén

Control de inventario y movimientos (entradas y salidas) para una churrería con
varias sucursales. Registra cada movimiento con folio consecutivo, descuenta o
suma stock, imprime comprobante y exporta reportes.

## Stack

- **React 19** + **Vite 7** (JavaScript, sin TypeScript)
- **Tailwind CSS 3** con tokens propios (`tailwind.config.js`)
- **Firebase 12**: Authentication y Firestore
- **React Router 7**, **lucide-react** (iconos), **xlsx** (exportables), **date-fns**

## Puesta en marcha

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # build de producción en dist/
npm run preview  # sirve el build
npm run lint     # ESLint
```

La configuración de Firebase vive en `src/firebase.config.js` (o se toma de
variables de entorno en despliegue). Ver `GUIA_DESPLIEGUE_FIREBASE.md`.

## Pantallas

| Ruta | Acceso | Descripción |
|---|---|---|
| `/` | Todos | Inicio: KPIs del periodo y lista de entradas/salidas |
| `/inventory` | Todos (editar: admin) | Productos, existencias y valor a costo |
| `/stock-adjustments` | Admin | Registrar entrada o salida con carrito y folio |
| `/transactions` | Todos (editar: admin) | Historial, detalle, impresión y exportación |
| `/reports` | Admin | Movimientos, cardex por producto y resumen por sucursal |
| `/settings` | Admin | Empresa, usuarios y herramientas de mantenimiento |
| `/backup` | Admin | Respaldo de colecciones a JSON |
| `/login`, `/register` | — | Acceso |

Roles: `admin` y `cajero`. La gestión de movimientos y ajustes es solo de admin.

## Modelo de datos (Firestore)

- `products` — `name`, `sku`, `category`, `price`, `cost`, `stock`, `image`
- `transactions` — `type` (`entry` | `exit` | `sale`), `items[]`, `reference`
  (`ENT-` / `SAL-`), `sucursal`, `reason`, `party`, `notes`, `timestamp`, `userId`
- `counters/movement_series` — correlativo por serie y año
- `users` — perfil y `role`
- `settings/company` — datos de la empresa y logo

## Estructura

```
src/
  components/   AppNav, Layout, ui.jsx (PageHeader, StatCard, Sheet, ...),
                accents.js (paleta por sección), BrandPanel, TypeBadge
  context/      AuthContext, ToastContext (+ sus contextos en auth-context.js,
                toast-context.js para respetar Fast Refresh)
  hooks/        useAuth, useToast, useRole, useCompany
  lib/          db.js (altas/bajas y ajuste de stock), movements.js (motivos),
                receipt.js (comprobante e impresión)
  pages/        una pantalla por ruta
```

## Diseño

Look **premium azul y blanco** con profundidad 3D. Paleta de marca azul royal
(`brand`, de #eff6ff a #172554) sobre lienzo blanco-frío (`paper`) con neutros
fríos (`ink`). La profundidad viene de sombras multicapa (`card`, `raised`,
`pop`) y botones en gradiente con brillo superior y presión al hacer clic.
Acentos por sección: **cielo** = entrada, **ámbar** = salida, **esmeralda** =
positivo, **indigo** = admin. Los botones se oscurecen al hover para mantener
AAA sobre texto blanco; todos los pares texto/fondo cumplen **WCAG AA**
(verificados con `node tools/contrast.mjs`).

Detalles en `.perch/plans/rediseno-visual.md`.

## Verificación

Herramientas para revisar la interfaz sin tocar datos reales (arnés con Firebase
simulado, auditoría de contraste y áreas táctiles, capturas): ver
[`tools/README.md`](tools/README.md).
