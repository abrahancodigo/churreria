// Auditor del DOM renderizado (herramienta de verificación, no de la app).
// Entra al arnés, recorre la pantalla y reporta en texto:
//   · Errores de layout: desbordes horizontales, elementos fuera del viewport.
//   · Contraste real de cada texto visible (color calculado vs. fondo efectivo).
//   · Áreas táctiles por debajo de 44px.
//   · Números de la pantalla (para confirmar que los datos llegaron).
//
// Uso: node tools/audit.mjs [ruta] [ancho] [alto]
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe"].find((p) => fs.existsSync(p));
const route = process.argv[2] || "/";
const width = Number(process.argv[3] || 1440);
const height = Number(process.argv[4] || 900);
const port = 9800 + Math.floor(Math.random() * 150);
const profile = path.resolve(".tmp/chrome-audit-" + process.pid);
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

// Se inyecta en la página. Devuelve un informe en texto plano.
const AUDIT_JS = String.raw`
(() => {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const ratio = (a, b) => { const x = lum(a), y = lum(b); const [hi, lo] = x > y ? [x, y] : [y, x]; return (hi + 0.05) / (lo + 0.05); };
  // Color de un fondo tipo gradiente: usa el primer color opaco que aparezca.
  const gradientColor = (img) => {
    if (!img || img === 'none') return null;
    const m = img.match(/rgba?\([^)]+\)/g);
    if (!m) return null;
    for (const c of m) { const p = parse(c); if (p && p.a >= 1) return p; }
    return parse(m[0]);
  };
  const bgOf = (el) => {
    let node = el, acc = null;
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      const own = parse(cs.backgroundColor);
      const c = own && own.a > 0 ? own : gradientColor(cs.backgroundImage);
      if (c && c.a > 0) { acc = acc ? blend(acc, c) : c; if (acc.a >= 1) return acc; }
      node = node.parentElement;
    }
    const rootBg = parse(getComputedStyle(document.documentElement).backgroundColor);
    const bodyBg = parse(getComputedStyle(document.body).backgroundColor);
    const base = rootBg && rootBg.a > 0 ? rootBg : bodyBg && bodyBg.a > 0 ? bodyBg : { r: 255, g: 255, b: 255, a: 1 };
    return acc ? blend(acc, base) : base;
  };
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const label = (el) => (el.innerText || el.textContent || el.getAttribute('aria-label') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 46);

  const problems = { contrast: [], touch: [], overflow: [], clipped: [] };
  let checked = 0;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  while (walker.nextNode()) {
    const el = walker.currentNode;
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const hasOwnText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);

    // Contraste del texto propio del elemento
    if (hasOwnText) {
      const fg = parse(cs.color);
      const bg = bgOf(el);
      if (fg) {
        const fgc = fg.a < 1 ? blend(fg, bg) : fg;
        const size = parseFloat(cs.fontSize);
        const bold = Number(cs.fontWeight) >= 700;
        const large = size >= 24 || (bold && size >= 18.66);
        const cr = ratio(fgc, bg);
        const min = large ? 3 : 4.5;
        checked++;
        if (cr < min) problems.contrast.push(cr.toFixed(2) + ':1 <' + min + ' "' + label(el) + '" ' + cs.color + ' sobre rgb(' + [bg.r, bg.g, bg.b].map(Math.round).join(',') + ') ' + size + 'px');
      }
    }

    // Área táctil de controles
    if (el.matches('button, a, input, select, textarea, [role="tab"], [role="button"]')) {
      const isInlineText = el.tagName === 'A' && cs.display === 'inline';
      if (!isInlineText && (r.width < 44 || r.height < 44)) {
        const pseudo = getComputedStyle(el, '::after');
        const extended = pseudo && pseudo.content && pseudo.content !== 'none' && parseFloat(pseudo.width) >= 44;
        if (!extended) problems.touch.push(r.width.toFixed(0) + 'x' + r.height.toFixed(0) + ' ' + el.tagName.toLowerCase() + ' "' + label(el) + '"');
      }
    }

    // Desbordes: elemento más ancho que su contenedor con scroll horizontal
    if (r.right > window.innerWidth + 1) {
      // Ignora lo que vive dentro de un contenedor con scroll propio: eso es
      // desplazamiento deliberado (tablas), no desborde de la pagina.
      let scroller = el.parentElement, insideScroller = false;
      while (scroller && scroller !== document.body) {
        const s = getComputedStyle(scroller);
        if ((s.overflowX === 'auto' || s.overflowX === 'scroll' || s.overflow === 'auto' || s.overflow === 'scroll')
            && scroller.scrollWidth > scroller.clientWidth + 1) { insideScroller = true; break; }
        scroller = scroller.parentElement;
      }
      if (!insideScroller) problems.overflow.push('right=' + r.right.toFixed(0) + ' "' + label(el) + '"');
    }
    // Texto cortado por overflow hidden sin ellipsis
    if (cs.overflow === 'hidden' && el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis' && !el.querySelector('*')) {
      problems.clipped.push('"' + label(el) + '" ' + el.clientWidth + '→' + el.scrollWidth);
    }
  }

  const dedupe = (arr) => [...new Set(arr)];
  const out = [
    'RUTA: ' + location.pathname + '  viewport ' + innerWidth + 'x' + innerHeight + '  documento ' + document.documentElement.scrollHeight + 'px',
    'TEXTOS MEDIDOS: ' + checked,
    '',
    '== CONTRASTE (' + problems.contrast.length + ') ==',
    ...dedupe(problems.contrast).slice(0, 25),
    '',
    '== ÁREA TÁCTIL <44px (' + dedupe(problems.touch).length + ') ==',
    ...dedupe(problems.touch).slice(0, 25),
    '',
    '== DESBORDE HORIZONTAL (' + dedupe(problems.overflow).length + ') ==',
    ...dedupe(problems.overflow).slice(0, 10),
    '',
    '== TEXTO CORTADO (' + dedupe(problems.clipped).length + ') ==',
    ...dedupe(problems.clipped).slice(0, 10),
  ];
  return out.join('\n');
})()
`;

try {
    let targets;
    for (let i = 0; i < 100; i++) {
        try {
            const r = await fetch(`http://127.0.0.1:${port}/json/list`);
            if (r.ok) { targets = await r.json(); break; }
        } catch { /* arrancando */ }
        await sleep(200);
    }
    const send = await connect(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await send("Page.navigate", { url: `http://127.0.0.1:5199/tools/harness/index.html?role=admin&p=${encodeURIComponent(route)}` });
    await sleep(2800);
    // AUDIT_EXPR permite evaluar una sonda ad-hoc en la misma página ya montada.
    const expression = process.env.AUDIT_EXPR || AUDIT_JS;
    const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    console.log(res.result?.value ?? JSON.stringify(res));
} catch (e) {
    console.error("FALLO:", e.message);
} finally {
    try { child.kill(); } catch { /* noop */ }
    await sleep(800);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* noop */ }
    process.exit(0);
}
