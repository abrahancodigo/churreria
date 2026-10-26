// Auditoría del DOM con un modal ABIERTO.
// `audit.mjs` mide la página tal cual carga; este script abre el modal de
// detalle del Inicio y audita lo que hay dentro (contraste, área táctil,
// desborde y texto cortado), que es donde viven los botones de acción.
//
// Uso: node tools/audit-modal.mjs [ancho] [alto]
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const width = Number(process.argv[2] || 1440);
const height = Number(process.argv[3] || 900);
const port = 9800 + Math.floor(Math.random() * 150);
const profile = path.resolve(".tmp/chrome-maudit-" + process.pid);
fs.mkdirSync(profile, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const child = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`, `--window-size=${width},${height}`, "--hide-scrollbars", "about:blank",
], { stdio: "ignore", windowsHide: true });

let id = 0;
const connect = async (wsUrl) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && pending.has(msg.id)) {
            const { resolve, reject } = pending.get(msg.id);
            pending.delete(msg.id);
            msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
        }
    };
    return (method, params = {}) => new Promise((resolve, reject) => {
        const msgId = ++id;
        pending.set(msgId, { resolve, reject });
        ws.send(JSON.stringify({ id: msgId, method, params }));
    });
};

const AUDIT = `(() => {
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const blend = (f, b) => ({ r: f.r*f.a + b.r*(1-f.a), g: f.g*f.a + b.g*(1-f.a), b: f.b*f.a + b.b*(1-f.a), a: 1 });
  const ratio = (a, b) => { const x = lum(a), y = lum(b); const [h, l] = x > y ? [x, y] : [y, x]; return (h + 0.05) / (l + 0.05); };
  const bgOf = (el) => { let n = el, acc = null;
    while (n && n !== document.documentElement) { const cs = getComputedStyle(n); const c = parse(cs.backgroundColor);
      if (c && c.a > 0) { acc = acc ? blend(acc, c) : c; if (acc.a >= 1) return acc; } n = n.parentElement; }
    return { r: 255, g: 255, b: 255, a: 1 }; };

  const dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return 'MODAL NO ABIERTO';
  const problems = { contrast: [], touch: [], overflow: [] };
  let texts = 0;
  for (const el of dlg.querySelectorAll('*')) {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 1 || r.height < 1) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (own) {
      const fg = parse(cs.color); const bg = bgOf(el);
      if (fg) {
        const fgc = fg.a < 1 ? blend(fg, bg) : fg;
        const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
        const large = size >= 24 || (bold && size >= 18.66);
        const cr = ratio(fgc, bg); const min = large ? 3 : 4.5; texts++;
        if (cr < min) problems.contrast.push(cr.toFixed(2) + ':1 "' + (el.textContent||'').trim().slice(0,30) + '"');
      }
    }
    if (el.matches('button, a, input, select, textarea')) {
      if (r.width < 44 || r.height < 44) problems.touch.push(r.width.toFixed(0) + 'x' + r.height.toFixed(0) + ' "' + (el.innerText||el.getAttribute('aria-label')||'').trim().slice(0,24) + '"');
    }
    if (r.right > innerWidth + 1) problems.overflow.push((el.innerText||'').trim().slice(0,24));
  }
  const d = [...new Set];
  return ['textos medidos: ' + texts,
    'contraste: ' + [...new Set(problems.contrast)].length + (problems.contrast.length ? ' -> ' + [...new Set(problems.contrast)].slice(0,5).join(' ; ') : ''),
    'area tactil <44px: ' + [...new Set(problems.touch)].length + (problems.touch.length ? ' -> ' + [...new Set(problems.touch)].slice(0,5).join(' ; ') : ''),
    'desborde: ' + [...new Set(problems.overflow)].length].join('\\n');
})()`;

try {
    let targets;
    for (let i = 0; i < 100; i++) {
        try { const r = await fetch(`http://127.0.0.1:${port}/json/list`); if (r.ok) { targets = await r.json(); break; } } catch { /* arrancando */ }
        await sleep(200);
    }
    const send = await connect(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await send("Page.navigate", { url: "http://127.0.0.1:5199/tools/harness/index.html?role=admin&p=%2F" });
    await sleep(3000);

    const abrir = `(async () => {
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        // En movil las listas quedan mas abajo: hay que bajar antes de buscar.
        for (let i = 0; i < 12; i++) {
            const fila = [...document.querySelectorAll('button')].find(b => /Folio|Sin referencia/.test(b.innerText));
            if (fila) {
                fila.scrollIntoView({ block: 'center' });
                await sleep(250);
                const r = fila.getBoundingClientRect();
                const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) || fila;
                t.click();
                await sleep(800);
                return document.querySelector('[role="dialog"]') ? 'abierto' : 'no abrio';
            }
            window.scrollBy(0, Math.round(innerHeight * 0.7));
            await sleep(200);
        }
        return 'sin filas';
    })()`;
    const st = await send("Runtime.evaluate", { expression: abrir, returnByValue: true, awaitPromise: true });
    console.log(`MODAL (${width}x${height}): ${st.result?.value}`);
    const res = await send("Runtime.evaluate", { expression: AUDIT, returnByValue: true });
    console.log(res.result?.value ?? JSON.stringify(res));
} catch (e) {
    console.error("FALLO:", e.message);
} finally {
    try { child.kill(); } catch { /* noop */ }
    await sleep(800);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* noop */ }
    process.exit(0);
}
