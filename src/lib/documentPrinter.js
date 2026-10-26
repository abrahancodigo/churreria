const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const formatMoney = (value) => Number(value || 0).toLocaleString('es-MX', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const toDate = (value) => {
  if (!value) return new Date();
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000));
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const cleanText = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  // Firestore ids are technical identifiers, not useful document data.
  if (/^[A-Za-z0-9_-]{20,}$/.test(text)) return '';
  return text;
};

const buildDocumentHtml = (data, companyInfo) => {
  const isMovement = data.type === 'ENTRY' || data.type === 'EXIT';
  const title = data.type === 'ENTRY'
    ? 'Entrada de Almacén'
    : data.type === 'EXIT'
      ? 'Salida de Almacén'
      : 'Nota de Venta';

  const date = toDate(data.date);
  const dateLabel = date.toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
  const timeLabel = date.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit'
  });

  const sucursalMatch = (data.notes || '').match(/Sucursal:\s*([^|]+)/i);
  const sucursal = cleanText(data.sucursal || (sucursalMatch ? sucursalMatch[1] : ''));
  const notes = (data.notes || '').replace(/Sucursal:\s*[^|]+\|?\s*/i, '').trim();
  const valueUnitKey = isMovement ? 'cost' : 'price';
  const folio = cleanText(data.reference || data.id) || 'N/A';
  const userLabel = cleanText(data.user || data.userName) || 'Sistema';

  const rows = (data.items || []).map((item, index) => {
    const quantity = Number(item.quantity || 0);
    const unitValue = Number(item[valueUnitKey] || 0);
    const amount = quantity * unitValue;

    return `
      <tr>
        <td class="cell-index">${index + 1}</td>
        <td class="cell-product">
          <span class="product-name">${escapeHtml(item.name)}</span>
          ${item.sku ? `<span class="product-sku">SKU ${escapeHtml(item.sku)}</span>` : ''}
        </td>
        <td class="cell-number">${quantity.toLocaleString('es-MX')}</td>
        <td class="cell-number">$${formatMoney(unitValue)}</td>
        <td class="cell-number">$${formatMoney(amount)}</td>
      </tr>
    `;
  }).join('');

  const calculatedTotal = (data.items || []).reduce((sum, item) => (
    sum + Number(item.quantity || 0) * Number(item[valueUnitKey] || 0)
  ), 0);
  const total = calculatedTotal || Number(data.total || 0);
  const totalUnits = (data.items || []).reduce((sum, item) => (
    sum + Number(item.quantity || 0)
  ), 0);

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title)} ${escapeHtml(data.id || '')}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 14mm 12mm 16mm;
        }

        :root {
          --ink: #172033;
          --muted: #64748b;
          --line: #e2e8f0;
          --brand: #2551eb;
          --brand-dark: #1d3fd8;
          --brand-soft: #eef4ff;
        }

        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        html, body {
          width: 100%;
          height: auto;
          min-height: 0;
          margin: 0;
          padding: 0;
          overflow: visible;
          background: #fff;
          color: var(--ink);
          font-family: Arial, Helvetica, sans-serif;
          font-size: 10.5pt;
          line-height: 1.45;
        }

        .document { width: 100%; max-width: 186mm; margin: 0 auto; }

        .brand-band {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 20px 24px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          color: #111827;
          background: #f1f5f9;
        }

        .brand { display: flex; align-items: center; gap: 14px; min-width: 0; }

        .logo {
          width: 52px;
          height: 52px;
          object-fit: contain;
          border-radius: 10px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          padding: 4px;
        }

        .company-name {
          margin: 0;
          font-size: 16.5pt;
          font-weight: 700;
          letter-spacing: -.02em;
        }

        .company-address { margin: 2px 0 0; color: #475569; font-size: 8.5pt; }

        .document-type { text-align: right; white-space: nowrap; }

        .document-type strong {
          display: block;
          font-size: 15pt;
          letter-spacing: -.01em;
        }

        .document-type span { display: block; margin-top: 3px; color: #475569; font-size: 8.5pt; }

        .meta {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin: 16px 0 18px;
        }

        .meta-item {
          min-width: 0;
          padding: 10px 12px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: #f8fafc;
        }

        .meta-label {
          display: block;
          margin-bottom: 3px;
          color: var(--muted);
          font-size: 7.5pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .06em;
        }

        .meta-value {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 9.5pt;
          font-weight: 650;
        }

        .section-title { margin: 22px 0 8px; font-size: 10.5pt; font-weight: 700; }

        table { width: 100%; border-collapse: collapse; table-layout: fixed; }

        thead th {
          background: var(--brand-soft);
          color: #1e3a8a;
          border-bottom: 1px solid #c7d7fe;
          padding: 9px 10px;
          font-size: 7.8pt;
          text-align: left;
          text-transform: uppercase;
          letter-spacing: .05em;
        }

        tbody td { border-bottom: 1px solid var(--line); padding: 10px; vertical-align: top; }
        tbody tr:nth-child(even) td { background: #fcfdff; }

        .cell-index { width: 8%; color: var(--muted); }
        .cell-product { width: 45%; }
        .cell-number { width: 16%; text-align: right; white-space: nowrap; }

        .product-name { display: block; font-weight: 650; }
        .product-sku { display: block; margin-top: 2px; color: var(--muted); font-size: 8pt; }

        .summary { display: flex; justify-content: flex-end; margin-top: 18px; }

        .summary-box {
          width: 230px;
          padding: 14px 16px;
          border: 1px solid #c7d7fe;
          border-radius: 10px;
          background: var(--brand-soft);
        }

        .summary-row { display: flex; justify-content: space-between; gap: 16px; font-size: 9.5pt; }
        .summary-row + .summary-row { margin-top: 6px; }

        .summary-total {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #c7d7fe;
          font-size: 13pt;
          font-weight: 750;
        }

        .notes {
          margin-top: 18px;
          padding: 12px 14px;
          border-left: 4px solid var(--brand);
          border-radius: 6px;
          background: #f8fafc;
        }

        .notes-label {
          display: block;
          margin-bottom: 3px;
          color: var(--muted);
          font-size: 7.5pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .06em;
        }

        .signatures {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 42px;
          margin-top: 52px;
          page-break-inside: avoid;
        }

        .signature-line { border-bottom: 1px solid #94a3b8; height: 34px; }

        .signature-label {
          margin-top: 6px;
          text-align: center;
          color: var(--muted);
          font-size: 8pt;
          font-weight: 650;
        }

        .footer {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin-top: 34px;
          padding-top: 10px;
          border-top: 1px solid var(--line);
          color: var(--muted);
          font-size: 7.8pt;
          page-break-inside: avoid;
        }

        @media print {
          html, body { width: auto; height: auto; }
          .document { max-width: none; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <main class="document">
        <header class="brand-band">
          <div class="brand">
            ${companyInfo.logoUrl ? `<img class="logo" src="${escapeHtml(companyInfo.logoUrl)}" alt="Logo" />` : ''}
            <div>
              <h1 class="company-name">${escapeHtml(companyInfo.name || 'Mi Tienda')}</h1>
              ${companyInfo.address ? `<p class="company-address">${escapeHtml(companyInfo.address)}</p>` : ''}
            </div>
          </div>
          <div class="document-type">
            <strong>${escapeHtml(title)}</strong>
            <span>Documento de control interno</span>
          </div>
        </header>

        <section class="meta">
          <div class="meta-item">
            <span class="meta-label">Folio</span>
            <span class="meta-value">${escapeHtml(folio)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Fecha</span>
            <span class="meta-value">${escapeHtml(dateLabel)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Hora</span>
            <span class="meta-value">${escapeHtml(timeLabel)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">${isMovement ? (sucursal ? 'Sucursal' : 'Usuario') : 'Cliente'}</span>
            <span class="meta-value">${escapeHtml(sucursal || (isMovement ? 'Almacén central' : 'Cliente general'))}</span>
          </div>
        </section>

        <h2 class="section-title">Detalle de artículos</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Producto</th>
              <th class="cell-number">Cantidad</th>
              <th class="cell-number">Costo unit.</th>
              <th class="cell-number">Importe</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <section class="summary">
          <div class="summary-box">
            <div class="summary-row"><span>Artículos</span><strong>${(data.items || []).length}</strong></div>
            <div class="summary-row"><span>Unidades</span><strong>${totalUnits.toLocaleString('es-MX')}</strong></div>
            <div class="summary-row summary-total"><span>Total</span><span>$${formatMoney(total)}</span></div>
          </div>
        </section>

        ${notes ? `
          <section class="notes">
            <span class="notes-label">Notas</span>
            ${escapeHtml(notes)}
          </section>
        ` : ''}

        ${isMovement ? `
          <section class="signatures">
            <div>
              <div class="signature-line"></div>
              <div class="signature-label">Entregado por</div>
            </div>
            <div>
              <div class="signature-line"></div>
              <div class="signature-label">Recibido por</div>
            </div>
          </section>
        ` : ''}

        <footer class="footer">
          <span>Generado por ${escapeHtml(userLabel)}</span>
          <span>${escapeHtml(companyInfo.name || 'Mi Tienda')} · ${escapeHtml(dateLabel)}</span>
        </footer>
      </main>
    </body>
    </html>
  `;
};

export const printDocument = (data, companyInfo) => {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('title', 'Documento imprimible');
  iframe.style.cssText = [
    'position:fixed',
    'right:0',
    'bottom:0',
    'width:794px',
    'height:1123px',
    'border:0',
    'visibility:hidden',
    'pointer-events:none',
    'z-index:-1'
  ].join(';');

  let removed = false;
  const removeIframe = () => {
    if (removed || !iframe.parentNode) return;
    removed = true;
    iframe.parentNode.removeChild(iframe);
  };

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) return;

    const print = () => {
      win.focus();
      win.print();
    };

    if (iframe.contentDocument?.readyState === 'complete') {
      setTimeout(print, 120);
    } else {
      setTimeout(print, 250);
    }

    win.addEventListener('afterprint', () => setTimeout(removeIframe, 300), { once: true });
    setTimeout(removeIframe, 120000);
  };

  iframe.srcdoc = buildDocumentHtml(data, companyInfo);
  document.body.appendChild(iframe);
};
