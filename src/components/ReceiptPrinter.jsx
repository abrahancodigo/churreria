import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useCompany } from "../context/CompanyContext";

const ReceiptPrinter = forwardRef((props, ref) => {
  const iframeRef = useRef(null);
  const [content, setContent] = useState(null);
  const { companyInfo } = useCompany();

  const printReceipt = (data) => {
    const iframe = iframeRef.current;
    const doc = iframe.contentWindow.document;

    // Determine Title based on Type
    const title = data.type === 'ENTRY' ? 'ENTRADA DE ALMACÉN' :
      data.type === 'EXIT' ? 'SALIDA DE ALMACÉN' : 'NOTA DE VENTA';

    const isMovement = data.type === 'ENTRY' || data.type === 'EXIT';

    const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 10px; width: 300px; }
                    .header { text-align: center; margin-bottom: 20px; }
                    .logo { max-width: 80px; max-height: 80px; margin-bottom: 10px; }
                    .title { font-size: 16px; font-weight: bold; margin: 5px 0; }
                    .info { margin-bottom: 10px; }
                    .table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
                    .table th { text-align: left; border-bottom: 1px dashed black; }
                    .table td { padding: 4px 0; }
                    .right { text-align: right; }
                    .bold { font-weight: bold; }
                    .footer { text-align: center; margin-top: 20px; font-size: 10px; }
                    .signatures { margin-top: 30px; text-align: center; }
                    .signature-row { display: flex; justify-content: space-between; margin-bottom: 25px; }
                    .signature-field { flex: 1; text-align: center; margin: 0 5px; }
                    .signature-line { border-bottom: 1px solid black; height: 30px; margin-bottom: 5px; }
                    .signature-label { font-size: 10px; }
                    .hora-field { text-align: center; margin-top: 10px; }
                </style>
            </head>
            <body>
                <div class="header">
                    ${companyInfo.logoUrl ? `<img src="${companyInfo.logoUrl}" class="logo" alt="Logo" />` : ''}
                    <div class="title">${companyInfo.name || "Mi Tienda"}</div>
                    <div>${companyInfo.address || ""}</div>
                    <div class="title">** ${title} **</div>
                    <div>${new Date().toLocaleString('es-MX')}</div>
                    ${data.user ? `<div>Usuario: ${data.user}</div>` : ''}
                </div>

                <div class="info">
                    ${data.notes ? `<div><strong>Notas:</strong> ${data.notes}</div>` : ''}
                    ${data.id ? `<div>Ref: ${data.id}</div>` : ''}
                </div>

                <table class="table">
                    <thead>
                        <tr>
                            <th>Cant</th>
                            <th>Producto</th>
                            ${!isMovement ? '<th class="right">Importe</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.items.map(item => `
                            <tr>
                                <td>${item.quantity}</td>
                                <td>${item.name}</td>
                                ${!isMovement ? `<td class="right">$${(item.price * item.quantity).toFixed(2)}</td>` : ''}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                ${!isMovement ? `
                <div class="right bold" style="border-top: 1px dashed black; padding-top: 5px;">
                    TOTAL: $${data.total.toFixed(2)}
                </div>
                ` : ''}

                ${isMovement ? `
                <div class="signatures">
                    <div class="signature-row">
                        <div class="signature-field">
                            <div class="signature-line"></div>
                            <div class="signature-label">Entregado por</div>
                        </div>
                        <div class="signature-field">
                            <div class="signature-line"></div>
                            <div class="signature-label">Recibido por</div>
                        </div>
                    </div>
                    <div class="hora-field">
                        <div style="display: inline-block; width: 150px;">
                            <div class="signature-line"></div>
                            <div class="signature-label">Hora</div>
                        </div>
                    </div>
                </div>
                ` : ''}

                <div class="footer">
                    <p>${isMovement ? 'Documento de Control Interno' : '¡Gracias por su compra!'}</p>
                </div>
            </body>
            </html>
        `;

    doc.open();
    doc.write(html);
    doc.close();

    // Print
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  };

  // Exposed after printReceipt is declared to avoid a temporal-dead-zone access.
  useImperativeHandle(ref, () => ({
    print: (data) => {
      setContent(data);
      setTimeout(() => {
        printReceipt(data);
      }, 100);
    }
  }));

  return (
    <iframe
      ref={iframeRef}
      style={{ display: 'none' }}
      title="Receipt Printer"
    />
  );
});

export default ReceiptPrinter;
