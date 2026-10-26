// Volcado de consola del arnés (herramienta de verificación, no de la app).
// Uso: node tools/console.mjs [ruta] [--mobile]
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe"].find((p) => fs.existsSync(p));
const route = process.argv[2] || "/";
const port = 9700 + Math.floor(Math.random() * 200);
const profile = path.resolve(".tmp/chrome-console-" + process.pid);
fs.mkdirSync(profile, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const child = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`, "--window-size=1440,900", "about:blank",
], { stdio: "ignore", windowsHide: true });

let id = 0;
const connect = async (wsUrl) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    const listeners = [];
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && pending.has(msg.id)) {
            const { resolve, reject } = pending.get(msg.id);
            pending.delete(msg.id);
            msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
        } else if (msg.method) {
            for (const l of listeners) l(msg);
        }
    };
    return {
        send: (method, params = {}) => new Promise((resolve, reject) => {
            const msgId = ++id;
            pending.set(msgId, { resolve, reject });
            ws.send(JSON.stringify({ id: msgId, method, params }));
        }),
        on: (fn) => listeners.push(fn),
    };
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
    const cdp = await connect(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Page.enable");
    cdp.on((m) => {
        if (m.method === "Runtime.consoleAPICalled") {
            const text = m.params.args.map((a) => a.value ?? a.description ?? a.type).join(" ");
            console.log(`[console.${m.params.type}]`, text.slice(0, 400));
        }
        if (m.method === "Runtime.exceptionThrown") {
            const d = m.params.exceptionDetails;
            console.log("[excepción]", (d.exception?.description || d.text || "").slice(0, 700));
        }
        if (m.method === "Log.entryAdded") {
            console.log(`[log.${m.params.entry.level}]`, String(m.params.entry.text).slice(0, 400));
        }
    });
    await cdp.send("Page.navigate", { url: "http://127.0.0.1:5199/tools/harness/index.html?role=admin" });
    await sleep(2500);
    if (route !== "/") {
        await cdp.send("Runtime.evaluate", { expression: `window.history.pushState({}, '', ${JSON.stringify(route)}); window.dispatchEvent(new PopStateEvent('popstate'));` });
        await sleep(1500);
    }
    const info = await cdp.send("Runtime.evaluate", {
        expression: "JSON.stringify({ url: location.href, root: !!document.getElementById('root'), html: (document.getElementById('root')||{}).innerHTML?.slice(0,200), body: document.body.innerText.slice(0,200) })",
        returnByValue: true,
    });
    console.log("DOM:", info.result.value);
} catch (e) {
    console.error("FALLO:", e.message);
} finally {
    try { child.kill(); } catch { /* noop */ }
    await sleep(800);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* noop */ }
    process.exit(0);
}
