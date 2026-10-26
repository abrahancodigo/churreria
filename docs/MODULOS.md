# Mapa de módulos

El objetivo es que cada módulo de negocio pueda cambiarse sin romper los demás. Para lograrlo, la UI consume **servicios por dominio** y no accede directamente a Firestore.

## Reglas de aislamiento

1. Cada pantalla importa solo el servicio de su módulo.
2. Las consultas y escrituras de Firestore viven en `src/services`, no en `src/pages`.
3. `src/lib/db.js` existe solo por compatibilidad; en código nuevo no debe importarse.
4. Los componentes en `src/components` son compartidos y no deben contener reglas de un solo módulo.
5. Un cambio en un servicio solo puede exponer cambios a través de sus funciones exportadas.

## Módulos

| Módulo | Pantalla | Servicio | Funcionamiento |
|---|---|---|---|
| Autenticación | `Login.jsx`, `Register.jsx` | `AuthContext` | Sesión, registro y usuario actual. |
| Empresa / tema / notificaciones | compartidos | `CompanyContext`, `ThemeContext`, `ToastContext` | Configuración global de UI y mensajes. |
| Inventario | `Inventory.jsx` | `productService` | Catálogo, precios, costo, stock base e imágenes. |
| Ajustes de inventario | `StockAdjustment.jsx` | `productService`, `movementService` | Entradas, salidas, correlativo y sucursales. |
| Transacciones | `Transactions.jsx` | `transactionService`, `productService` | Historial, edición, reversión y eliminación. |
| Reportes | `Reports.jsx` | `reportService`, `productService` | Consulta por rango, filtros y exportación. |
| Dashboard | `Dashboard.jsx` | `dashboardService`, `productService` | Resumen de entradas, salidas e inventario. |
| Configuración | `Settings.jsx` | `settingsService`, `movementService` | Empresa, usuarios y mantenimiento. |
| Backup | `Backup.jsx` | `backupService` | Exportación de colecciones a JSON. |

## Estado actual

- Las páginas ya no importan `firebase/firestore` directamente.
- `lib/db.js` re-exporta los servicios antiguos para evitar rupturas durante la migración.
- La lógica compartida de productos está en `productService`; la de movimientos en `movementService`; la de historial en `transactionService`.

## Cómo agregar un cambio por módulo

1. Identifica el módulo en la tabla anterior.
2. Cambia o agrega la función en su servicio correspondiente.
3. Actualiza solo la pantalla de ese módulo.
4. Si necesitas datos de otro módulo, importa la función puntual; no copies reglas ni escribas directamente la colección del otro módulo.
