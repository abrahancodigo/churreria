# Rediseño del flujo de entradas y salidas

## Problema

El alta de movimientos vive en `src/pages/StockAdjustment.jsx` como un wizard de 3 pasos
(Tipo → Productos → Confirmar). Funciona, pero cobra caro en cada movimiento y deja
huecos de datos que ya se ven en los comprobantes y reportes.

Hallazgos concretos del código actual:

1. **Proveedor nunca se persiste.** `receipt.js:321` lee `tx.supplier`, pero
   `StockAdjustment.jsx:207` no lo envía. Todo PDF de entrada imprime
   "Proveedor: No especificado".
2. **Sucursal viaja dentro de las notas** (`Sucursal: X | ...`) y se re-parsea con
   regex en `receipt.js:37`, `Reports.jsx:33` y `db.js`. Un espacio de más rompe el reporte.
3. **No existe el motivo.** Compra, merma, traspaso y ajuste se registran idénticos;
   los reportes no pueden separarlos.
4. **Salidas sin validación de stock.** `db.js:322` resta sin verificar; el stock
   puede quedar negativo sin aviso.
5. **Alta repetitiva.** Cantidad vuelve a 1 tras cada producto; no se puede editar
   la cantidad de una línea ya agregada (solo borrarla y rehacerla).
6. **Impresión automática y bloqueante.** `printHtmlDocument` abre una ventana en
   cada guardado. Si el navegador la bloquea, el movimiento ya se guardó y el usuario
   solo ve un toast de error.
7. **Sin borrador.** Un refresh pierde el carrito completo.

## Diseño propuesto

Una sola pantalla en lugar del wizard. El tipo deja de ser un paso y pasa a ser un
control segmentado siempre visible; el resto del formulario se adapta a él.

### Estructura

```
┌─────────────────────────────────────────────────────────┐
│  [ ENTRADA ]  [ SALIDA ]            Folio ENT-0007  ⚙   │
├──────────────────────────────┬──────────────────────────┤
│  Motivo:                     │  RESUMEN                 │
│  (Compra) (Devolución)       │  Partidas      3         │
│  (Traspaso) (Ajuste +)       │  Unidades     44         │
│                              │  Valor    $1,234.00      │
│  Proveedor: [__________]     │                          │
│                              │  ── Carrito ──           │
│  🔍 Buscar producto...       │  Churro clásico   ×24    │
│  ┌────────────────────────┐  │  Cajeta           ×12    │
│  │ Churro clásico  St: 40 │  │  Chocolate         ×8    │
│  └────────────────────────┘  │                          │
│                              │  [Registrar entrada]     │
└──────────────────────────────┴──────────────────────────┘
```

### Cambios por archivo

**`src/pages/StockAdjustment.jsx` — reescritura**

- Segmented control Entrada/Salida arriba, con color por tipo (esmeralda/ámbar).
  Cambiar de tipo conserva el carrito y avisa si hay líneas incompatibles.
- Chips de **motivo** que cambian según el tipo:
  - Entrada: Compra a proveedor · Devolución de cliente · Traspaso recibido · Ajuste positivo · Producción
  - Salida: Traspaso a sucursal · Merma · Consumo interno · Ajuste negativo · Devolución a proveedor
- Campo **Proveedor** (entradas) / **Destino** (salidas), ahora sí persistido.
- **Sucursal** como `<select>` con las sucursales ya conocidas más opción "Otra…"
  que revela un input libre. Se guarda en su propio campo, no en las notas.
- Carrito con **cantidad editable en línea** (input numérico por línea) y subtotal
  por línea. Se elimina el bloqueo por producto duplicado: si ya está, se suma.
- **Validación de stock en vivo**: línea en rojo cuando la cantidad excede la
  existencia. Si alguna línea excede, el botón pide confirmación explícita
  ("Registrar de todos modos") en lugar de bloquear, porque los ajustes negativos
  existen justamente para corregir.
- **Borrador en `localStorage`** con debounce: un refresh no pierde el carrito.
  Se limpia al registrar.
- **Post-guardado sin popup ciego**: modal con el comprobante renderizado y
  acciones *Imprimir* / *Cerrar*. Ya no se abre una ventana sola.
- Atajos: `Enter` en el buscador agrega el primer resultado; `Esc` limpia la búsqueda.

**`src/lib/db.js` — `adjustStock`**

- Aceptar un objeto de opciones en vez de siete posicionales:
  `adjustStock(items, type, userId, { notes, reference, customDate, sucursal, createdBy, reason, party })`.
  Se mantiene la firma vieja como envoltorio para no romper llamadas existentes.
- Persistir `reason` y `party` (proveedor/destino) como campos propios.
- Validar stock dentro de la transacción de Firestore y lanzar error legible si
  una salida deja existencias negativas y no se pidió confirmación.

**`src/lib/receipt.js`**

- Leer `tx.reason` y mostrarlo en los datos generales del comprobante.
- `getSucursal` sigue aceptando el formato viejo de notas para los movimientos ya
  registrados, pero prioriza el campo `sucursal`.

**`src/pages/Reports.jsx`**

- Nueva columna y filtro por **motivo**.
- `getSucursal` local se reemplaza por el helper compartido de `receipt.js`.

**`src/pages/Transactions.jsx`**

- El formulario de edición gana los mismos campos (motivo, proveedor/destino) para
  que editar y crear no se comporten distinto.

## Compatibilidad

Los movimientos ya guardados no se tocan. `reason` y `party` quedan vacíos en los
antiguos y la UI los muestra como "—". El parseo de `Sucursal:` en notas se conserva
como respaldo de lectura.

## Verificación

1. `npx eslint src` limpio.
2. `npm run build` sin errores.
3. Generar un PDF de entrada y otro de salida con Chrome headless y revisar por
   captura que el proveedor, el motivo y la sucursal aparezcan.
4. Probar el caso de salida que excede stock: debe advertir y pedir confirmación.
5. Probar refresh a media captura: el carrito debe sobrevivir.

## Fuera de alcance

No toco el esquema de Firestore más allá de agregar campos opcionales, ni las reglas
de seguridad, ni el módulo de ventas.