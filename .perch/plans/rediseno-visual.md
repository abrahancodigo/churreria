# Rediseño visual — "Churro & Cobre"

## Dirección

La app parte de un azul genérico (`sky-600`) sobre gris frío. El rediseño la ancla
al producto: **masa frita, azúcar y cajeta**. No es solo decoración, también corrige
contraste: el verde de éxito actual (`#059669`) con texto blanco da **3.77:1** y no
llega a AA.

| Rol | Antes | Ahora | Contraste texto blanca |
|---|---|---|---|
| Acción principal | `sky-600` | `brand-600` `#c2410c` | 5.18:1 ✅ |
| Hover | `sky-700` | `brand-700` `#9a3412` | 7.31:1 ✅ |
| Éxito / entrada | `emerald-600` | `emerald-700` `#047857` | 5.21:1 sobre `emerald-50` |
| Salida | `amber-600` (texto blanco) | `amber-700` + fondo `amber-800` | 6.37:1 ✅ |
| Textos | `slate-500/400` | `ink-2` / `ink-3` (cálidos) | 12.4:1 / 7.9:1 ✅ |
| Fondo | `slate-100` | `paper` `#faf7f2` | — |

Todos los pares los verifica `node tools/contrast.mjs` (WCAG 2.1 AA, falla con código 1).

## Estructura

- **Barra lateral oscura** (`ink`, `#16100b`) con acento naranja: da jerarquía y
  hace resaltar el contenido. El ítem activo lleva una barra vertical de marca.
- **Cabecera móvil** con gradiente cálido sutil en vez de blanco plano.
- **`PageHeader`** con un tono de acento por página (inventario, movimientos,
  reportes…) para orientarse de un vistazo.
- **KPIs** con banda de color superior, cifra grande tabular y cápsula de icono.
- **Login / registro** a pantalla partida en escritorio: panel de marca con
  "el churro" dibujado en CSS (sin imágenes externas) y tarjeta limpia a la derecha.

## Componentes reescritos

`src/components/ui.jsx`: `PageHeader`, `EmptyState`, `ListSkeleton`, `Sheet`,
`PrintModal`, `TypeBadge` y nuevos `StatCard`, `Segmented`, `IconButton`, `Chip`.

## Reglas

- Áreas táctiles de 44px mínimo (`min-h-[44px]`, `.btn-icon` de 40px, botones de
  cantidad con `hit-area` que extienden el área sin cambiar el tamaño visual).
- Foco visible con `ring-brand-500` en todos los interactivos (antes dependía del
  navegador y en los `input` con `focus:outline-none` era invisible).
- `font-variant-numeric: tabular-nums` en dinero y cantidades.
