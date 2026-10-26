import { format } from "date-fns";

// ---------------------------------------------------------------------------
// Generador de comprobantes en formato A4 vertical (documento formal).
// Compartido por Historial (Transactions) y Nuevo movimiento (StockAdjustment).
// ---------------------------------------------------------------------------

export const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------------------------------------------------------------------------
// Tipografia. Se declara una sola vez: la usan tanto el CSS del documento como
// el contenedor de medicion, para que el corte se calcule con el mismo ancho de
// letra con el que se imprime. En mm, como el papel.
// ---------------------------------------------------------------------------

/** Cuerpo impreso: los montos y nombres se leen sin esfuerzo a 13px. */
const BODY_PX = 13;
const BODY_LINE = 1.4;
/** Tabla de partidas en impresion (antes 10.5px, se subio para legibilidad). */
const ITABLE_PX = 12;
const ITABLE_LINE = 1.32;

export const getUnitPrice = (tx, item) => {
    const isMovement = tx.type === "entry" || tx.type === "exit";
    return isMovement ? Number(item.cost || 0) : Number(item.price || 0);
};

export const getPrintTotal = (tx) => {
    if (!tx?.items) return Number(tx?.total || 0);
    return tx.items.reduce((acc, item) => acc + getUnitPrice(tx, item) * Number(item.quantity || 0), 0);
};

export const getSucursal = (tx) => {
    // El campo propio manda. El parseo de notas queda solo como respaldo para
    // los movimientos registrados antes de que existiera la columna.
    if (tx.sucursal) return tx.sucursal;
    if (!tx.notes) return null;
    const m = tx.notes.match(/Sucursal:\s*([^|]+)/i);
    return m ? m[1].trim() : null;
};

// ---------------------------------------------------------------------------
// Metricas del papel (en milimetros). Deben coincidir con el CSS de abajo:
// `@page margin` + ultimas reglas de `@media print`.
// ---------------------------------------------------------------------------

/** Alto de hoja A4 menos los margenes superior e inferior (297 - 9 - 9). */
export const PAGE_CONTENT_MM = 279;
/** Colchon para absorber el redondeo de sub-pixeles del motor de impresion. */
const SAFETY_MM = 2;
/**
 * Alto de un renglon de la tabla de partidas: `font-size` x `line-height` del
 * CSS menos un pixel de redondeo (12px x 1.32 = 15.84px = 4.19mm).
 */
const ROW_LINE_MM = 4.2;
/** Relleno vertical de una fila: 0.9mm arriba + 0.9mm abajo + borde 1px. */
const ROW_PADDING_MM = 2.2;
/**
 * Renglones estimados de un nombre de producto para la division inicial. Es
 * solo una referencia: `fitSheets` mide cada fila real antes de imprimir.
 */
const MAX_NAME_LINES = 2;
/** Alto del encabezado de la tabla (solo para el corte, no para el relleno). */
const TABLE_HEAD_MM = 6.2;
/**
 * Piezas fijas del final de hoja: resumen + observaciones + firmas + pie. Solo
 * se usa para reservar espacio al decidir el corte.
 */
const TAIL_MM = 52;
/** Encabezado + titulo + datos generales de cada hoja. */
const HEADER_MM = 51;
/** Espaciador minimo de la tabla de cada hoja (evita quedar al limite exacto). */
const MIN_SPACER_MM = 3;

/**
 * Repagina las hojas midiendo el alto real de cada fila y ajusta el espaciador
 * de cada hoja para que ocupe exactamente el area imprimible.
 *
 * La cantidad de filas por hoja no se estima: se insertan una por una y se mide
 * la hoja. Si la fila no cabe, se mueve a la hoja siguiente (creandola si hace
 * falta). Asi un nombre de producto de 2, 3 o mas lineas nunca desborda ni
 * obliga a imprimir una hoja extra. Es idempotente: se puede ejecutar al cargar
 * el documento y otra vez cuando terminan de cargar las imagenes.
 *
 * @param {Document} doc Documento que contiene las hojas (la ventana de
 *   impresion o el iframe de vista previa).
 * @param {number} contentMm Alto del area imprimible del papel.
 * @param {number} safetyMm Colchon para el redondeo de sub-pixeles.
 * @returns {Array<{sheetMm:number,tableMm:number,spacerMm:number}>|null} Medidas
 *   finales de cada hoja, o `null` si no hay hojas que ajustar.
 */
export const fitSheets = (doc, contentMm = PAGE_CONTENT_MM, safetyMm = SAFETY_MM) => {
    if (!doc) return null;
    const sheets = [...doc.querySelectorAll("div.sheet")];
    if (!sheets.length) return null;

    const pxToMm = 25.4 / 96;
    const maxMm = contentMm - safetyMm;
    const heightMm = (node) => (node ? node.getBoundingClientRect().height * pxToMm : 0);
    const parent = sheets[0].parentNode;

    // Todas las filas reales, en orden. Incluye la fila "sin productos".
    const rows = [];
    for (const sheet of sheets) {
        for (const tr of sheet.querySelectorAll("table.items tbody tr")) {
            if (!tr.classList.contains("spacer")) rows.push(tr);
        }
    }
    const itemCount = rows.filter((tr) => !tr.classList.contains("empty-row")).length;

    // La ultima hoja sirve de plantilla: ya trae encabezado, firmas y el
    // resumen/observaciones que solo debe mostrar la hoja final.
    const template = sheets[sheets.length - 1].cloneNode(true);
    for (const sheet of sheets) sheet.remove();

    const makePage = () => {
        const page = template.cloneNode(true);
        const tbody = page.querySelector("table.items tbody");
        for (const tr of [...tbody.querySelectorAll("tr")]) {
            if (!tr.classList.contains("spacer")) tr.remove();
        }
        // Se mide siempre con el resumen visible: reserva su espacio en todas
        // las hojas y luego se oculta en las que no son la ultima.
        const tail = page.querySelector(".sheet-tail");
        if (tail) tail.style.display = "";
        const td = tbody.querySelector("tr.spacer td");
        if (td) td.style.height = "0mm";
        parent.appendChild(page);
        return page;
    };

    const pages = [makePage()];
    let pageIndex = 0;
    let rowIndex = 0;
    while (rowIndex < rows.length) {
        const page = pages[pageIndex];
        const tbody = page.querySelector("table.items tbody");
        const spacer = tbody.querySelector("tr.spacer");
        tbody.insertBefore(rows[rowIndex], spacer);
        const td = spacer.querySelector("td");
        if (td) td.style.height = "0mm";

        // Si la fila no cabe y la hoja ya tenia contenido, se pasa a la
        // siguiente. Una fila sola mas alta que la hoja se deja igual para no
        // perder datos.
        const onlyRow = tbody.querySelectorAll("tr:not(.spacer)").length === 1;
        if (heightMm(page) > maxMm && !onlyRow) {
            tbody.removeChild(rows[rowIndex]);
            pageIndex += 1;
            pages.push(makePage());
            continue;
        }
        rowIndex += 1;
    }

    return pages.map((page, i) => {
        const isLast = i === pages.length - 1;
        const tail = page.querySelector(".sheet-tail");
        if (tail) tail.style.display = isLast ? "" : "none";

        const used = [...page.querySelectorAll("table.items tbody tr:not(.spacer)")];
        const nums = used
            .filter((tr) => !tr.classList.contains("empty-row"))
            .map((tr) => (tr.querySelector("td.num")?.textContent || "").trim())
            .filter(Boolean);
        const range = nums.length ? `${nums[0]}-${nums[nums.length - 1]}` : "-";
        const pageLabel = pages.length > 1 ? `Página ${i + 1} de ${pages.length}` : "";

        const rangeLabel = page.querySelector(".range-label");
        if (rangeLabel) rangeLabel.textContent = `Partidas ${range} de ${itemCount}`;
        const pageTag = page.querySelector(".page-tag");
        if (pageTag) pageTag.textContent = pageLabel;
        const legalPage = page.querySelector(".legal-page");
        if (legalPage) {
            legalPage.textContent = pages.length > 1
                ? `${pageLabel} · Partidas ${range} de ${itemCount} · `
                : "";
        }

        const td = page.querySelector("tr.spacer td");
        if (td) td.style.height = "0mm";
        const missing = maxMm - heightMm(page);
        if (td) td.style.height = `${Math.max(0, missing).toFixed(2)}mm`;

        return {
            sheetMm: +heightMm(page).toFixed(2),
            tableMm: +heightMm(page.querySelector("table.items")).toFixed(2),
            spacerMm: td ? +(parseFloat(td.style.height) || 0).toFixed(2) : 0,
        };
    });
};

/**
 * Mide, en milimetros, el alto total de una hoja ya renderizada y el de su
 * tabla, para poder calcular el espaciador que la lleva justo al borde
 * inferior del papel. Se ejecuta despues de montar las hojas en el documento y
 * en modo `print`, que es exactamente el medio que usa la impresora.
 */
export const measureSheets = () => {
    if (typeof document === "undefined") return null;
    const sheets = [...document.querySelectorAll("div.sheet")];
    if (!sheets.length) return null;
    const pxToMm = 25.4 / 96;
    const mm = (node) => (node ? node.getBoundingClientRect().height * pxToMm : 0);
    return sheets.map((sheet) => {
        const td = sheet.querySelector("tr.spacer td");
        return {
            sheetMm: mm(sheet),
            tableMm: mm(sheet.querySelector("table.items")),
            spacerMm: td ? parseFloat(td.style.height) || 0 : 0,
        };
    });
};

/**
 * Primera division de las filas en hojas. Es solo una estimacion de arranque
 * para que el HTML sea valido sin JavaScript; `fitSheets` la rehace midiendo
 * cada fila real, de modo que nombres largos no desbordan la hoja.
 */
const paginateItems = (itemRows) => {
    const rows = itemRows.length ? itemRows : [{ index: 0, html: EMPTY_ROW_HTML }];
    const content = PAGE_CONTENT_MM;
    /**
     * Piezas fijas de cada hoja sin partidas: encabezado, titulo, datos, corte,
     * firmas y pie. Es solo una reserva inicial: el navegador mide la hoja real
     * y corrige el espaciador, pero esta cifra debe ser igual o mayor que el
     * alto real para que el primer render nunca desborde.
     */
    const chromeMm = HEADER_MM + TABLE_HEAD_MM + TAIL_MM + 12;
    /**
     * Alto estimado de una fila (nombre de dos renglones). El corte definitivo
     * lo decide `fitSheets` con el alto medido, no esta estimacion.
     */
    const maxRowMm = ROW_LINE_MM * MAX_NAME_LINES + ROW_PADDING_MM;

    /** Filas que caben en una hoja sin pasar del area imprimible. */
    const capacity = Math.max(
        1,
        Math.floor((content - SAFETY_MM - chromeMm - MIN_SPACER_MM) / maxRowMm)
    );

    /**
     * Espaciador de reserva. Es provisional: `fitSheets` lo recalcula con el
     * alto medido de cada hoja antes de imprimir.
     */
    const fillerHeight = (used) =>
        Math.max(MIN_SPACER_MM, content - SAFETY_MM - chromeMm - used * maxRowMm);

    const pages = [];
    let index = 0;
    // Se crea una hoja solo si quedan partidas: antes la condicion
    // `pages.length === 0` agregaba una hoja extra sin partidas cuando el total
    // era multiplo exacto de la capacidad.
    while (index < rows.length) {
        pages.push({ rows: rows.slice(index, index + capacity) });
        index += capacity;
    }
    if (pages.length === 0) pages.push({ rows: [] });

    return pages.map((page, i) => {
        // El relleno no usa filas: es un unico espacio flexible que empuja el
        // corte, las firmas y el pie hasta el borde inferior de la hoja. Asi su
        // alto es exacto y no depende de la altura minima de cada fila (que
        // hacia crecer la tabla y provocaba una pagina extra al imprimir).
        return {
            ...page,
            number: i + 1,
            total: pages.length,
            isLast: i === pages.length - 1,
            fillerMm: fillerHeight(page.rows.length),
            range: page.rows.length ? `${page.rows[0].index}-${page.rows[page.rows.length - 1].index}` : "-",
        };
    });
};

const EMPTY_ROW_HTML = `<tr class="empty-row"><td colspan="6">Sin productos registrados en este movimiento</td></tr>`;

/** Construye una fila de la tabla de productos. */
const buildItemRow = (tx, item, number) => {
    const unit = getUnitPrice(tx, item);
    const lineTotal = unit * Number(item.quantity || 0);
    return `<tr>
                <td class="c num">${number}</td>
                <td class="c code">${escapeHtml(item.sku || item.barcode || "--")}</td>
                <td class="name">${escapeHtml(item.name || "Sin nombre")}</td>
                <td class="c">${escapeHtml(item.quantity)}</td>
                <td class="r">$${unit.toFixed(2)}</td>
                <td class="r strong">$${lineTotal.toFixed(2)}</td>
            </tr>`;
};

/**
 * Construye el HTML del comprobante A4.
 *
 * Si el movimiento no cabe en una hoja, se generan varias: cada hoja repite el
 * encabezado completo (empresa, folio, titulo y datos del movimiento), las tres
 * firmas y el pie de pagina, e indica "Página N de M" junto con el rango de
 * partidas que contiene. El resumen y las observaciones cierran la ultima.
 *
 * @param {object} tx Movimiento: { type, items, total, notes, reference, sucursal, timestamp,
 *                                userName | createdBy, supplier, provider, destination, customerName }
 * @param {object} company Datos de la empresa: { name, address, phone, logoUrl }
 */
export const buildReceiptHtml = (tx, company = {}) => {
    const isEntry = tx.type === "entry";
    const isExit = tx.type === "exit";
    const isMovement = isEntry || isExit;
    const docTitle = isEntry ? "REGISTRO DE ENTRADA AL ALMACÉN" : isExit ? "REGISTRO DE SALIDA DEL ALMACÉN" : "NOTA DE VENTA";
    const docCode = isEntry ? "ENT" : isExit ? "SAL" : "NV";
    const dateObj = tx.timestamp?.toDate ? tx.timestamp.toDate() : (tx.timestamp instanceof Date ? tx.timestamp : null);
    const date = dateObj ? format(dateObj, "dd/MM/yyyy HH:mm") : "--";
    const dateOnly = dateObj ? format(dateObj, "dd/MM/yyyy") : "--";
    const generatedAt = format(new Date(), "dd/MM/yyyy HH:mm");
    const sucursal = getSucursal(tx);
    const total = getPrintTotal(tx);
    const items = tx.items || [];
    const itemCount = items.length;
    const units = items.reduce((a, i) => a + Number(i.quantity || 0), 0);
    const totalLabel = isMovement ? "VALOR TOTAL" : "TOTAL";
    const kindLabel = isEntry ? "Entrada de mercancía" : isExit ? "Salida de mercancía" : "Venta";
    const partyLabel = isEntry ? "Proveedor" : isExit ? "Destino" : "Cliente";
    const party = tx.party || tx.supplier || tx.provider || tx.destination || tx.customerName
        || (isExit ? sucursal : "") || "No especificado";
    // Motivo del movimiento (compra, merma, traspaso...). Los registros viejos
    // no lo tienen: se muestra un guion en lugar de inventarlo.
    const reason = String(tx.reason || "").trim() || "—";
    const registeredBy = tx.userName || tx.createdBy || "Sistema";
    const companyName = company.name || "Mi Negocio";
    const folio = escapeHtml(tx.reference || `${docCode}-${format(dateObj || new Date(), "yyyyMMddHHmmss")}`);
    const itemRows = items.map((item, index) => ({ index: index + 1, html: buildItemRow(tx, item, index + 1) }));

    // Muestra de las piezas fijas: se mide para saber cuántas filas caben por hoja.
    const styles = receiptStyles();

    const detailHeader = () => `
    <div class="head">
        <div class="head-left">
            <div class="brand">
                ${company.logoUrl ? `<img class="logo" src="${escapeHtml(company.logoUrl)}" alt="Logo" />` : ""}
                <div>
                    <div class="company">${escapeHtml(companyName)}</div>
                    ${company.address ? `<div class="tagline">${escapeHtml(company.address)}</div>` : ""}
                    ${company.phone ? `<div class="tagline">Tel. ${escapeHtml(company.phone)}</div>` : ""}
                </div>
            </div>
        </div>
        <div class="head-right">
            <div class="folio-box">
                <div class="folio-label">Folio</div>
                <div class="folio-value">${folio}</div>
            </div>
        </div>
    </div>`;

    const generalData = () => `
    <div class="title-block">
        <div class="title">${docTitle}</div>
        <div class="subtitle">Comprobante de movimiento de inventario</div>
    </div>

    <div class="grid">
        <div class="grid-row">
            <div class="grid-cell"><span class="k">Tipo de movimiento</span><div class="v">${kindLabel}</div></div>
            <div class="grid-cell"><span class="k">Motivo</span><div class="v">${escapeHtml(reason)}</div></div>
        </div>
        <div class="grid-row">
            <div class="grid-cell"><span class="k">Fecha y hora</span><div class="v">${escapeHtml(date)}</div></div>
            <div class="grid-cell"><span class="k">Sucursal / Ubicación</span><div class="v">${escapeHtml(sucursal || "No especificada")}</div></div>
        </div>
        <div class="grid-row">
            <div class="grid-cell"><span class="k">${partyLabel}</span><div class="v">${escapeHtml(party)}</div></div>
            <div class="grid-cell"><span class="k">Registrado por</span><div class="v">${escapeHtml(registeredBy)}</div></div>
        </div>
    </div>`;

    const tailHtml = `
    <div class="sheet-tail">
    <div class="summary">
        <div class="summary-left">
            <div class="info-box">
                <span class="k">Resumen del movimiento</span>
                <div class="info-line"><span>Partidas distintas</span><strong>${itemCount}</strong></div>
                <div class="info-line"><span>Unidades totales</span><strong>${units}</strong></div>
                <div class="info-line"><span>Fecha del registro</span><strong>${escapeHtml(dateOnly)}</strong></div>
                <div class="info-line"><span>Registrado por</span><strong>${escapeHtml(registeredBy)}</strong></div>
            </div>
        </div>
        <div class="summary-right">
            <table class="total">
                <tr><td class="lbl">Subtotal</td><td class="val">$${total.toFixed(2)}</td></tr>
                <tr><td class="lbl">${isMovement ? "Otros cargos" : "Impuestos"}</td><td class="val">$0.00</td></tr>
                <tr class="grand"><td>${totalLabel}</td><td class="val">$${total.toFixed(2)}</td></tr>
            </table>
        </div>
    </div>

    <div class="notes-block">
        <span class="k">Observaciones</span>
        <div class="notes-text">${tx.notes ? escapeHtml(tx.notes) : "Sin observaciones adicionales."}</div>
    </div>
    </div>`;

    /**
     * Una hoja completa. Las hojas de continuación llevan encabezado compacto y
     * solo el corte + firmas; el resumen/observaciones van en la última hoja.
     */
    const renderSheet = (page) => {
        const pageLabel = page.total > 1 ? `Página ${page.number} de ${page.total}` : "";
        return `
<div class="sheet">
    ${detailHeader()}
    ${generalData()}

    <table class="items">
        <thead>
            <tr>
                <th class="num c">#</th>
                <th class="code">Código</th>
                <th>Descripción del producto</th>
                <th class="qty-col c">Cant.</th>
                <th class="money r">${isMovement ? "Costo unit." : "Precio unit."}</th>
                <th class="money r">Importe</th>
            </tr>
        </thead>
        <tbody>
            ${page.rows.map((row) => row.html).join("")}
            <tr class="spacer" aria-hidden="true"><td colspan="6" style="height:${page.fillerMm.toFixed(2)}mm"></td></tr>
        </tbody>
    </table>

    <div class="pagination-note">
        <span class="range-label">Partidas ${page.range} de ${itemCount}</span>
        <span class="page-tag">${pageLabel}</span>
    </div>

    ${page.isLast ? tailHtml : ""}

    <div class="page-split">
        <div class="signs">
            <div class="sign"><div class="sign-line"></div><div class="sign-role">${isMovement ? "Entregó" : "Atendió"}</div></div>
            <div class="sign"><div class="sign-line"></div><div class="sign-role">${isMovement ? "Recibió" : "Cliente"}</div></div>
            <div class="sign"><div class="sign-line"></div><div class="sign-role">Autorizó</div></div>
        </div>

        <div class="legend">Nombre y firma de las personas responsables del movimiento</div>

        <div class="legal">
            Documento generado electrónicamente el ${escapeHtml(generatedAt)} por ${escapeHtml(companyName)}.<br />
            <span class="legal-page">${pageLabel ? `${pageLabel} · Partidas ${page.range} de ${itemCount} · ` : ""}</span>Este comprobante ampara el movimiento descrito y forma parte del control interno de inventario.
        </div>
    </div>
</div>`;
    };

    // La division inicial es solo una estimacion: `fitSheets` mide las filas
    // reales, las redistribuye entre hojas y ajusta el espaciador al cargar el
    // documento (y otra vez al terminar de cargar las imagenes).
    const pages = paginateItems(itemRows);
    return `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${docTitle} ${folio}</title>
${styles}
</head><body>
${pages.map(renderSheet).join("\n")}
<script>
(function () {
    var fit = ${fitSheets.toString()};
    var run = function () { try { fit(document, ${PAGE_CONTENT_MM}, ${SAFETY_MM}); } catch (e) { /* sin JS se imprime la division inicial */ } };
    run();
    if (document.readyState !== "complete") window.addEventListener("load", run);
})();
</script>
</body></html>`;
};

const receiptStyles = () => `<style>
@page { size: A4 portrait; margin: 9mm 12mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #fff; color: #111; }
body {
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: ${BODY_PX}px; line-height: ${BODY_LINE};
    max-width: 210mm; margin: 0 auto; padding: 8mm 12mm;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.sheet { width: 100%; }
.sheet + .sheet { margin-top: 8mm; padding-top: 6mm; border-top: 1px dashed #bbb; }
/* ---------- Encabezado: compacto para dejar mas renglones a la tabla ---------- */
.head { display: table; width: 100%; border-bottom: 2px solid #111; padding-bottom: 1.6mm; }
.head-left, .head-right { display: table-cell; vertical-align: middle; }
.head-left { width: 68%; }
.head-right { width: 32%; text-align: right; }
.brand { display: flex; align-items: center; gap: 2.5mm; }
.logo { max-height: 12mm; max-width: 22mm; object-fit: contain; }
.company { font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; color: #111; line-height: 1.15; }
.tagline { font-size: ${BODY_PX}px; color: #555; margin-top: .2mm; line-height: 1.25; }
.folio-box { border: 1.5px solid #111; border-radius: 2mm; padding: 1mm 3mm; display: inline-block; text-align: center; }
.folio-label { font-size: 9.5px; letter-spacing: .8px; text-transform: uppercase; color: #555; font-weight: 600; }
.folio-value { font-size: 14px; font-weight: 700; font-family: "Courier New", monospace; margin-top: .2mm; }
/* ---------- Titulo ---------- */
.title-block { text-align: center; margin: 2mm 0 1.8mm; }
.title { font-size: 14.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; line-height: 1.2; }
.subtitle { font-size: 11px; color: #666; margin-top: .2mm; letter-spacing: .2px; }
/* ---------- Datos generales ---------- */
.grid { display: table; width: 100%; border-collapse: collapse; margin-bottom: 2mm; }
.grid-row { display: table-row; }
.grid-cell { display: table-cell; width: 50%; border: 1px solid #ccc; padding: 1mm 2.2mm; vertical-align: top; line-height: 1.25; }
.grid-cell .k { font-size: 9px; text-transform: uppercase; letter-spacing: .7px; color: #666; font-weight: 600; }
.grid-cell .v { font-size: ${BODY_PX}px; font-weight: 600; margin-top: .1mm; }
/* ---------- Tabla de productos ---------- */
table.items { width: 100%; border-collapse: collapse; }
table.items thead { display: table-header-group; }
/* Encabezado de la tabla: gris sutil y letra negra para ahorrar tinta
   (antes fondo negro solido con letra blanca). */
table.items th {
    background: #ececec; color: #111; font-size: 11px; text-transform: uppercase;
    letter-spacing: .5px; padding: 1.2mm 1.8mm; text-align: left; font-weight: 700;
    border-bottom: 1px solid #999;
}
table.items td {
    border-bottom: 1px solid #ddd; padding: .9mm 1.8mm; vertical-align: top;
    font-size: ${ITABLE_PX}px; line-height: ${ITABLE_LINE};
}
table.items td.name { font-weight: 500; }
table.items tr:nth-child(even) td { background: #f7f7f7; }
table.items tr { page-break-inside: avoid; }
/* Espaciador: empuja el corte, firmas y pie hasta el final de la hoja */
table.items tr.spacer td { padding: 0; border-bottom: 0; background: #fff; }
table.items tr.spacer { page-break-inside: avoid; }
th.num, td.num { width: 10mm; }
th.code, td.code { width: 25mm; }
th.qty-col, td.qty-col { width: 15mm; }
th.money, td.money { width: 25mm; }
.c { text-align: center; }
.r { text-align: right; white-space: nowrap; }
.code { font-family: "Courier New", monospace; font-size: 11.5px; color: #444; }
.strong { font-weight: 700; }
.name { word-break: break-word; }
.empty-row td { text-align: center; color: #888; padding: 4mm 2mm; font-size: ${ITABLE_PX}px; }
/* ---------- Nota de paginacion ---------- */
.pagination-note {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 10px; color: #777; padding: .8mm 1mm 0; text-transform: uppercase; letter-spacing: .4px;
}
.pagination-note .page-tag { font-weight: 700; color: #333; }
/* ---------- Resumen ---------- */
.summary { display: table; width: 100%; margin-top: 2mm; page-break-inside: avoid; }
.summary-left { display: table-cell; width: 55%; vertical-align: top; padding-right: 5mm; }
.summary-right { display: table-cell; width: 45%; vertical-align: top; }
.info-box { border: 1px solid #ccc; padding: 1.6mm 2.4mm; font-size: ${BODY_PX}px; line-height: 1.25; }
.info-box .k { font-size: 9px; text-transform: uppercase; letter-spacing: .7px; color: #666; font-weight: 600; display: block; margin-bottom: .6mm; }
.info-line { display: flex; justify-content: space-between; padding: .35mm 0; }
.info-line + .info-line { border-top: 1px dotted #ddd; }
table.total { width: 100%; border-collapse: collapse; }
table.total td { padding: 1mm 1.8mm; font-size: ${BODY_PX}px; }
table.total td.lbl { color: #555; }
table.total td.val { text-align: right; font-family: "Courier New", monospace; font-weight: 600; }
table.total tr.grand td { border-top: 2px solid #111; border-bottom: 2px solid #111; font-size: 14px; font-weight: 700; padding: 1.4mm 1.8mm; }
/* ---------- Observaciones ---------- */
.notes-block { margin-top: 2.4mm; page-break-inside: avoid; }
.notes-block .k { font-size: 9px; text-transform: uppercase; letter-spacing: .7px; color: #666; font-weight: 600; }
.notes-text { border: 1px solid #ccc; border-left: 3px solid #111; padding: 1.6mm 2.4mm; margin-top: .8mm; font-size: ${BODY_PX}px; min-height: 8mm; word-break: break-word; }
/* ---------- Firmas y pie: se repiten en todas las hojas ---------- */
.page-split { page-break-inside: avoid; }
.signs { display: table; width: 100%; margin-top: 6mm; }
.sign { display: table-cell; width: 33.33%; text-align: center; padding: 0 4mm; font-size: 10.5px; color: #444; }
.sign-line { border-bottom: 1px solid #111; height: 7.5mm; margin-bottom: 1mm; }
.sign-role { font-weight: 700; text-transform: uppercase; letter-spacing: .5px; font-size: 10px; color: #222; }
.legend { text-align: center; font-size: 9.5px; color: #555; margin-top: 1.2mm; }
.legal { border-top: 1px solid #ddd; margin-top: 1.6mm; padding-top: 1.2mm; font-size: 9.5px; color: #777; text-align: center; line-height: 1.35; }
@media print {
    /* La tipografia impresa debe ser la misma que se usa para medir el corte:
       si cambiara aqui, el espaciador quedaria corto y el pie se iria a otra hoja. */
    html, body { max-width: none; margin: 0; padding: 0; font-size: ${BODY_PX}px; line-height: ${BODY_LINE}; }
    /* Cada hoja ocupa exactamente un pliego: sin margenes ni relleno que la
       desborden. No se usa break-inside:avoid porque el contenido ya viene
       paginado y esa regla impedia compactar y empujaba el pie a otra hoja. */
    div.sheet {
        width: 186mm;
        margin: 0;
        padding: 0;
        border: 0;
        break-after: page;
        page-break-after: always;
    }
    div.sheet + div.sheet { margin: 0; padding: 0; border: 0; }
    div.sheet:last-of-type { break-after: auto; page-break-after: auto; }
    table.items td { font-size: ${ITABLE_PX}px; line-height: ${ITABLE_LINE}; }
}
</style>`;

/**
 * Abre el comprobante en una pestaña nueva SIN lanzar el diálogo de impresión.
 *
 * Sirve para "Descargar PDF": el navegador no puede escribir un PDF binario
 * desde el cliente sin una librería extra, pero sí puede guardarlo desde su
 * propio visor. Al dejar el documento abierto y enfocado, el usuario pulsa
 * Ctrl/Cmd+P y elige "Guardar como PDF" (o el botón que ya trae el visor).
 *
 * Devuelve `true` si la pestaña se abrió.
 */
export const openHtmlDocument = (html) => {
    let win = null;
    try {
        win = window.open("", "_blank", "width=900,height=980,left=60,top=40");
    } catch {
        win = null;
    }
    if (!win) return false;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    return true;
};

export const printHtmlDocument = (html, fallbackFrame = null) => {
    let win = null;
    try {
        win = window.open("", "_blank", "width=900,height=980,left=60,top=40");
    } catch {
        win = null;
    }

    if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => {
            try {
                win.focus();
                win.print();
            } finally {
                setTimeout(() => { try { win.close(); } catch { /* noop */ } }, 1000);
            }
        }, 350);
        return true;
    }

    const idoc = fallbackFrame?.contentWindow?.document;
    if (!idoc) return false;

    idoc.open();
    idoc.write(html);
    idoc.close();
    setTimeout(() => {
        try {
            fallbackFrame.contentWindow.focus();
            fallbackFrame.contentWindow.print();
        } catch {
            /* el navegador rechazó el diólogo de impresión */
        }
    }, 350);
    return true;
};


