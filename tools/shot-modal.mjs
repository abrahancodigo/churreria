// Captura el modal de detalle del Inicio ya abierto (herramienta de verificación).
// Uso: node tools/shot-modal.mjs [ancho] [alto] [nombre]
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const width = Number(process.argv[2] || 1440);
const height = Number(process.argv[3] || 900);
const name = process.argv[4] || "modal-detalle";
const port = 9800 + Math.floor(Math.random() * 150);
const profile = path.resolve(".tmp/chrome-shot-" + process.pid);
fs.mkdirSync(profile, { recursive: true });
fs.mkdirSync("tmp-shots", { recursive: true });
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
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: width < 600 });
    await send("Page.navigate", { url: "http://127.0.0.1:5199/tools/harness/index.html?role=admin&p=%2F" });
    await sleep(3000);

    // Abre el primer movimiento con un clic real (misma secuencia que el usuario).
    const abrir = `(async () => {
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        const fila = [...document.querySelectorAll('button')].find(b => /Folio/.test(b.innerText));
        if (!fila) return 'sin filas';
        fila.scrollIntoView({ block: 'center' });
        await sleep(200);
        const r = fila.getBoundingClientRect();
        const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
        const t = document.elementFromPoint(cx, cy) || fila;
        const o = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0, pointerId: 1, isPrimary: true };
        t.dispatchEvent(new PointerEvent('pointerdown', o));
        t.dispatchEvent(new MouseEvent('mousedown', o));
        t.dispatchEvent(new PointerEvent('pointerup', o));
        t.dispatchEvent(new MouseEvent('mouseup', o));
        t.dispatchEvent(new MouseEvent('click', o));
        await sleep(900);
        return document.querySelector('[role="dialog"]') ? 'abierto' : 'no abrio';
    })()`;
    const res = await send("Runtime.evaluate", { expression: abrir, returnByValue: true, awaitPromise: true });
    console.log("modal:", res.result?.value);

    const shot = await send("Page.captureScreenshot", { format: "png" });
    const file = path.join("tmp-shots", `${name}-${width}.png`);
    fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
    console.log("guardado:", file);
} catch (e) {
    console.error("FALLO:", e.message);
} finally {
    try { child.kill(); } catch { /* noop */ }
    await sleep(800);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* noop */ }
    process.exit(0);
}
