// Capturador de pantallas del arnés (herramienta de verificación, no de la app).
// Requiere el arnés en http://127.0.0.1:5199:
//   npx vite --config tools/vite.harness.config.js
//
// Uso: node tools/shoot.mjs [ancho] [alto] [rol] [ruta=nombre ...]
//   p. ej.: node tools/shoot.mjs 1440 900 admin /=inicio /inventory=inventario
//   p. ej.: node tools/shoot.mjs 390 844 admin /=inicio-movil
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CHROME = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((p) => fs.existsSync(p));

const [, , w = "1440", h = "900", roleArg = "admin", ...pairs] = process.argv;
const width = Number(w);
const height = Number(h);
const role = roleArg;

const ROUTES = pairs.length
    ? pairs.map((p) => {
        const [route, name] = p.split("=");
        return { route, name: name || route.replace(/\W+/g, "") || "inicio" };
    })
    : [
        { route: "/", name: "inicio" },
        { route: "/inventory", name: "inventario" },
        { route: "/stock-adjustments", name: "movimiento" },
        { route: "/transactions", name: "historial" },
        { route: "/reports", name: "reportes" },
        { route: "/settings", name: "ajustes" },
        { route: "/backup", name: "backup" },
    ];

const OUT = path.resolve("tmp-shots");
fs.mkdirSync(OUT, { recursive: true });
const PORT = 9500 + Math.floor(Math.random() * 300);
const profile = path.resolve(".tmp/chrome-shoot-" + process.pid);
fs.mkdirSync(profile, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const child = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--hide-scrollbars", "--force-device-scale-factor=1",
    `--window-size=${width},${height}`,
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "about:blank",
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

const waitDevtools = async () => {
    for (let i = 0; i < 100; i++) {
        try {
            const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
            if (r.ok) return r.json();
        } catch { /* arrancando */ }
        await sleep(200);
    }
    throw new Error("DevTools no responde");
};

const report = [];
try {
    const targets = await waitDevtools();
    const send = await connect(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });

    for (const { route, name } of ROUTES) {
        const url = `http://127.0.0.1:5199/tools/harness/index.html?role=${role}&p=${encodeURIComponent(route)}`;
        await send("Page.navigate", { url });
        await sleep(2600);
        const probe = await send("Runtime.evaluate", {
            expression: `JSON.stringify({ text: document.body.innerText.slice(0, 120).replace(/\\s+/g, " "), h: document.body.scrollHeight })`,
            returnByValue: true,
        });
        const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
        const file = path.join(OUT, `${name}-${width}.png`);
        fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
        const info = JSON.parse(probe.result?.value || "{}");
        report.push({ name, route, file: path.basename(file), text: info.text || "", h: info.h });
    }
    fs.writeFileSync(path.join(OUT, `report-${width}.txt`),
        report.map((r) => `${r.name.padEnd(14)} ${String(r.route).padEnd(20)} alto=${String(r.h).padEnd(6)} ${r.text}`).join("\n"));
    console.log(report.map((r) => `${r.name.padEnd(14)} alto=${String(r.h).padEnd(6)} ${r.text.slice(0, 70)}`).join("\n"));
} catch (e) {
    console.error("FALLO:", e.message);
    process.exitCode = 1;
} finally {
    try { child.kill(); } catch { /* noop */ }
    await sleep(900);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* noop */ }
    process.exit(process.exitCode || 0);
}
