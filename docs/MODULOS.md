# Mapa de módulos

La interfaz consume funciones compartidas de acceso a datos. Las consultas
acotadas por periodo viven en `src/services`; el catálogo, las transacciones y
los correlativos se comparten desde `src/lib/db.js`.

## Reglas de aislamiento

1. Cada pantalla importa solo las funciones que necesita.
2. Las consultas nuevas de reportes o tablero deben llevar filtros de servidor y
   límites explícitos.
3. `src/lib/db.js` es la fuente compartida para productos, movimientos y
   correlativos.
4. Los componentes en `src/components` son compartidos y no contienen reglas de
   un solo módulo.
5. Un cambio en un servicio solo puede exponer cambios a través de sus
   funciones exportadas.

## Módulos

| Módulo | Pantalla | Acceso a datos |
|---|---|---|
| Autenticación | `Login.jsx`, `Register.jsx` | `AuthContext` |
| Empresa / notificaciones | compartidos | `CompanyContext`, `ToastContext` |
| Inventario | `Inventory.jsx` | `lib/db.js` |
| Ajustes de inventario | `StockAdjustment.jsx` | `lib/db.js` |
| Transacciones | `Transactions.jsx` | `lib/db.js` |
| Reportes | `Reports.jsx` | `reportService`, `lib/db.js` |
| Dashboard | `Dashboard.jsx` | `dashboardService`, `lib/db.js` |
| Configuración | `Settings.jsx` | Firestore y `lib/db.js` |
| Backup | `Backup.jsx` | Firestore |

## Estado actual

- Dashboard y Reportes consultan solo el periodo solicitado.
- Firestore usa caché persistente entre recargas y pestañas.
- La empresa y el perfil de usuario tienen una sola lectura compartida.
- `Settings.jsx` y `Backup.jsx` todavía contienen operaciones directas de
  Firestore; se pueden mover a servicios si esos módulos crecen.

## Cómo agregar un cambio por módulo

1. Identifica el módulo en la tabla anterior.
2. Cambia o agrega la función en su fuente de datos correspondiente.
3. Actualiza solo la pantalla de ese módulo.
4. Si necesitas datos de otro módulo, importa la función puntual; no copies
   reglas ni escribas directamente la colección del otro módulo.